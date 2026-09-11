"""Thin HTTP transport for Phase 7 administration and governance workflows."""

from typing import Literal

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.modules.administration.dependencies import (
    get_admin_user_service,
    get_dashboard_service,
    get_email_template_service,
    get_governance_service,
    get_llm_profile_service,
    get_log_service,
    get_notification_service,
    get_settings_service,
)
from app.modules.administration.exceptions import AdministrationError
from app.modules.administration.schemas import (
    AdminUserOut,
    AdminUserPage,
    AdminUserUpdate,
    ContentReportIn,
    EditorialWorkflowIn,
    EmailTemplateIn,
    GeneralSettingsIn,
    LlmProfileCreateIn,
    LlmProfileUpdateIn,
    ModerationActionIn,
)
from app.modules.administration.service import (
    AdminUserService,
    DashboardService,
    EmailTemplateService,
    GovernanceService,
    LlmProfileService,
    LogService,
    NotificationService,
    SettingsService,
)
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
    require_admin,
)

router = APIRouter(prefix="/api")


async def administration_error_handler(
    request: Request, error: AdministrationError
) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {AdministrationError: administration_error_handler}


@router.get("/admin/dashboard")
async def admin_dashboard(
    admin: dict = Depends(require_admin),
    service: DashboardService = Depends(get_dashboard_service),
):
    del admin
    return await service.read()


@router.get("/admin/users", response_model=AdminUserPage)
async def list_admin_users(
    q: str = "",
    role: Literal["all", "user", "partner", "admin"] = "all",
    status: Literal["all", "active", "inactive"] = "all",
    provider: Literal["all", "password", "google"] = "all",
    page: int = 1,
    page_size: int = 25,
    sort: str = "-created_at",
    admin: dict = Depends(require_admin),
    service: AdminUserService = Depends(get_admin_user_service),
):
    del admin
    return await service.list(
        query_text=q,
        role=role,
        status=status,
        provider=provider,
        page=page,
        page_size=page_size,
        sort=sort,
    )


@router.patch("/admin/users/{user_id}", response_model=AdminUserOut)
async def update_admin_user(
    user_id: str,
    payload: AdminUserUpdate,
    admin: dict = Depends(require_admin),
    service: AdminUserService = Depends(get_admin_user_service),
):
    return await service.update(user_id, payload, admin)


