"""Request and response contracts owned by the administration feature."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class AdminUserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    account_active: bool = True
    auth_provider: str = "password"
    created_at: str = ""
    updated_at: str = ""


class AdminUserPage(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int
    pages: int


class AdminUserUpdate(BaseModel):
    role: Literal["user", "partner", "admin"] | None = None
    account_active: bool | None = None


class GeneralSettingsIn(BaseModel):
    site_name: str = Field(..., min_length=2, max_length=120)
    support_email: EmailStr
    default_language: Literal["id", "en"] = "id"
    maintenance_mode: bool = False
    partner_review_sla_days: int = Field(2, ge=1, le=30)
    planner_enabled: bool = True
    planner_guest_trial_enabled: bool = True
    planner_guest_generation_limit: int = Field(1, ge=1, le=10)
    planner_guest_identity_ttl_days: int = Field(180, ge=1, le=365)
    planner_guest_ip_daily_limit: int = Field(20, ge=1, le=1000)
    planner_authenticated_daily_limit: int = Field(20, ge=0, le=1000)
    planner_generation_cooldown_seconds: int = Field(5, ge=0, le=3600)
    planner_result_cards_enabled: bool = False
    planner_result_cards_rollout_percentage: int = Field(0, ge=0, le=100)
    planner_structured_results_enabled: bool = False
    planner_structured_rollout_percentage: int = Field(0, ge=0, le=100)
    planner_culinary_enabled: bool = False
    planner_culinary_rollout_percentage: int = Field(0, ge=0, le=100)
    planner_partner_matches_enabled: bool = False
    planner_partner_matches_rollout_percentage: int = Field(0, ge=0, le=100)
    mitra_onboarding_enabled: bool = True
    mitra_onboarding_rollout_percentage: int = Field(100, ge=0, le=100)
    mitra_dashboard_enabled: bool = True
    mitra_dashboard_rollout_percentage: int = Field(100, ge=0, le=100)
    backup_retention_days: int = Field(30, ge=1, le=365)


class EmailTemplateIn(BaseModel):
    key: str = Field(..., min_length=2, max_length=80, pattern=r"^[a-z0-9_]+$")
    name: str = Field(..., min_length=2, max_length=120)
    subject_id: str = Field(..., min_length=1, max_length=200)
    subject_en: str = Field(..., min_length=1, max_length=200)
    body_id: str = Field(..., min_length=1, max_length=10000)
    body_en: str = Field(..., min_length=1, max_length=10000)
    enabled: bool = True


class LlmProfileCreateIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    base_url: str = Field(..., min_length=8, max_length=500)
    model_name: str = Field(..., min_length=1, max_length=200)
    api_key: str | None = Field(default=None, max_length=1000)
    enabled: bool = True


class LlmProfileUpdateIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    base_url: str = Field(..., min_length=8, max_length=500)
    model_name: str = Field(..., min_length=1, max_length=200)
    enabled: bool = True
    api_key_action: Literal["preserve", "replace", "remove"] = "preserve"
    api_key: str | None = Field(default=None, max_length=1000)


class EditorialWorkflowIn(BaseModel):
    status: Literal["draft", "in_review", "needs_revision", "published"]
    note: str = Field(default="", max_length=1000)


class ContentReportIn(BaseModel):
    target_type: Literal["review", "partner"]
    target_id: str
    reason: Literal["spam", "incorrect", "abuse", "unsafe", "closed", "other"]
    description: str = Field(default="", max_length=1000)
    contact_email: EmailStr | None = None


class ModerationActionIn(BaseModel):
    status: Literal["investigating", "resolved", "dismissed"]
    action: Literal["none", "hide"] = "none"
    admin_note: str = Field(default="", max_length=1000)
