"""Real MongoDB coverage for the Phase 6 Partner aggregate and workspace."""

import asyncio
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.partners.repository import MongoPartnerRepository
from app.modules.partners.schemas import (
    PartnerAnalyticsEventIn,
    PartnerDraftIn,
    PartnerOfferingIn,
    PartnerOnboardingStartIn,
    PartnerStatusIn,
)
from app.modules.partners.service import PartnerService


def test_partner_repository_executes_lifecycle_membership_and_analytics_operations():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase6_test_{uuid.uuid4().hex}"
        client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1000)
        try:
            try:
                await client.admin.command("ping")
            except Exception as error:
                pytest.skip(f"MongoDB test service unavailable: {error}")

            database = client[database_name]
            await ensure_indexes(database)
            owner_result = await database.users.insert_one(
                {
                    "email": "owner@example.com",
                    "name": "Owner",
                    "role": "user",
                    "account_active": True,
                }
            )
            staff_result = await database.users.insert_one(
                {
                    "email": "staff@example.com",
                    "name": "Staff",
                    "role": "user",
                    "account_active": True,
                }
            )
            destination_result = await database.destinations.insert_one(
                {
                    "name": "Danau Toba",
                    "name_en": "Lake Toba",
                    "location": "Samosir",
                    "is_active": True,
                }
            )
            owner = {
                "id": str(owner_result.inserted_id),
                "email": "owner@example.com",
                "name": "Owner",
                "role": "user",
            }
            staff = {
                "id": str(staff_result.inserted_id),
                "email": "staff@example.com",
                "name": "Staff",
                "role": "user",
            }
            admin = {
                "id": str(owner_result.inserted_id),
                "email": "admin@example.com",
                "role": "admin",
            }
            repository = MongoPartnerRepository(database)
            service = PartnerService(repository, analytics_secret="integration-secret")

            workspace = await service.start_onboarding(
                PartnerOnboardingStartIn(type="guide"), owner
            )
            partner_id = workspace.id
            assert workspace.membership_role == "owner"

            await service.save_draft(
                partner_id,
                PartnerDraftIn(
                    type="guide",
                    business_name="Pemandu Toba",
                    whatsapp="+62 812-3456-789",
                    description=(
                        "Pemandu lokal berpengalaman untuk perjalanan aman "
                        "di Danau Toba."
                    ),
                    city="Samosir",
                    destination_ids=[str(destination_result.inserted_id)],
                    service_tags=["Alam", "Budaya"],
                    guide_languages=["Indonesia"],
                    current_step=4,
                ),
                owner,
            )
            await repository.add_embedded(
                partner_id,
                "verification_documents",
                {
                    "id": "document-1",
                    "document_type": "ktp",
                    "filename": "proof.pdf",
                    "content_type": "application/pdf",
                    "size": 10,
                    "storage_path": "private/proof.pdf",
                    "uploaded_at": "2026-01-01T00:00:00+00:00",
                    "uploaded_by": owner["id"],
                },
                {},
            )
            submitted = await service.submit(partner_id, owner, False)
            assert submitted.status == "pending"

            await service.add_staff(partner_id, "staff@example.com", owner)
            staff_workspace = await service.get_mine(partner_id, staff)
            assert staff_workspace.membership_role == "staff"

            approved = await service.status(
                partner_id, PartnerStatusIn(status="approved"), admin
            )
            assert approved.status == "approved"
            assert approved.is_active is True

            offering = await service.create_offering(
                partner_id,
                PartnerOfferingIn(
                    kind="service",
                    name="Tur Danau Toba",
                    destination_ids=[str(destination_result.inserted_id)],
                    ai_tags=["Alam", "alam"],
                ),
                owner,
            )
            assert offering.ai_tags == ["alam"]
            public = await service.public_detail(partner_id)
            assert public.offerings[0].id == offering.id
            assert "verification_documents" not in public.model_dump()

            event = PartnerAnalyticsEventIn(
                event_id="integration_event_12345",
                event_type="profile_view",
                partner_id=partner_id,
                source="partner_detail",
                anonymous_session_id="integration_session_12345",
            )
            assert await service.track_event(event, True, None) == {
                "accepted": True,
                "duplicate": False,
            }
            assert await service.track_event(event, True, None) == {
                "accepted": True,
                "duplicate": True,
            }

            assert await service.delete(partner_id, admin) == {"ok": True}
            assert await database.partners.count_documents({}) == 0
            assert await database.partner_memberships.count_documents({}) == 0
            assert await database.partner_offerings.count_documents({}) == 0
            assert await database.partner_analytics.count_documents({}) == 0
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
