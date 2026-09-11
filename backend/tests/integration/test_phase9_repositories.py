"""Real MongoDB persistence coverage for Phase 9 adapters."""

import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.backups.repository import BackupRepository
from app.modules.billing.repositories import PaymentRepository, PlanRepository
from app.modules.media.repository import MediaRepository
from app.modules.sharing.repository import SharingRepository


def test_phase9_repositories_persist_and_claim_payment_atomically():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase9_test_{uuid.uuid4().hex}"
        client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1000)
        try:
            try:
                await client.admin.command("ping")
            except Exception as error:
                pytest.skip(f"MongoDB test service unavailable: {error}")
            database = client[database_name]
            await ensure_indexes(database)

            plans = PlanRepository(database)
            plan = await plans.insert(
                {
                    "code": "test",
                    "label_id": "Tes",
                    "label_en": "Test",
                    "months": 1,
                    "price": 10,
                    "active": True,
                    "order": 1,
                    "created_at": "now",
                }
            )
            assert (await plans.by_code("test", active=True))["_id"] == plan["_id"]
            rows, total = await plans.page("Tes", "active", 1, 10, "order")
            assert total == 1 and rows[0]["code"] == "test"

            partner = await database.partners.insert_one({"business_name": "Mitra"})
            partner_id = str(partner.inserted_id)
            payments = PaymentRepository(database)
            await payments.insert_order(
                {
                    "order_id": "ORDER-1",
                    "partner_id": partner_id,
                    "months": 1,
                    "status": "pending",
                    "created_at": "now",
                }
            )
            claims = await asyncio.gather(
                *(
                    payments.claim_activation(
                        "ORDER-1", datetime.now(timezone.utc).isoformat()
                    )
                    for _ in range(8)
                )
            )
            assert claims.count(True) == 1
            await payments.record_result(
                "ORDER-1", "paid", {"order_id": "ORDER-1"}, "later"
            )
            assert (await payments.order("ORDER-1"))["status"] == "paid"
            await payments.record_result(
                "ORDER-1", "pending", {"order_id": "ORDER-1"}, "latest"
            )
            assert (await payments.order("ORDER-1"))["status"] == "paid"

            backups = BackupRepository(database)
            job = await backups.insert(
                {"filename": "backup.gz", "status": "pending", "created_at": "now"}
            )
            assert (await backups.get(str(job["_id"])))["filename"] == "backup.gz"

            await MediaRepository(database).record(
                {"storage_path": "app/uploads/photo.png"}
            )
            assert await database.files.count_documents({}) == 1
            await database.itineraries.insert_one(
                {"share_slug": "public", "is_public": True}
            )
            assert await SharingRepository(database).public_itinerary("public")
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
