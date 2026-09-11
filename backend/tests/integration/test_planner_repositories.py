"""Real MongoDB concurrency and persistence coverage for Phase 8."""

import asyncio
from datetime import datetime, timedelta, timezone
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.planner.repositories import (
    PlannerAnalyticsRepository,
    PlannerCatalogRepository,
    PlannerLogRepository,
    PlannerQuotaRepository,
)


def test_planner_repositories_are_atomic_idempotent_and_catalog_safe():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase8_test_{uuid.uuid4().hex}"
        client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1000)
        try:
            try:
                await client.admin.command("ping")
            except Exception as error:
                pytest.skip(f"MongoDB test service unavailable: {error}")
            database = client[database_name]
            await ensure_indexes(database)
            quota = PlannerQuotaRepository(database)

            reservations = await asyncio.gather(
                quota.reserve("user-key", 1, 2, 0),
                quota.reserve("user-key", 1, 2, 0),
            )
            accepted = [value for value in reservations if value]
            assert len(accepted) == 1
            assert reservations.count("") == 1
            assert await quota.consume("user-key", accepted[0], 2) is True
            assert await quota.consume("user-key", accepted[0], 2) is False
            assert await quota.reserve("user-key", 1, 2, 0) == ""

            refundable = await quota.reserve("refund-key", 1, 2, 0)
            assert refundable
            assert await quota.refund("refund-key", refundable) is True
            assert await quota.reserve("refund-key", 1, 2, 0)

            analytics = PlannerAnalyticsRepository(database)
            event = {
                "event_id": "event1234567890123456",
                "event_type": "planner_step_shown",
                "step": "story",
                "anonymous_id_hash": "hash",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
            }
            assert await analytics.insert_once(event) is True
            assert await analytics.insert_once(event) is False

            destination = await database.destinations.insert_one(
                {"name": "Danau Toba", "is_active": True}
            )
            await database.destinations.insert_one(
                {"name": "Hidden", "is_active": False}
            )
            partner = await database.partners.insert_one(
                {
                    "business_name": "Pemandu",
                    "type": "guide",
                    "status": "approved",
                    "is_active": True,
                    "accepting_contacts": True,
                    "destination_ids": [str(destination.inserted_id)],
                }
            )
            await database.partners.insert_one(
                {
                    "business_name": "Kuliner",
                    "type": "culinary",
                    "status": "approved",
                    "is_active": True,
                    "accepting_contacts": True,
                }
            )
            await database.partner_offerings.insert_one(
                {
                    "partner_id": str(partner.inserted_id),
                    "name": "Tour",
                    "is_active": True,
                }
            )
            catalog = PlannerCatalogRepository(database)
            assert len(await catalog.destinations()) == 1
            assert {row["type"] for row in await catalog.partners(False)} == {"guide"}
            assert len(await catalog.offerings([str(partner.inserted_id)])) == 1

            logs = PlannerLogRepository(database)
            log_id = await logs.start({"status": "processing"})
            await logs.finish(log_id, {"status": "completed", "sse_event_count": 3})
            assert (await database.ai_planner_logs.find_one({"_id": log_id}))[
                "status"
            ] == ("completed")
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
