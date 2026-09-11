"""Real MongoDB integration coverage for Phase 7 administration aggregates."""

import asyncio
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.administration.gateways import NotificationGateway
from app.modules.administration.repositories import (
    AdminUserRepository,
    AuditLogRepository,
    EmailTemplateRepository,
    GovernanceRepository,
    NotificationRepository,
    SettingsRepository,
)
from app.modules.administration.schemas import (
    AdminUserUpdate,
    ContentReportIn,
    EditorialWorkflowIn,
    EmailTemplateIn,
    GeneralSettingsIn,
    ModerationActionIn,
)
from app.modules.administration.service import (
    AdminUserService,
    AuditService,
    EmailTemplateService,
    GovernanceService,
    NotificationService,
    SettingsService,
)
from app.modules.auth.gateways import MongoAuthEmailGateway
from app.modules.auth.repository import MongoRateLimitRepository
from app.modules.auth.service import AuthRateLimiter


def test_phase7_repositories_persist_settings_users_moderation_and_notifications():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase7_test_{uuid.uuid4().hex}"
        client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1000)
        try:
            try:
                await client.admin.command("ping")
            except Exception as error:
                pytest.skip(f"MongoDB test service unavailable: {error}")
            database = client[database_name]
            await ensure_indexes(database)
            admin_result = await database.users.insert_one(
                {
                    "email": "admin@example.com",
                    "name": "Admin",
                    "role": "admin",
                    "account_active": True,
                }
            )
            user_result = await database.users.insert_one(
                {
                    "email": "user@example.com",
                    "name": "User",
                    "role": "user",
                    "account_active": True,
                }
            )
            admin = {
                "id": str(admin_result.inserted_id),
                "email": "admin@example.com",
                "role": "admin",
            }
            audit = AuditService(AuditLogRepository(database), settings)

            settings_service = SettingsService(
                SettingsRepository(database, client), audit, settings
            )
            updated_settings = await settings_service.update(
                GeneralSettingsIn(
                    site_name="Integration Site",
                    support_email="SUPPORT@example.com",
                    planner_result_cards_enabled=True,
                    planner_result_cards_rollout_percentage=100,
                ),
                admin,
            )
            assert updated_settings["support_email"] == "support@example.com"
            decision = await settings_service.feature(
                "planner_result_cards",
                {"id": str(user_result.inserted_id), "role": "user"},
            )
            assert decision["enabled"] is True

            users = AdminUserService(AdminUserRepository(database), audit)
            changed = await users.update(
                str(user_result.inserted_id),
                AdminUserUpdate(role="partner", account_active=False),
                admin,
            )
            assert changed.role == "partner" and changed.account_active is False

            templates = EmailTemplateService(EmailTemplateRepository(database), audit)
            payload = EmailTemplateIn(
                key="integration_notice",
                name="Integration Notice",
                subject_id="Subjek",
                subject_en="Subject",
                body_id="Isi",
                body_en="Body",
            )
            template = await templates.create(payload, admin)
            assert (await templates.get(template["id"]))["key"] == payload.key

            destination_result = await database.destinations.insert_one(
                {
                    "name": "Draft Destination",
                    "name_en": "Draft Destination",
                    "description": "x" * 120,
                    "description_en": "x" * 120,
                    "is_active": False,
                }
            )
            review_result = await database.reviews.insert_one(
                {
                    "destination_id": str(destination_result.inserted_id),
                    "comment": "Needs moderation",
                }
            )
            notification_repository = NotificationRepository(database)
            notification_gateway = NotificationGateway(
                notification_repository,
                MongoAuthEmailGateway(database, settings),
                settings,
            )
            governance = GovernanceService(
                GovernanceRepository(database),
                audit,
                notification_gateway,
                AuthRateLimiter(MongoRateLimitRepository(database)),
            )
            workflow = await governance.update_workflow(
                str(destination_result.inserted_id),
                EditorialWorkflowIn(status="published", note="Reviewed"),
                admin,
            )
            assert workflow["status"] == "published"
            report = await governance.create_report(
                ContentReportIn(
                    target_type="review",
                    target_id=str(review_result.inserted_id),
                    reason="incorrect",
                ),
                "127.0.0.1",
                None,
            )
            await governance.moderate(
                report["id"],
                ModerationActionIn(status="resolved", action="hide"),
                admin,
            )
            stored_review = await database.reviews.find_one(
                {"_id": review_result.inserted_id}
            )
            assert stored_review["moderation_status"] == "hidden"

            delivered = await notification_gateway.in_app(
                str(user_result.inserted_id),
                "integration",
                "Title",
                "Body",
            )
            notifications = NotificationService(notification_repository)
            inbox = await notifications.list_mine({"id": str(user_result.inserted_id)})
            assert inbox[0]["id"] == delivered["id"]
            assert await notifications.mark_read(
                delivered["id"], {"id": str(user_result.inserted_id)}
            ) == {"ok": True}

            assert await database.audit_logs.count_documents({}) >= 5
            assert await database.system_logs.count_documents({}) == 1
            assert await templates.delete(template["id"], admin) == {"ok": True}
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
