"""Thin HTTP and SSE transport for the AI Trip Planner."""

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.responses import JSONResponse

from app.api.dependencies import get_app_settings
from app.core import security
from app.core.config import Settings
from app.modules.auth.dependencies import get_optional_user
from app.modules.planner.dependencies import (
    get_planner_analytics_service,
    get_planner_generation_service,
    get_planner_quota_service,
    get_planner_settings,
)
from app.modules.planner.exceptions import PlannerError
from app.modules.planner.gateways import PlannerSettingsGateway
from app.modules.planner.schemas import PlannerAnalyticsEventIn, TripPlanIn
from app.modules.planner.service import (
    PlannerAnalyticsService,
    PlannerGenerationService,
    PlannerQuotaService,
)
from app.modules.planner.sse import encode_sse_stream

router = APIRouter(prefix="/api")


async def planner_error_handler(request: Request, error: PlannerError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {PlannerError: planner_error_handler}


@router.post("/analytics/planner-events")
async def track_planner_event(
    payload: PlannerAnalyticsEventIn,
    request: Request,
    service: PlannerAnalyticsService = Depends(get_planner_analytics_service),
):
    """Store aggregate planner-funnel telemetry, never the user's planner story."""
    return await service.track(
        payload,
        request.headers.get("x-analytics-consent", "").lower() == "granted",
    )


@router.get("/planner/quota")
async def planner_quota(
    request: Request,
    response: Response,
    user: dict | None = Depends(get_optional_user),
    planner_settings: PlannerSettingsGateway = Depends(get_planner_settings),
    service: PlannerQuotaService = Depends(get_planner_quota_service),
    settings: Settings = Depends(get_app_settings),
):
    result, cookie_token, ttl_days = await service.status(
        user,
        request.cookies.get(security.PLANNER_GUEST_COOKIE),
        await planner_settings.read(),
    )
    if cookie_token:
        security.set_planner_guest_cookie(
            response, cookie_token, ttl_days, settings.cookie_secure
        )
    return result


@router.post("/trip-planner/stream")
async def trip_planner_stream(
    payload: TripPlanIn,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    service: PlannerGenerationService = Depends(get_planner_generation_service),
    settings: Settings = Depends(get_app_settings),
):
    stream = await service.prepare(
        payload,
        user,
        request.cookies.get(security.PLANNER_GUEST_COOKIE),
        request.client.host if request.client else "unknown",
    )
    response = StreamingResponse(
        encode_sse_stream(stream.events, stream.metrics),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
    if stream.cookie_token:
        security.set_planner_guest_cookie(
            response,
            stream.cookie_token,
            stream.cookie_ttl_days,
            settings.cookie_secure,
        )
    return response
