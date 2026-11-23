"""Thin HTTP transport for affiliate recommendations, safe redirect, and admin settings."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from starlette.responses import JSONResponse, RedirectResponse

from app.modules.affiliates.dependencies import get_affiliate_service
from app.modules.affiliates.exceptions import AffiliateError
from app.modules.affiliates.schemas import (
    AffiliateAnalyticsOut,
    AffiliateProduct,
    AffiliateRecommendationsOut,
    AffiliateSource,
    MiniAppSessionIn,
    MiniAppSessionOut,
    TiketAffiliateConfigIn,
    TiketAffiliateConfigOut,
    TiketAffiliatePreviewIn,
    TiketAffiliatePreviewOut,
)
from app.modules.affiliates.service import AffiliateService
from app.modules.auth.dependencies import get_optional_user, require_admin

router = APIRouter(prefix="/api")


async def affiliate_error_handler(
    request: Request, error: AffiliateError
) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {AffiliateError: affiliate_error_handler}


def _analytics_context(request: Request) -> tuple[str, bool]:
    anonymous_id = (
        request.headers.get("X-EWS-Anonymous-Id")
        or request.cookies.get("ews_anon_id")
        or ""
    ).strip()[:120]
    consent = request.headers.get("X-EWS-Analytics-Consent", "").lower() == "true"
    return anonymous_id, consent


@router.get("/affiliates/recommendations", response_model=AffiliateRecommendationsOut)
async def list_affiliate_recommendations(
    zones: str = Query(default="", max_length=200),
    destination_ids: str = Query(default="", max_length=600),
    starting_point: str | None = Query(default=None, max_length=32),
    source: AffiliateSource = "planner",
    lang: Literal["id", "en"] = "id",
    user: dict | None = Depends(get_optional_user),
    service: AffiliateService = Depends(get_affiliate_service),
):
    zone_list = [item.strip() for item in zones.split(",") if item.strip()]
    dest_list = [item.strip() for item in destination_ids.split(",") if item.strip()]
    return await service.recommendations(
        user=user,
        zones=zone_list,
        destination_ids=dest_list,
        starting_point=starting_point,
        source=source,
        lang=lang,
    )


@router.post("/affiliates/tiket/miniapp-session", response_model=MiniAppSessionOut)
async def create_tiket_miniapp_session(
    payload: MiniAppSessionIn,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    service: AffiliateService = Depends(get_affiliate_service),
):
    anonymous_id, consent = _analytics_context(request)
    return await service.create_miniapp_session(
        payload,
        user=user,
        anonymous_id=anonymous_id,
        analytics_consent=consent,
    )


@router.get("/affiliates/go")
async def redirect_affiliate_link(
    request: Request,
    provider: Literal["tiket"] = "tiket",
    product: AffiliateProduct = "hotel",
    zone: str = Query(default="medan_deli", max_length=64),
    source: AffiliateSource = "planner",
    user: dict | None = Depends(get_optional_user),
    service: AffiliateService = Depends(get_affiliate_service),
):
    anonymous_id, consent = _analytics_context(request)
    target_url = await service.resolve_redirect(
        user=user,
        provider=provider,
        product=product,
        zone=zone,
        source=source,
        anonymous_id=anonymous_id,
        analytics_consent=consent,
    )
    return RedirectResponse(url=target_url, status_code=302)


@router.get("/admin/affiliates/tiket", response_model=TiketAffiliateConfigOut)
async def read_admin_tiket_affiliate_config(
    admin: dict = Depends(require_admin),
    service: AffiliateService = Depends(get_affiliate_service),
):
    del admin
    return await service.get_admin_config()


@router.put("/admin/affiliates/tiket", response_model=TiketAffiliateConfigOut)
async def update_admin_tiket_affiliate_config(
    payload: TiketAffiliateConfigIn,
    admin: dict = Depends(require_admin),
    service: AffiliateService = Depends(get_affiliate_service),
):
    return await service.update_admin_config(payload, admin)


@router.post("/admin/affiliates/tiket/preview", response_model=TiketAffiliatePreviewOut)
async def preview_admin_tiket_affiliate_config(
    payload: TiketAffiliatePreviewIn,
    admin: dict = Depends(require_admin),
    service: AffiliateService = Depends(get_affiliate_service),
):
    del admin
    return await service.preview_admin_config(payload)


@router.get("/admin/affiliates/analytics", response_model=AffiliateAnalyticsOut)
async def read_admin_affiliate_analytics(
    days: int = Query(default=30, ge=1, le=90),
    admin: dict = Depends(require_admin),
    service: AffiliateService = Depends(get_affiliate_service),
):
    del admin
    return await service.analytics_summary(days)
