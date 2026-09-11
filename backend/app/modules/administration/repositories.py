"""Cohesive MongoDB adapters for administration aggregates and read models."""

import asyncio
from typing import Any

from bson import ObjectId

from app.modules.administration.exceptions import AdministrationError


def object_id(value: str, detail: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception as error:
        raise AdministrationError(400, detail) from error


class AuditLogRepository:
    def __init__(self, database: Any):
        self.database = database

    async def audit(
        self,
        actor: dict,
        action: str,
        entity_type: str,
        entity_id: str,
        details: dict,
        now: str,
    ) -> None:
        await self.database.audit_logs.insert_one(
            {
                "admin_id": actor["id"],
                "admin_email": actor.get("email", ""),
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "details": details,
                "created_at": now,
            }
        )

    async def system(
        self, level: str, source: str, message: str, details: dict, now: str
    ) -> None:
        await self.database.system_logs.insert_one(
            {
                "level": level.lower(),
                "source": source,
                "message": message,
                "details": details,
                "created_at": now,
            }
        )

    async def page(
        self,
        collection: str,
        query: dict,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        target = getattr(self.database, collection)
        total, rows = await asyncio.gather(
            target.count_documents(query),
            target.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
            .to_list(limit),
        )
        return rows, total


class DashboardRepository:
    def __init__(self, database: Any):
        self.database = database

    async def snapshot(self, since: str) -> tuple[list[int], list[dict]]:
        counts = await asyncio.gather(
            self.database.destinations.count_documents({}),
            self.database.destinations.count_documents({"is_active": {"$ne": False}}),
            self.database.partners.count_documents({}),
            self.database.partners.count_documents({"is_active": {"$ne": False}}),
            self.database.partners.count_documents({"status": "approved"}),
            self.database.partners.count_documents({"status": "pending"}),
            self.database.users.count_documents({}),
            self.database.users.count_documents({"account_active": {"$ne": False}}),
            self.database.users.count_documents({"created_at": {"$gte": since}}),
            self.database.itineraries.count_documents({}),
            self.database.ai_planner_logs.count_documents(
                {"created_at": {"$gte": since}}
            ),
            self.database.ai_planner_logs.count_documents(
                {"created_at": {"$gte": since}, "status": "error"}
            ),
        )
        recent = (
            await self.database.audit_logs.find({}).sort("created_at", -1).to_list(8)
        )
        return counts, recent


class AdminUserRepository:
    def __init__(self, database: Any):
        self.users = database.users

    async def page(
        self, query: dict, sort_field: str, direction: int, offset: int, limit: int
    ) -> tuple[list[dict], int]:
        total, rows = await asyncio.gather(
            self.users.count_documents(query),
            self.users.find(query)
            .sort(sort_field, direction)
            .skip(offset)
            .limit(limit)
            .to_list(limit),
        )
        return rows, total

    async def get(self, user_id: str) -> dict | None:
        return await self.users.find_one({"_id": object_id(user_id, "Invalid user id")})

    async def count_active_admins(self) -> int:
        return await self.users.count_documents(
            {"role": "admin", "account_active": {"$ne": False}}
        )

    async def update(self, user_id: str, changes: dict) -> dict | None:
        oid = object_id(user_id, "Invalid user id")
        await self.users.update_one({"_id": oid}, {"$set": changes})
        return await self.users.find_one({"_id": oid})


class SettingsRepository:
    def __init__(self, database: Any, client: Any):
        self.database = database
        self.client = client

    async def get(self) -> dict:
        return await self.database.system_settings.find_one({"_id": "general"}) or {}

    async def update(self, changes: dict) -> None:
        await self.database.system_settings.update_one(
            {"_id": "general"}, {"$set": changes}, upsert=True
        )

    async def has_partner_membership(self, user_id: str) -> bool:
        return (
            await self.database.partner_memberships.find_one(
                {"user_id": user_id, "status": "active"}, {"_id": 1}
            )
            is not None
        )

    async def ping(self) -> bool:
        try:
            await self.client.admin.command("ping")
            return True
        except Exception:
            return False


class GovernanceRepository:
    def __init__(self, database: Any):
        self.database = database

    async def destination(self, identifier: str) -> dict | None:
        return await self.database.destinations.find_one(
            {"_id": object_id(identifier, "Invalid destination id")}
        )

    async def partner(self, identifier: str) -> dict | None:
        return await self.database.partners.find_one(
            {"_id": object_id(identifier, "Invalid partner id")}
        )

    async def partner_preview_data(
        self, identifier: str, destination_ids: list[str]
    ) -> tuple[list[dict], list[dict]]:
        offering_rows = (
            await self.database.partner_offerings.find(
                {"partner_id": identifier, "is_active": True}
            )
            .sort("updated_at", -1)
            .to_list(200)
        )
        oids = []
        for value in destination_ids:
            try:
                oids.append(ObjectId(value))
            except Exception:
                continue
        destinations = (
            await self.database.destinations.find(
                {"_id": {"$in": oids}},
                {"name": 1, "name_en": 1, "location": 1},
            ).to_list(len(oids))
            if oids
            else []
        )
        return offering_rows, destinations

    async def overview_data(self) -> tuple[list[dict], list[dict], dict[str, int], int]:
        destinations, partners, offering_rows, open_reports = await asyncio.gather(
            self.database.destinations.find({}).sort("updated_at", 1).to_list(2000),
            self.database.partners.find({}).sort("updated_at", 1).to_list(2000),
            self.database.partner_offerings.aggregate(
                [
                    {"$match": {"is_active": True}},
                    {"$group": {"_id": "$partner_id", "count": {"$sum": 1}}},
                ]
            ).to_list(2000),
            self.database.content_reports.count_documents(
                {"status": {"$in": ["open", "investigating"]}}
            ),
        )
        return (
            destinations,
            partners,
            {row["_id"]: row["count"] for row in offering_rows},
            open_reports,
        )

    async def owner_email(self, user_id: str) -> dict | None:
        try:
            return await self.database.users.find_one(
                {"_id": ObjectId(user_id)}, {"email": 1, "name": 1}
            )
        except Exception:
            return None

    async def update_destination(self, identifier: str, changes: dict) -> None:
        await self.database.destinations.update_one(
            {"_id": object_id(identifier, "Invalid destination id")},
            {"$set": changes},
        )

    async def report_target_exists(self, target_type: str, identifier: str) -> bool:
        oid = object_id(identifier, "Invalid target id")
        collection = (
            self.database.reviews if target_type == "review" else self.database.partners
        )
        query: dict[str, Any] = {"_id": oid}
        if target_type == "partner":
            query.update({"status": "approved", "is_active": {"$ne": False}})
        return await collection.find_one(query, {"_id": 1}) is not None

    async def insert_report(self, document: dict) -> str:
        result = await self.database.content_reports.insert_one(document)
        return str(result.inserted_id)

    async def reports(self, status: str) -> list[dict]:
        query = {} if status == "all" else {"status": status}
        return (
            await self.database.content_reports.find(query)
            .sort("created_at", -1)
            .to_list(500)
        )

    async def report(self, identifier: str) -> dict | None:
        return await self.database.content_reports.find_one(
            {"_id": object_id(identifier, "Invalid report id")}
        )

    async def moderate_target(self, report: dict) -> None:
        target = object_id(report["target_id"], "Invalid target id")
        if report["target_type"] == "review":
            await self.database.reviews.update_one(
                {"_id": target}, {"$set": {"moderation_status": "hidden"}}
            )
        else:
            await self.database.partners.update_one(
                {"_id": target},
                {"$set": {"is_active": False, "moderation_status": "hidden"}},
            )

    async def update_report(self, identifier: str, changes: dict) -> None:
        await self.database.content_reports.update_one(
            {"_id": object_id(identifier, "Invalid report id")}, {"$set": changes}
        )

    async def analytics_data(self, since: str) -> tuple[list, list, list, list]:
        return await asyncio.gather(
            self.database.partner_analytics.find(
                {"created_at": {"$gte": since}}
            ).to_list(100000),
            self.database.planner_analytics.find(
                {"created_at": {"$gte": since}}
            ).to_list(100000),
            self.database.ai_planner_logs.find({"created_at": {"$gte": since}}).to_list(
                100000
            ),
            self.database.partners.find(
                {"status": "approved", "is_active": {"$ne": False}},
                {
                    "business_name": 1,
                    "premium_until": 1,
                    "type": 1,
                    "image": 1,
                    "gallery": 1,
                },
            ).to_list(10000),
        )

    async def partners_by_ids(self, identifiers: list[str]) -> list[dict]:
        object_ids = []
        for value in identifiers:
            try:
                object_ids.append(ObjectId(value))
            except Exception:
                continue
        if not object_ids:
            return []
        return await self.database.partners.find(
            {"_id": {"$in": object_ids}},
            {
                "business_name": 1,
                "premium_until": 1,
                "type": 1,
                "image": 1,
                "gallery": 1,
            },
        ).to_list(len(object_ids))


class NotificationRepository:
    def __init__(self, database: Any):
        self.database = database

    async def inbox(self, user_id: str) -> list[dict]:
        return (
            await self.database.in_app_notifications.find({"user_id": user_id})
            .sort("created_at", -1)
            .to_list(100)
        )

    async def mark_read(self, identifier: str, user_id: str, now: str) -> bool:
        result = await self.database.in_app_notifications.update_one(
            {
                "_id": object_id(identifier, "Invalid notification id"),
                "user_id": user_id,
            },
            {"$set": {"read_at": now}},
        )
        return result.matched_count == 1

    async def delivery_logs(self) -> tuple[list[dict], list[dict], list[dict]]:
        return await asyncio.gather(
            self.database.email_outbox.find({}).sort("created_at", -1).to_list(100),
            self.database.sms_outbox.find({}).sort("created_at", -1).to_list(100),
            self.database.in_app_notifications.find({})
            .sort("created_at", -1)
            .to_list(100),
        )

    async def insert_in_app(self, document: dict) -> str:
        result = await self.database.in_app_notifications.insert_one(document)
        return str(result.inserted_id)

    async def insert_sms(self, document: dict) -> str:
        result = await self.database.sms_outbox.insert_one(document)
        return str(result.inserted_id)

    async def update_sms(self, identifier: str, changes: dict) -> None:
        await self.database.sms_outbox.update_one(
            {"_id": ObjectId(identifier)}, {"$set": changes}
        )


class EmailTemplateRepository:
    def __init__(self, database: Any):
        self.templates = database.email_templates

    async def page(
        self, query: dict, sort_field: str, direction: int, offset: int, limit: int
    ) -> tuple[list[dict], int]:
        return await asyncio.gather(
            self.templates.find(query)
            .sort(sort_field, direction)
            .skip(offset)
            .limit(limit)
            .to_list(limit),
            self.templates.count_documents(query),
        )

    async def get(self, identifier: str) -> dict | None:
        return await self.templates.find_one(
            {"_id": object_id(identifier, "Invalid template id")}
        )

    async def by_key(self, key: str, exclude_id: str | None = None) -> dict | None:
        query: dict[str, Any] = {"key": key}
        if exclude_id:
            query["_id"] = {"$ne": object_id(exclude_id, "Invalid template id")}
        return await self.templates.find_one(query)

    async def insert(self, document: dict) -> dict:
        result = await self.templates.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def update(self, identifier: str, changes: dict) -> dict | None:
        oid = object_id(identifier, "Invalid template id")
        await self.templates.update_one({"_id": oid}, {"$set": changes})
        return await self.templates.find_one({"_id": oid})

    async def delete(self, identifier: str) -> None:
        await self.templates.delete_one(
            {"_id": object_id(identifier, "Invalid template id")}
        )


class LlmProfileRepository:
    def __init__(self, database: Any):
        self.profiles = database.llm_profiles

    async def active(self) -> dict | None:
        return await self.profiles.find_one({"active": True, "enabled": True})

    async def active_any(self) -> dict | None:
        return await self.profiles.find_one({"active": True})

    async def list(self, query: dict) -> list[dict]:
        return (
            await self.profiles.find(query)
            .sort([("active", -1), ("name", 1)])
            .to_list(200)
        )

    async def get(self, identifier: str) -> dict | None:
        return await self.profiles.find_one(
            {"_id": object_id(identifier, "Invalid profile id")}
        )

    async def by_name(self, normalized: str, exclude_id: str | None = None):
        query: dict[str, Any] = {"name_normalized": normalized}
        if exclude_id:
            query["_id"] = {"$ne": object_id(exclude_id, "Invalid profile id")}
        return await self.profiles.find_one(query)

    async def insert(self, document: dict) -> dict:
        result = await self.profiles.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def update(self, identifier: str, update: dict) -> dict | None:
        oid = object_id(identifier, "Invalid profile id")
        await self.profiles.update_one({"_id": oid}, update)
        return await self.profiles.find_one({"_id": oid})

    async def deactivate_all(self) -> None:
        await self.profiles.update_many({"active": True}, {"$set": {"active": False}})

    async def activate(self, identifier: str, changes: dict) -> bool:
        result = await self.profiles.update_one(
            {"_id": object_id(identifier, "Invalid profile id")}, {"$set": changes}
        )
        return result.modified_count > 0

    async def delete(self, identifier: str) -> None:
        await self.profiles.delete_one(
            {"_id": object_id(identifier, "Invalid profile id")}
        )
