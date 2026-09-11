"""MongoDB persistence adapter for the Partner aggregate."""

from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.modules.partners.exceptions import PartnerError


class MongoPartnerRepository:
    def __init__(self, database: Any):
        self.database = database
        self.partners = database.partners
        self.memberships = database.partner_memberships
        self.offerings = database.partner_offerings
        self.analytics = database.partner_analytics
        self.users = database.users
        self.destinations = database.destinations
        self.files = database.files
        self.audit_logs = database.audit_logs

    @staticmethod
    def object_id(value: str, detail: str = "Invalid partner id") -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise PartnerError(400, detail) from error

    async def get(
        self, partner_id: str, detail: str = "Invalid partner id"
    ) -> dict | None:
        return await self.partners.find_one({"_id": self.object_id(partner_id, detail)})

    async def get_public(self, partner_id: str) -> dict | None:
        return await self.partners.find_one(
            {
                "_id": self.object_id(partner_id),
                "status": "approved",
                "is_active": {"$ne": False},
            }
        )

    async def list_public(
        self, destination_id: str | None, partner_type: str | None
    ) -> list[dict]:
        query: dict[str, Any] = {
            "is_active": {"$ne": False},
            "status": "approved",
        }
        if destination_id:
            query["destination_ids"] = destination_id
        if partner_type:
            query["type"] = partner_type
        return await self.partners.find(query).sort("created_at", -1).to_list(500)

    async def list_all(self, limit: int = 1000) -> list[dict]:
        return await self.partners.find({}).sort("created_at", -1).to_list(limit)

    async def page(
        self, query: dict, sort_field: str, direction: int, skip: int, limit: int
    ) -> tuple[list[dict], int]:
        total = await self.partners.count_documents(query)
        rows = await (
            self.partners.find(query)
            .sort(sort_field, direction)
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )
        return rows, total

    async def insert(self, document: dict) -> dict:
        result = await self.partners.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def update(
        self, partner_id: str, changes: dict, push: dict | None = None
    ) -> dict | None:
        update: dict[str, Any] = {"$set": changes}
        if push:
            update["$push"] = push
        return await self.partners.find_one_and_update(
            {"_id": self.object_id(partner_id)},
            update,
            return_document=ReturnDocument.AFTER,
        )

    async def toggle(self, partner_id: str, updated_at: str) -> dict | None:
        return await self.partners.find_one_and_update(
            {"_id": self.object_id(partner_id, "Invalid id")},
            [
                {
                    "$set": {
                        "is_active": {
                            "$eq": [{"$ifNull": ["$is_active", True]}, False]
                        },
                        "updated_at": updated_at,
                    }
                }
            ],
            return_document=ReturnDocument.AFTER,
        )

    async def membership(self, partner_id: str, user_id: str) -> dict | None:
        return await self.memberships.find_one(
            {"partner_id": partner_id, "user_id": user_id, "status": "active"}
        )

    async def upsert_membership(
        self, partner_id: str, user_id: str, role: str, now: str
    ) -> None:
        await self.memberships.update_one(
            {"partner_id": partner_id, "user_id": user_id},
            {
                "$set": {"role": role, "status": "active", "updated_at": now},
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

    async def remove_membership(
        self, partner_id: str, user_id: str, now: str, *, role: str | None = None
    ) -> bool:
        query: dict[str, Any] = {"partner_id": partner_id, "user_id": user_id}
        if role:
            query["role"] = role
        result = await self.memberships.update_one(
            query, {"$set": {"status": "removed", "updated_at": now}}
        )
        return result.matched_count > 0

    async def active_memberships(self, partner_id: str) -> list[dict]:
        return (
            await self.memberships.find({"partner_id": partner_id, "status": "active"})
            .sort([("role", 1), ("created_at", 1)])
            .to_list(100)
        )

    async def my_memberships(self, user_id: str) -> list[dict]:
        return await self.memberships.find(
            {"user_id": user_id, "status": "active"}
        ).to_list(100)

    async def owned_partner_ids(self, user_id: str) -> list[ObjectId]:
        rows = await self.partners.find({"owner_user_id": user_id}, {"_id": 1}).to_list(
            100
        )
        return [row["_id"] for row in rows]

    async def partners_by_ids(self, values: list[ObjectId]) -> list[dict]:
        if not values:
            return []
        return (
            await self.partners.find({"_id": {"$in": values}})
            .sort("updated_at", -1)
            .to_list(100)
        )

    async def users_by_ids(self, values: list[str]) -> dict[str, dict]:
        object_ids = []
        for value in values:
            try:
                object_ids.append(ObjectId(value))
            except Exception:
                continue
        rows = (
            await self.users.find({"_id": {"$in": object_ids}}).to_list(len(object_ids))
            if object_ids
            else []
        )
        return {str(row["_id"]): row for row in rows}

    async def user_by_email(self, email: str) -> dict | None:
        return await self.users.find_one(
            {"email": email.lower(), "account_active": {"$ne": False}}
        )

    async def general_settings(self) -> dict:
        return await self.database.system_settings.find_one({"_id": "general"}) or {}

    async def has_active_membership(self, user_id: str) -> bool:
        return (
            await self.memberships.find_one(
                {"user_id": user_id, "status": "active"}, {"_id": 1}
            )
            is not None
        )

    async def set_user_partner_role(self, user_id: str, now: str) -> None:
        await self.users.update_one(
            {"_id": self.object_id(user_id, "Invalid user id")},
            {"$set": {"role": "partner", "updated_at": now}},
        )

    async def destinations_exist(self, values: list[str], active_only: bool) -> bool:
        if not values:
            return True
        try:
            object_ids = [ObjectId(value) for value in set(values)]
        except Exception as error:
            raise PartnerError(400, "Invalid destination id") from error
        query: dict[str, Any] = {"_id": {"$in": object_ids}}
        if active_only:
            query["is_active"] = {"$ne": False}
        return await self.destinations.count_documents(query) == len(object_ids)

    async def public_destinations(self, values: list[str]) -> list[dict]:
        object_ids = []
        for value in values:
            try:
                object_ids.append(ObjectId(value))
            except Exception:
                continue
        if not object_ids:
            return []
        return await self.destinations.find(
            {"_id": {"$in": object_ids}, "is_active": {"$ne": False}},
            {"name": 1, "name_en": 1, "location": 1},
        ).to_list(len(object_ids))

    async def offerings_for(
        self, partner_id: str, active_only: bool = False
    ) -> list[dict]:
        query: dict[str, Any] = {"partner_id": partner_id}
        if active_only:
            query["is_active"] = True
        return await self.offerings.find(query).sort("updated_at", -1).to_list(200)

    async def offering_count(self, partner_id: str) -> int:
        return await self.offerings.count_documents(
            {"partner_id": partner_id, "is_active": True}
        )

    async def insert_offering(self, document: dict) -> dict:
        result = await self.offerings.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def get_offering(self, partner_id: str, offering_id: str) -> dict | None:
        return await self.offerings.find_one(
            {
                "_id": self.object_id(offering_id, "Invalid offering id"),
                "partner_id": partner_id,
            }
        )

    async def update_offering(
        self, partner_id: str, offering_id: str, changes: dict
    ) -> dict | None:
        return await self.offerings.find_one_and_update(
            {
                "_id": self.object_id(offering_id, "Invalid offering id"),
                "partner_id": partner_id,
            },
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )

    async def delete_offering(self, partner_id: str, offering_id: str) -> bool:
        result = await self.offerings.delete_one(
            {
                "_id": self.object_id(offering_id, "Invalid offering id"),
                "partner_id": partner_id,
            }
        )
        return result.deleted_count == 1

    async def insight_count(self, partner_id: str, event: str, since: str) -> int:
        return await self.analytics.count_documents(
            {
                "partner_id": partner_id,
                "event_type": event,
                "created_at": {"$gte": since},
            }
        )

    async def insert_analytics(self, document: dict) -> bool:
        try:
            await self.analytics.insert_one(document)
            return True
        except DuplicateKeyError:
            return False

    async def add_embedded(
        self, partner_id: str, field: str, metadata: dict, changes: dict
    ) -> dict | None:
        return await self.partners.find_one_and_update(
            {"_id": self.object_id(partner_id)},
            {"$push": {field: metadata}, "$set": changes},
            return_document=ReturnDocument.AFTER,
        )

    async def remove_embedded(
        self, partner_id: str, field: str, item_id: str, changes: dict
    ) -> dict | None:
        return await self.partners.find_one_and_update(
            {"_id": self.object_id(partner_id)},
            {"$pull": {field: {"id": item_id}}, "$set": changes},
            return_document=ReturnDocument.AFTER,
        )

    async def record_file(self, metadata: dict) -> None:
        await self.files.insert_one(metadata)

    async def delete_file_record(self, storage_path: str) -> None:
        await self.files.delete_many({"storage_path": storage_path})

    async def audit(
        self, actor: dict, action: str, partner_id: str, details: dict, now: str
    ) -> None:
        await self.audit_logs.insert_one(
            {
                "admin_id": actor["id"],
                "admin_email": actor.get("email", ""),
                "action": action,
                "entity_type": "partner",
                "entity_id": partner_id,
                "details": details,
                "created_at": now,
            }
        )

    async def delete_cascade(self, partner_id: str) -> dict | None:
        partner = await self.partners.find_one_and_delete(
            {"_id": self.object_id(partner_id, "Invalid id")}
        )
        if partner:
            await self.files.delete_many({"partner_id": partner_id})
            await self.memberships.delete_many({"partner_id": partner_id})
            await self.offerings.delete_many({"partner_id": partner_id})
            await self.analytics.delete_many({"partner_id": partner_id})
        return partner
