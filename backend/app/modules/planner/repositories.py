"""MongoDB adapters for planner quota, catalogs, telemetry, and logs."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class PlannerQuotaRepository:
    def __init__(self, database: Any):
        self.collection = database.planner_usage

    async def reserve(
        self,
        key: str,
        limit: int,
        ttl_days: int,
        cooldown_seconds: int,
    ) -> str | None:
        if limit == 0:
            return None
        now = datetime.now(timezone.utc)
        stale_before = now - timedelta(minutes=5)
        try:
            await self.collection.update_one(
                {"_id": key},
                {
                    "$setOnInsert": {
                        "created_at": now,
                        "consumed_count": 0,
                        "reservations": [],
                        "expires_at": now + timedelta(days=ttl_days),
                    }
                },
                upsert=True,
            )
        except DuplicateKeyError:
            # Two tabs may initialize the same identity simultaneously. The
            # winner created the counter; both still enter the atomic predicate.
            pass
        await self.collection.update_one(
            {"_id": key},
            {"$pull": {"reservations": {"reserved_at": {"$lt": stale_before}}}},
        )
        reservation_id = uuid.uuid4().hex
        total_usage = {
            "$add": [
                {"$ifNull": ["$consumed_count", 0]},
                {"$size": {"$ifNull": ["$reservations", []]}},
            ]
        }
        query: dict = {"_id": key, "$expr": {"$lt": [total_usage, limit]}}
        if cooldown_seconds > 0:
            query["$and"] = [
                {
                    "$or": [
                        {"last_started_at": {"$exists": False}},
                        {
                            "last_started_at": {
                                "$lte": now - timedelta(seconds=cooldown_seconds)
                            }
                        },
                    ]
                },
                {
                    "$or": [
                        {"reservations": {"$exists": False}},
                        {"reservations": {"$size": 0}},
                    ]
                },
            ]
        row = await self.collection.find_one_and_update(
            query,
            {
                "$set": {"expires_at": now + timedelta(days=ttl_days)},
                "$push": {
                    "reservations": {
                        "id": reservation_id,
                        "reserved_at": now,
                    }
                },
            },
            return_document=ReturnDocument.AFTER,
        )
        return reservation_id if row else ""

    async def consume(
        self, key: str, reservation_id: str | None, ttl_days: int
    ) -> bool:
        if not reservation_id:
            return False
        now = datetime.now(timezone.utc)
        result = await self.collection.update_one(
            {"_id": key, "reservations.id": reservation_id},
            {
                "$pull": {"reservations": {"id": reservation_id}},
                "$inc": {"consumed_count": 1},
                "$set": {
                    "last_started_at": now,
                    "expires_at": now + timedelta(days=ttl_days),
                },
            },
        )
        return result.modified_count == 1

    async def refund(self, key: str, reservation_id: str | None) -> bool:
        if not reservation_id:
            return False
        result = await self.collection.update_one(
            {"_id": key}, {"$pull": {"reservations": {"id": reservation_id}}}
        )
        return result.modified_count == 1

    async def usage(self, key: str) -> dict:
        return await self.collection.find_one({"_id": key}) or {}


class PlannerCatalogRepository:
    def __init__(self, database: Any):
        self.database = database

    async def destinations(self) -> list[dict]:
        return await self.database.destinations.find(
            {"is_active": {"$ne": False}}
        ).to_list(500)

    async def partners(self, culinary_enabled: bool) -> list[dict]:
        query: dict = {
            "status": "approved",
            "is_active": {"$ne": False},
            "accepting_contacts": {"$ne": False},
        }
        if not culinary_enabled:
            query["type"] = {"$ne": "culinary"}
        return await self.database.partners.find(query).to_list(1000)

    async def offerings(self, partner_ids: list[str]) -> list[dict]:
        if not partner_ids:
            return []
        return await self.database.partner_offerings.find(
            {"partner_id": {"$in": partner_ids}, "is_active": True}
        ).to_list(5000)


class PlannerAnalyticsRepository:
    def __init__(self, database: Any):
        self.collection = database.planner_analytics

    async def insert_once(self, document: dict) -> bool:
        try:
            await self.collection.insert_one(document)
            return True
        except DuplicateKeyError:
            return False


class PlannerLogRepository:
    def __init__(self, database: Any):
        self.collection = database.ai_planner_logs

    async def start(self, document: dict) -> Any:
        result = await self.collection.insert_one(document)
        return result.inserted_id

    async def finish(self, identifier: Any, changes: dict) -> None:
        await self.collection.update_one({"_id": identifier}, {"$set": changes})
