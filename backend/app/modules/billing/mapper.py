"""Billing persistence-to-contract mappers."""

from app.modules.billing.schemas import PlanOut


def plan_to_out(document: dict) -> PlanOut:
    return PlanOut(
        id=str(document["_id"]),
        code=document["code"],
        label_id=document["label_id"],
        label_en=document["label_en"],
        months=document["months"],
        price=document["price"],
        active=document.get("active", True),
        order=document.get("order", 1),
        created_at=document.get("created_at", ""),
        updated_at=document.get("updated_at", document.get("created_at", "")),
    )


def payment_order_to_owner_out(order: dict) -> dict:
    return {
        "order_id": order.get("order_id", ""),
        "plan_code": order.get("plan_code", ""),
        "months": order.get("months", 0),
        "amount": order.get("amount", 0),
        "status": order.get("status", "pending"),
        "created_at": order.get("created_at", ""),
        "updated_at": order.get("updated_at", order.get("created_at", "")),
        "premium_activated_at": order.get("premium_activated_at"),
        "can_retry": order.get("status") in {"failed", "token_failed"},
    }
