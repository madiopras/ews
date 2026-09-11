"""Premium plan and payment application services."""

import uuid
from datetime import datetime, timezone
from typing import Any

from app.modules.billing.domain import (
    add_months,
    notification_without_secret,
    payment_state,
    valid_notification_signature,
)
from app.modules.billing.exceptions import BillingError
from app.modules.billing.mapper import payment_order_to_owner_out, plan_to_out
from app.modules.billing.schemas import PlanAdminPage, PlanIn, SnapTokenIn
from app.modules.partners.domain import premium_active


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class PlanService:
    def __init__(self, repository: Any, audit: Any):
        self.repository, self.audit = repository, audit

    async def public(self):
        return [plan_to_out(row) for row in await self.repository.public()]

    async def page(self, q: str, status: str, page: int, page_size: int, sort: str):
        page, page_size = max(1, page), max(1, min(page_size, 100))
        rows, total = await self.repository.page(q, status, page, page_size, sort)
        return PlanAdminPage(
            items=[plan_to_out(row) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size,
        )

    async def create(self, payload: PlanIn, actor: dict):
        if await self.repository.duplicate(payload.code):
            raise BillingError(400, "Plan code already exists")
        now = now_utc().isoformat()
        document = await self.repository.insert(
            {**payload.model_dump(), "created_at": now, "updated_at": now}
        )
        await self.audit.audit(
            actor,
            "create",
            "premium_plan",
            str(document["_id"]),
            {"code": payload.code},
        )
        return plan_to_out(document)

    async def update(self, plan_id: str, payload: PlanIn, actor: dict):
        if not await self.repository.get(plan_id):
            raise BillingError(404, "Not found")
        if await self.repository.duplicate(payload.code, plan_id):
            raise BillingError(400, "Plan code already exists")
        document = await self.repository.update(
            plan_id, {**payload.model_dump(), "updated_at": now_utc().isoformat()}
        )
        if not document:
            raise BillingError(404, "Not found")
        await self.audit.audit(
            actor, "update", "premium_plan", plan_id, {"code": document["code"]}
        )
        return plan_to_out(document)

    async def delete(self, plan_id: str, actor: dict):
        document = await self.repository.delete(plan_id)
        if not document:
            raise BillingError(404, "Not found")
        await self.audit.audit(
            actor, "delete", "premium_plan", plan_id, {"code": document.get("code", "")}
        )
        return {"ok": True}


class PaymentService:
    def __init__(self, plans: Any, payments: Any, gateway: Any):
        self.plans, self.payments, self.gateway = plans, payments, gateway

    def public_config(self) -> dict:
        config = self.gateway.config
        return {
            "client_key": config.client_key,
            "snap_js": config.snap_js,
            "is_production": config.is_production,
        }

    async def _authorized_partner(
        self, partner_id: str, user: dict, membership: bool = False
    ) -> dict:
        partner = await self.payments.partner(partner_id)
        if not partner:
            raise BillingError(404, "Partner not found")
        if user.get("role") != "admin":
            allowed = partner.get("owner_user_id") == user.get("id")
            if membership:
                row = await self.payments.membership(partner_id, user.get("id", ""))
                allowed = allowed or bool(row and row.get("role") == "owner")
            if not allowed:
                raise BillingError(403, "Partner owner access required")
        return partner

    async def create_token(self, payload: SnapTokenIn, user: dict) -> dict:
        plan = await self.plans.by_code(payload.plan_code, active=True)
        if not plan:
            raise BillingError(404, "Plan not found")
        partner = await self._authorized_partner(payload.partner_id, user)
        if partner.get("status") != "approved":
            raise BillingError(400, "Partner must be approved first")
        if partner.get("is_active", True) is False:
            raise BillingError(400, "Partner must be active")
        order_id = f"PRM-{uuid.uuid4().hex[:20]}"
        amount = int(plan["price"])
        await self.payments.insert_order(
            {
                "order_id": order_id,
                "partner_id": payload.partner_id,
                "plan_code": plan["code"],
                "months": int(plan["months"]),
                "amount": amount,
                "status": "created",
                "created_by_user_id": user["id"],
                "created_at": now_utc().isoformat(),
            }
        )
        body = {
            "transaction_details": {"order_id": order_id, "gross_amount": amount},
            "item_details": [
                {
                    "id": f"premium-{plan['code']}",
                    "price": amount,
                    "quantity": 1,
                    "name": plan["label_id"][:50],
                }
            ],
            "customer_details": {
                "first_name": partner["business_name"][:40],
                "phone": partner["whatsapp"],
            },
            "custom_field1": payload.partner_id,
            "custom_field2": plan["code"],
        }
        try:
            token = await self.gateway.create_transaction(body)
        except BillingError:
            await self.payments.update_order(order_id, {"status": "token_failed"})
            raise
        await self.payments.update_order(order_id, {"snap_token": token})
        config = self.gateway.config
        return {
            "order_id": order_id,
            "token": token,
            "amount": amount,
            "client_key": config.client_key,
            "snap_js": config.snap_js,
        }

    async def apply(self, notification: dict) -> None:
        order_id = notification.get("order_id")
        order = await self.payments.order(order_id)
        if not order:
            raise BillingError(404, "Unknown order")
        state, now = payment_state(notification), now_utc()
        await self.payments.record_result(
            order_id, state, notification_without_secret(notification), now.isoformat()
        )
        if state != "paid" or not await self.payments.claim_activation(
            order_id, now.isoformat()
        ):
            return
        partner = await self.payments.partner(order["partner_id"])
        if not partner:
            return
        base = now
        try:
            current = datetime.fromisoformat(partner.get("premium_until", ""))
            if current > now:
                base = current
        except (TypeError, ValueError):
            pass
        await self.payments.set_premium_until(
            order["partner_id"], add_months(base, order["months"]).isoformat()
        )

    async def notification(self, body: dict) -> dict:
        required = ("order_id", "status_code", "gross_amount", "signature_key")
        if not isinstance(body, dict) or any(key not in body for key in required):
            raise BillingError(400, "Invalid notification")
        if not valid_notification_signature(body, self.gateway.config.server_key):
            raise BillingError(403, "Invalid signature")
        await self.apply(body)
        return {"ok": True}

    async def status(self, order_id: str, user: dict) -> dict:
        order = await self.payments.order(order_id)
        if not order:
            raise BillingError(404, "Order not found")
        partner = await self._authorized_partner(order["partner_id"], user)
        remote = await self.gateway.transaction_status(order_id)
        if remote and remote.get("order_id") == order_id:
            await self.apply(remote)
        fresh = await self.payments.order(order_id) or order
        partner = await self.payments.partner(order["partner_id"]) or partner
        return {
            "order_id": order_id,
            "payment_status": fresh.get("status", "pending"),
            "premium_until": partner.get("premium_until"),
        }

    async def history(self, partner_id: str, user: dict) -> dict:
        partner = await self._authorized_partner(partner_id, user, membership=True)
        return {
            "premium_active": premium_active(partner),
            "premium_until": partner.get("premium_until"),
            "orders": [
                payment_order_to_owner_out(row)
                for row in await self.payments.list_orders(partner_id)
            ],
        }

    async def retry(self, partner_id: str, order_id: str, user: dict) -> dict:
        await self._authorized_partner(partner_id, user, membership=True)
        order = await self.payments.order(order_id, partner_id)
        if not order:
            raise BillingError(404, "Payment order not found")
        if order.get("status") not in {"failed", "token_failed"}:
            raise BillingError(409, "Only failed payments can be retried")
        result = await self.create_token(
            SnapTokenIn(partner_id=partner_id, plan_code=order["plan_code"]), user
        )
        await self.payments.update_order(
            result["order_id"], {"retry_of_order_id": order_id}
        )
        return result
