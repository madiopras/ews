"""Request-scoped composition for administration features."""

import asyncio
from typing import Any

from fastapi import Depends, Request

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.administration.gateways import (
    LlmProfileGateway,
    NotificationGateway,
)
from app.modules.administration.repositories import (
    AdminUserRepository,
    AuditLogRepository,
    DashboardRepository,
    EmailTemplateRepository,
    GovernanceRepository,
    LlmProfileRepository,
    NotificationRepository,
    SettingsRepository,
)
from app.modules.administration.service import (
    AdminUserService,
    AuditService,
    DashboardService,
    EmailTemplateService,
    GovernanceService,
    LlmProfileService,
    LogService,
    NotificationService,
    SettingsService,
)
from app.modules.auth.gateways import MongoAuthEmailGateway
from app.modules.auth.repository import MongoRateLimitRepository
from app.modules.auth.service import AuthRateLimiter

LLM_ACTIVATION_LOCK = asyncio.Lock()


def get_mongo_client(request: Request) -> Any:
    client = getattr(request.app.state, "mongo_client", None)
    if client is None:
        raise RuntimeError("MongoDB is not available outside the application lifespan")
    return client


def get_audit_service(
    database: Any = Depends(get_database),
    settings: Settings = Depends(get_app_settings),
) -> AuditService:
    return AuditService(AuditLogRepository(database), settings)


def get_dashboard_service(
    database: Any = Depends(get_database),
) -> DashboardService:
    return DashboardService(DashboardRepository(database))


def get_admin_user_service(
    database: Any = Depends(get_database),
    audit: AuditService = Depends(get_audit_service),
) -> AdminUserService:
    return AdminUserService(AdminUserRepository(database), audit)


def get_log_service(database: Any = Depends(get_database)) -> LogService:
    return LogService(AuditLogRepository(database))


def get_settings_service(
    database: Any = Depends(get_database),
    client: Any = Depends(get_mongo_client),
    settings: Settings = Depends(get_app_settings),
    audit: AuditService = Depends(get_audit_service),
) -> SettingsService:
    return SettingsService(SettingsRepository(database, client), audit, settings)


def get_notification_repository(
    database: Any = Depends(get_database),
) -> NotificationRepository:
    return NotificationRepository(database)


def get_notification_gateway(
    database: Any = Depends(get_database),
    repository: NotificationRepository = Depends(get_notification_repository),
    settings: Settings = Depends(get_app_settings),
) -> NotificationGateway:
    return NotificationGateway(
        repository, MongoAuthEmailGateway(database, settings), settings
    )


def get_notification_service(
    repository: NotificationRepository = Depends(get_notification_repository),
) -> NotificationService:
    return NotificationService(repository)


def get_email_template_service(
    database: Any = Depends(get_database),
    audit: AuditService = Depends(get_audit_service),
) -> EmailTemplateService:
    return EmailTemplateService(EmailTemplateRepository(database), audit)


def get_llm_profile_service(
    database: Any = Depends(get_database),
    settings: Settings = Depends(get_app_settings),
    audit: AuditService = Depends(get_audit_service),
) -> LlmProfileService:
    return LlmProfileService(
        LlmProfileRepository(database),
        LlmProfileGateway(settings),
        audit,
        LLM_ACTIVATION_LOCK,
    )


def get_governance_service(
    database: Any = Depends(get_database),
    audit: AuditService = Depends(get_audit_service),
    notifications: NotificationGateway = Depends(get_notification_gateway),
) -> GovernanceService:
    return GovernanceService(
        GovernanceRepository(database),
        audit,
        notifications,
        AuthRateLimiter(MongoRateLimitRepository(database)),
    )
