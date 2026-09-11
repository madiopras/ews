"""MongoDB adapters for billing persistence."""

import re
from typing import Any

from bson import ObjectId

from app.modules.billing.exceptions import BillingError


class PlanRepository:
    SORTS = {
        key: (key.lstrip("-"), -1 if key.startswith("-") else 1)
        for key in (
            "code",
            "-code",
            "label_id",
            "-label_id",
            "months",
            "-months",
            "price",
            "-price",
            "order",
            "-order",
            "created_at",
            "-created_at",
        )
    }

    def __init__(self, database: Any):
        self.collection = database.premium_plans

    async def public(self) -> list[dict]:
        return await self.collection.find({"active": True}).sort("order", 1).to_list(50)

    async def by_code(self, code: str, active: bool | None = None) -> dict | None:
        query: dict[str, Any] = {"code": code}
        if active is not None:
            query["active"] = active
        return await self.collection.find_one(query)

    async def get(self, plan_id: str) -> dict | None:
        return await self.collection.find_one({"_id": self._id(plan_id)})

    async def page(self, q: str, status: str, page: int, page_size: int, sort: str):
        query: dict[str, Any] = {}
        if q.strip()[:100]:
            pattern = re.escape(q.strip()[:100])
            query["$or"] = [
                {field: {"$regex": pattern, "$options": "i"}}
                for field in ("code", "label_id", "label_en")
            ]
        if status in {"active", "inactive"}:
            query["active"] = status == "active"
        if sort not in self.SORTS:
            raise BillingError(400, "Invalid sort field")
        total = await self.collection.count_documents(query)
        field, direction = self.SORTS[sort]
        rows = (
            await self.collection.find(query)
            .sort(field, direction)
            .skip((page - 1) * page_size)
            .limit(page_size)
            .to_list(page_size)
        )
        return rows, total

    async def insert(self, document: dict) -> dict:
        result = await self.collection.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def update(self, plan_id: str, document: dict) -> dict | None:
        oid = self._id(plan_id)
        await self.collection.update_one({"_id": oid}, {"$set": document})
        return await self.collection.find_one({"_id": oid})

    async def duplicate(self, code: str, excluded_id: str | None = None) -> bool:
        query: dict[str, Any] = {"code": code}
        if excluded_id:
            query["_id"] = {"$ne": self._id(excluded_id)}
        return await self.collection.find_one(query) is not None

    async def delete(self, plan_id: str) -> dict | None:
        oid = self._id(plan_id)
        document = await self.collection.find_one({"_id": oid})
        if document and (await self.collection.delete_one({"_id": oid})).deleted_count:
            return document
        return None

    @staticmethod
    def _id(value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise BillingError(400, "Invalid id") from error


class PaymentRepository:
    def __init__(self, database: Any):
        self.orders = database.payment_orders
        self.partners = database.partners
        self.memberships = database.partner_memberships

    @staticmethod
    def partner_id(value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise BillingError(400, "Invalid partner id") from error

    async def partner(self, partner_id: str) -> dict | None:
        return await self.partners.find_one({"_id": self.partner_id(partner_id)})

    async def membership(self, partner_id: str, user_id: str) -> dict | None:
        return await self.memberships.find_one(
            {"partner_id": partner_id, "user_id": user_id, "status": "active"}
        )

    async def insert_order(self, document: dict) -> None:
        await self.orders.insert_one(document)

    async def order(self, order_id: str, partner_id: str | None = None) -> dict | None:
        query = {"order_id": order_id}
        if partner_id is not None:
            query["partner_id"] = partner_id
        return await self.orders.find_one(query)

    async def update_order(self, order_id: str, changes: dict) -> None:
        await self.orders.update_one({"order_id": order_id}, {"$set": changes})

    async def list_orders(self, partner_id: str) -> list[dict]:
        return (
            await self.orders.find({"partner_id": partner_id})
            .sort("created_at", -1)
            .to_list(100)
        )

    async def record_result(
        self, order_id: str, status: str, provider_data: dict, now: str
    ) -> None:
        query: dict[str, Any] = {"order_id": order_id}
        if status != "paid":
            query["status"] = {"$ne": "paid"}
        await self.orders.update_one(
            query,
            {"$set": {"status": status, "midtrans": provider_data, "updated_at": now}},
        )

    async def claim_activation(self, order_id: str, now: str) -> bool:
        result = await self.orders.update_one(
            {"order_id": order_id, "premium_activated_at": {"$exists": False}},
            {"$set": {"premium_activated_at": now}},
        )
        return result.modified_count == 1

    async def set_premium_until(self, partner_id: str, value: str) -> None:
        await self.partners.update_one(
            {"_id": self.partner_id(partner_id)}, {"$set": {"premium_until": value}}
        )