@router.get("/admin/audit-logs")
async def list_audit_logs(
    page: int = 1,
    page_size: int = 25,
    limit: int | None = None,
    skip: int | None = None,
    q: str = "",
    action: str | None = None,
    entity_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    admin: dict = Depends(require_admin),
    service: LogService = Depends(get_log_service),
):
    del admin
    return await service.list(
        "audit_logs",
        page=page,
        page_size=page_size,
        limit=limit,
        skip=skip,
        query_text=q,
        filters={"action": action, "entity_type": entity_type},
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/admin/ai-logs")
async def list_ai_logs(
    page: int = 1,
    page_size: int = 25,
    limit: int | None = None,
    skip: int | None = None,
    q: str = "",
    status: str | None = None,
    lang: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    admin: dict = Depends(require_admin),
    service: LogService = Depends(get_log_service),
):
    del admin
    return await service.list(
        "ai_planner_logs",
        page=page,
        page_size=page_size,
        limit=limit,
        skip=skip,
        query_text=q,
        filters={"status": status, "lang": lang},
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/admin/system-logs")
async def list_system_logs(
    page: int = 1,
    page_size: int = 25,
    limit: int | None = None,
    skip: int | None = None,
    q: str = "",
    level: str | None = None,
    source: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    admin: dict = Depends(require_admin),
    service: LogService = Depends(get_log_service),
):
    del admin
    return await service.list(
        "system_logs",
        page=page,
        page_size=page_size,
        limit=limit,
        skip=skip,
        query_text=q,
        filters={"level": level.lower() if level else None, "source": source},
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/admin/settings")
async def read_admin_settings(
    admin: dict = Depends(require_admin),
    service: SettingsService = Depends(get_settings_service),
):
    del admin
    return await service.read()


@router.put("/admin/settings")
async def update_admin_settings(
    payload: GeneralSettingsIn,
    admin: dict = Depends(require_admin),
    service: SettingsService = Depends(get_settings_service),
):
    return await service.update(payload, admin)


@router.get("/experience/features")
async def read_experience_features(
    user: dict | None = Depends(get_optional_user),
    service: SettingsService = Depends(get_settings_service),
):
    return await service.features(user)


@router.get("/admin/settings/integrations")
async def integration_status(
    admin: dict = Depends(require_admin),
    service: SettingsService = Depends(get_settings_service),
):
    del admin
    return await service.integrations()


@router.get("/notifications")
async def list_my_notifications(
    user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    return await service.list_mine(user)


@router.patch("/notifications/{notification_id}/read")
async def read_my_notification(
    notification_id: str,
    user: dict = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
):
    return await service.mark_read(notification_id, user)


@router.get("/admin/governance/notifications")
async def governance_notifications(
    admin: dict = Depends(require_admin),
    service: NotificationService = Depends(get_notification_service),
):
    del admin
    return await service.delivery_logs()


@router.get("/admin/email-templates")
async def list_email_templates(
    page: int = 1,
    page_size: int = 25,
    q: str = "",
    status: Literal["enabled", "disabled"] | None = None,
    sort: str = "key",
    admin: dict = Depends(require_admin),
    service: EmailTemplateService = Depends(get_email_template_service),
):
    del admin
    return await service.list(
        page=page,
        page_size=page_size,
        query_text=q,
        status=status,
        sort=sort,
    )


@router.get("/admin/email-templates/{template_id}")
async def read_email_template(
    template_id: str,
    admin: dict = Depends(require_admin),
    service: EmailTemplateService = Depends(get_email_template_service),
):
    del admin
    return await service.get(template_id)


@router.post("/admin/email-templates", status_code=201)
async def create_email_template(
    payload: EmailTemplateIn,
    admin: dict = Depends(require_admin),
    service: EmailTemplateService = Depends(get_email_template_service),
):
    return await service.create(payload, admin)


@router.put("/admin/email-templates/{template_id}")
async def update_email_template(
    template_id: str,
    payload: EmailTemplateIn,
    admin: dict = Depends(require_admin),
    service: EmailTemplateService = Depends(get_email_template_service),
):
    return await service.update(template_id, payload, admin)


@router.delete("/admin/email-templates/{template_id}")
async def delete_email_template(
    template_id: str,
    admin: dict = Depends(require_admin),
    service: EmailTemplateService = Depends(get_email_template_service),
):
    return await service.delete(template_id, admin)


@router.get("/admin/llm-profiles/runtime")
async def llm_runtime_status(
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    del admin
    return await service.runtime_status()


@router.get("/admin/llm-profiles")
async def list_llm_profiles(
    q: str = "",
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    del admin
    return await service.list(q)


@router.post("/admin/llm-profiles", status_code=201)
async def create_llm_profile(
    payload: LlmProfileCreateIn,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.create(payload, admin)


@router.get("/admin/llm-profiles/{profile_id}")
async def read_llm_profile(
    profile_id: str,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    del admin
    return await service.get(profile_id)


@router.put("/admin/llm-profiles/{profile_id}")
async def update_llm_profile(
    profile_id: str,
    payload: LlmProfileUpdateIn,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.update(profile_id, payload, admin)


@router.post("/admin/llm-profiles/{profile_id}/duplicate", status_code=201)
async def duplicate_llm_profile(
    profile_id: str,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.duplicate(profile_id, admin)


@router.post("/admin/llm-profiles/{profile_id}/test")
async def test_llm_profile(
    profile_id: str,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.test(profile_id, admin)


@router.post("/admin/llm-profiles/{profile_id}/activate")
async def activate_llm_profile(
    profile_id: str,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.activate(profile_id, admin)


@router.post("/admin/llm-profiles/use-environment")
async def activate_environment_llm(
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.use_environment(admin)


@router.delete("/admin/llm-profiles/{profile_id}")
async def delete_llm_profile(
    profile_id: str,
    admin: dict = Depends(require_admin),
    service: LlmProfileService = Depends(get_llm_profile_service),
):
    return await service.delete(profile_id, admin)


@router.get("/admin/governance/preview/destinations/{destination_id}")
async def governance_destination_preview(
    destination_id: str,
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    del admin
    return await service.destination_preview(destination_id)


@router.get("/admin/governance/preview/partners/{partner_id}")
async def governance_partner_preview(
    partner_id: str,
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    del admin
    return await service.partner_preview(partner_id)


@router.get("/admin/governance/overview")
async def governance_overview(
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    del admin
    return await service.overview()


@router.patch("/admin/governance/destinations/{destination_id}/workflow")
async def update_editorial_workflow(
    destination_id: str,
    payload: EditorialWorkflowIn,
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    return await service.update_workflow(destination_id, payload, admin)


@router.post("/reports", status_code=201)
async def create_content_report(
    payload: ContentReportIn,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    service: GovernanceService = Depends(get_governance_service),
):
    return await service.create_report(
        payload, request.client.host if request.client else "unknown", user
    )


@router.get("/admin/governance/reports")
async def list_content_reports(
    status: Literal["all", "open", "investigating", "resolved", "dismissed"] = "all",
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    del admin
    return await service.reports(status)


@router.patch("/admin/governance/reports/{report_id}")
async def moderate_content_report(
    report_id: str,
    payload: ModerationActionIn,
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    return await service.moderate(report_id, payload, admin)


@router.post("/admin/governance/partners/{partner_id}/notify")
async def notify_partner_attention(
    partner_id: str,
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    return await service.notify_partner(partner_id, admin)


@router.get("/admin/governance/analytics")
async def governance_analytics(
    days: int = 30,
    admin: dict = Depends(require_admin),
    service: GovernanceService = Depends(get_governance_service),
):
    del admin
    return await service.analytics(days)


@router.get("/admin/governance/role-preview/{role}")
async def governance_role_preview(
    role: Literal["guest", "user", "partner", "admin"],
    admin: dict = Depends(require_admin),
):
    del admin
    return GovernanceService.role(role)
