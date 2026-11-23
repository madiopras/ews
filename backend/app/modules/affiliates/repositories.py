"""MongoDB repositories for affiliate configuration, clicks, and context lookups."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId


class AffiliateConfigRepository:
    COLLECTION = "affiliate_configs"
    DOC_ID = "tiket"

    def __init__(self, database: Any):
        self.database = database

    async def get_tiket(self) -> dict[str, Any] | None:
        return await self.database[self.COLLECTION].find_one({"_id": self.DOC_ID})

    async def upsert_tiket(self, document: dict[str, Any]) -> dict[str, Any]:
        payload = {**document, "_id": self.DOC_ID}
        await self.database[self.COLLECTION].update_one(
            {"_id": self.DOC_ID}, {"$set": payload}, upsert=True
        )
        saved = await self.get_tiket()
        return saved or payload


class AffiliateAnalyticsRepository:
    COLLECTION = "affiliate_clicks"

    def __init__(self, database: Any):
        self.database = database

    async def record_click(self, document: dict[str, Any]) -> None:
        now = datetime.now(timezone.utc)
        row = {
            **document,
            "created_at": now.isoformat(),
            "expires_at": now + timedelta(days=365),
        }
        await self.database[self.COLLECTION].insert_one(row)

    async def summarize(self, days: int) -> dict[str, Any]:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        rows = (
            await self.database[self.COLLECTION]
            .find({"created_at": {"$gte": since}})
            .to_list(length=50000)
        )
        by_product: dict[str, int] = {}
        by_zone: dict[str, int] = {}
        by_source: dict[str, int] = {}
        by_mode: dict[str, int] = {}
        for row in rows:
            product = str(row.get("product") or "unknown")
            zone = str(row.get("zone") or "unknown")
            source = str(row.get("source") or "unknown")
            mode = str(row.get("mode") or "unknown")
            by_product[product] = by_product.get(product, 0) + 1
            by_zone[zone] = by_zone.get(zone, 0) + 1
            by_source[source] = by_source.get(source, 0) + 1
            by_mode[mode] = by_mode.get(mode, 0) + 1

        def sort_buckets(counter: dict[str, int]) -> list[dict[str, Any]]:
            return [
                {"key": key, "count": count}
                for key, count in sorted(
                    counter.items(), key=lambda item: (-item[1], item[0])
                )
            ]

        return {
            "days": days,
            "total_clicks": len(rows),
            "by_product": sort_buckets(by_product),
            "by_zone": sort_buckets(by_zone),
            "by_source": sort_buckets(by_source),
            "by_mode": sort_buckets(by_mode),
        }


class AffiliateDestinationRepository:
    def __init__(self, database: Any):
        self.database = database

    async def find_locations_by_ids(
        self, destination_ids: list[str]
    ) -> list[dict[str, Any]]:
        object_ids: list[ObjectId] = []
        for raw_id in destination_ids[:20]:
            try:
                object_ids.append(ObjectId(raw_id.strip()))
            except (InvalidId, AttributeError):
                continue
        if not object_ids:
            return []
        return (
            await self.database["destinations"]
            .find(
                {"_id": {"$in": object_ids}, "is_active": {"$ne": False}},
                {"location": 1, "latitude": 1, "longitude": 1},
            )
            .to_list(length=20)
        )


class AffiliateSettingsReader:
    def __init__(self, database: Any):
        self.database = database

    async def read_general_settings(self) -> dict[str, Any]:
        return await self.database["system_settings"].find_one({"_id": "general"}) or {}
