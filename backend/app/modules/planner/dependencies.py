"""Request-scoped composition for the planner vertical slice."""

from typing import Any

from fastapi import Depends, Request

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.administration.dependencies import (
    LLM_ACTIVATION_LOCK,
    get_audit_service,
)
from app.modules.administration.gateways import LlmProfileGateway
from app.modules.administration.repositories import (
    LlmProfileRepository,
    SettingsRepository,
)
from app.modules.administration.service import AuditService, LlmProfileService
from app.modules.planner.gateways import (
    PlannerIdentityGateway,
    PlannerLlmGateway,
    PlannerSettingsGateway,
    PlannerSystemLogGateway,
)
from app.modules.planner.repositories import (
    PlannerAnalyticsRepository,
    PlannerCatalogRepository,
    PlannerLogRepository,
    PlannerQuotaRepository,
)
from app.modules.planner.service import (
    PlannerAnalyticsService,
    PlannerGenerationService,
    PlannerQuotaService,
)


def get_mongo_client(request: Request) -> Any:
    client = getattr(request.app.state, "mongo_client", None)
    if client is None:
        raise RuntimeError("MongoDB is not available outside the application lifespan")
    return client


def get_planner_identity(
    settings: Settings = Depends(get_app_settings),
) -> PlannerIdentityGateway:
    return PlannerIdentityGateway(settings)


def get_planner_settings(
    database: Any = Depends(get_database),
    client: Any = Depends(get_mongo_client),
    settings: Settings = Depends(get_app_settings),
) -> PlannerSettingsGateway:
    return PlannerSettingsGateway(SettingsRepository(database, client), settings)


def get_planner_quota_service(
    database: Any = Depends(get_database),
    identity: PlannerIdentityGateway = Depends(get_planner_identity),
) -> PlannerQuotaService:
    return PlannerQuotaService(PlannerQuotaRepository(database), identity)


def get_planner_analytics_service(
    database: Any = Depends(get_database),
    identity: PlannerIdentityGateway = Depends(get_planner_identity),
) -> PlannerAnalyticsService:
    return PlannerAnalyticsService(PlannerAnalyticsRepository(database), identity)


def get_planner_llm_gateway(
    database: Any = Depends(get_database),
    settings: Settings = Depends(get_app_settings),
    audit: AuditService = Depends(get_audit_service),
) -> PlannerLlmGateway:
    profiles = LlmProfileService(
        LlmProfileRepository(database),
        LlmProfileGateway(settings),
        audit,
        LLM_ACTIVATION_LOCK,
    )
    return PlannerLlmGateway(profiles)


def get_planner_generation_service(
    database: Any = Depends(get_database),
    planner_settings: PlannerSettingsGateway = Depends(get_planner_settings),
    quota: PlannerQuotaService = Depends(get_planner_quota_service),
    llm: PlannerLlmGateway = Depends(get_planner_llm_gateway),
    audit: AuditService = Depends(get_audit_service),
) -> PlannerGenerationService:
    return PlannerGenerationService(
        planner_settings,
        quota,
        PlannerCatalogRepository(database),
        llm,
        PlannerLogRepository(database),
        PlannerSystemLogGateway(audit),
    )
