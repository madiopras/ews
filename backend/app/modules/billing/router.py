"""Thin billing HTTP transport."""

from typing import Literal

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.billing.dependencies import get_payment_service, get_plan_service
from app.modules.billing.exceptions import BillingError
from app.modules.billing.schemas import PlanAdminPage, PlanIn, PlanOut, SnapTokenIn
from app.modules.billing.service import PaymentService, PlanService

router = APIRouter(prefix="/api")


async def billing_error_handler(request: Request, error: BillingError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {BillingError: billing_error_handler}


@router.get("/premium/plans", response_model=list[PlanOut])
async def list_public_plans(service: PlanService = Depends(get_plan_service)):
    return await service.public()


@router.get("/admin/premium/plans", response_model=PlanAdminPage)
async def list_admin_plans(
    q: str = "",
    status: Literal["all", "active", "inactive"] = "all",
    page: int = 1,
    page_size: int = 25,
    sort: str = "order",
    admin: dict = Depends(require_admin),
    service: PlanService = Depends(get_plan_service),
):
    del admin
    return await service.page(q, status, page, page_size, sort)


@router.post("/admin/premium/plans", response_model=PlanOut)
async def create_plan(
    payload: PlanIn,
    admin: dict = Depends(require_admin),
    service: PlanService = Depends(get_plan_service),
):
    return await service.create(payload, admin)


@router.put("/admin/premium/plans/{plan_id}", response_model=PlanOut)
async def update_plan(
    plan_id: str,
    payload: PlanIn,
    admin: dict = Depends(require_admin),
    service: PlanService = Depends(get_plan_service),
):
    return await service.update(plan_id, payload, admin)


@router.delete("/admin/premium/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    admin: dict = Depends(require_admin),
    service: PlanService = Depends(get_plan_service),
):
    return await service.delete(plan_id, admin)


@router.get("/payments/config")
async def payments_config(service: PaymentService = Depends(get_payment_service)):
    return service.public_config()


@router.post("/payments/snap-token")
async def create_snap_token(
    payload: SnapTokenIn,
    user: dict = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.create_token(payload, user)


@router.post("/payments/midtrans/notification")
async def midtrans_notification(
    request: Request, service: PaymentService = Depends(get_payment_service)
):
    try:
        body = await request.json()
    except ValueError as error:
        raise BillingError(400, "Invalid notification") from error
    return await service.notification(body)


@router.get("/payments/{order_id}/status")
async def payment_status(
    order_id: str,
    user: dict = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.status(order_id, user)


@router.get("/mitra/partners/{partner_id}/payments")
async def list_my_partner_payments(
    partner_id: str,
    user: dict = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.history(partner_id, user)


@router.post("/mitra/partners/{partner_id}/payments/{order_id}/retry")
async def retry_my_partner_payment(
    partner_id: str,
    order_id: str,
    user: dict = Depends(get_current_user),
    service: PaymentService = Depends(get_payment_service),
):
    return await service.retry(partner_id, order_id, user)
