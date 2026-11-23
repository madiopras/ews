"""Request and response contracts for affiliate and Tiket.com Partner API V2."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AffiliateEnvironment = Literal["sandbox", "production"]
AffiliateMode = Literal["miniapp", "direct_api_v2", "campaign_link"]
AffiliateProduct = Literal["hotel", "flight"]
AffiliateSource = Literal["planner", "destination", "partners"]
SecretAction = Literal["preserve", "replace", "remove"]


class AffiliateCardOut(BaseModel):
    provider: Literal["tiket"] = "tiket"
    product: AffiliateProduct
    zone: str
    mode: AffiliateMode
    title: str
    subtitle: str
    badge: str
    cta_label: str
    destination_label: str
    airport_code: str | None = None
    airport_name: str | None = None
    accommodation_area: str | None = None
    launch_type: Literal["miniapp_session", "redirect"]
    go_url: str | None = None
    sub_id: str
    disclosure: str


class AffiliateRecommendationsOut(BaseModel):
    enabled: bool
    provider: Literal["tiket"] = "tiket"
    environment: AffiliateEnvironment = "sandbox"
    mode: AffiliateMode = "miniapp"
    disclosure: str = ""
    items: list[AffiliateCardOut] = Field(default_factory=list)


class MiniAppSessionIn(BaseModel):
    product: AffiliateProduct
    zone: str = Field(default="medan_deli", max_length=64)
    source: AffiliateSource = "planner"
    lang: Literal["id", "en"] = "id"
    use_autologin: bool = False
    phone_number: str | None = Field(default=None, max_length=32)


class MiniAppSessionOut(BaseModel):
    provider: Literal["tiket"] = "tiket"
    product: AffiliateProduct
    environment: AffiliateEnvironment
    launch_url: str
    sub_id: str
    expires_hint_seconds: int = 300


class TiketProductsEnabledIn(BaseModel):
    hotel: bool = True
    flight: bool = True


class TiketAffiliateConfigIn(BaseModel):
    enabled: bool = False
    environment: AffiliateEnvironment = "sandbox"
    mode: AffiliateMode = "miniapp"
    partner_identifier: str = Field(default="", max_length=120)
    partner_slug: str = Field(default="", max_length=120)
    affiliate_id: str = Field(default="", max_length=120)
    campaign_url_template: str = Field(default="", max_length=600)
    miniapp_production_base_url: str = Field(default="", max_length=300)
    products_enabled: TiketProductsEnabledIn = Field(
        default_factory=TiketProductsEnabledIn
    )
    allowed_redirect_hosts: list[str] = Field(default_factory=list, max_length=20)
    miniapp_api_key_action: SecretAction = "preserve"
    miniapp_api_key: str | None = Field(default=None, max_length=2000)
    miniapp_rsa_public_key_action: SecretAction = "preserve"
    miniapp_rsa_public_key: str | None = Field(default=None, max_length=8000)
    hotel_v2_auth_action: SecretAction = "preserve"
    hotel_v2_auth: str | None = Field(default=None, max_length=2000)
    flight_v2_api_key_action: SecretAction = "preserve"
    flight_v2_api_key: str | None = Field(default=None, max_length=2000)


class TiketAffiliateConfigOut(BaseModel):
    provider: Literal["tiket"] = "tiket"
    enabled: bool = False
    environment: AffiliateEnvironment = "sandbox"
    mode: AffiliateMode = "miniapp"
    partner_identifier: str = ""
    partner_slug: str = ""
    affiliate_id: str = ""
    campaign_url_template: str = ""
    miniapp_production_base_url: str = ""
    products_enabled: TiketProductsEnabledIn = Field(
        default_factory=TiketProductsEnabledIn
    )
    allowed_redirect_hosts: list[str] = Field(default_factory=list)
    has_miniapp_api_key: bool = False
    has_miniapp_rsa_public_key: bool = False
    has_hotel_v2_auth: bool = False
    has_flight_v2_api_key: bool = False
    api_base_url: str
    miniapp_base_url: str
    ready_for_launch: bool = False
    readiness_notes: list[str] = Field(default_factory=list)
    updated_at: str = ""


class TiketAffiliatePreviewIn(BaseModel):
    zone: str = Field(default="toba_samosir", max_length=64)
    product: AffiliateProduct = "hotel"
    lang: Literal["id", "en"] = "id"
    live_token_test: bool = False


class TiketAffiliatePreviewOut(BaseModel):
    mode: AffiliateMode
    environment: AffiliateEnvironment
    product: AffiliateProduct
    zone: str
    api_base_url: str
    preview_url: str
    sub_id: str
    ready: bool
    readiness_notes: list[str] = Field(default_factory=list)
    live_test_status: Literal["skipped", "ok", "error"] = "skipped"
    live_test_message: str = ""
    card: AffiliateCardOut


class AffiliateAnalyticsBucketOut(BaseModel):
    key: str
    count: int


class AffiliateAnalyticsOut(BaseModel):
    days: int
    total_clicks: int
    by_product: list[AffiliateAnalyticsBucketOut] = Field(default_factory=list)
    by_zone: list[AffiliateAnalyticsBucketOut] = Field(default_factory=list)
    by_source: list[AffiliateAnalyticsBucketOut] = Field(default_factory=list)
    by_mode: list[AffiliateAnalyticsBucketOut] = Field(default_factory=list)
