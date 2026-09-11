"""Billing composition dependencies."""

from typing import Any

from fastapi import Depends

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.administration.dependencies import get_audit_service
from app.modules.billing.gateways import MidtransGateway
from app.modules.billing.repositories import PaymentRepository, PlanRepository
from app.modules.billing.service import PaymentService, PlanService


def get_plan_repository(database: Any = Depends(get_database)) -> PlanRepository:
    return PlanRepository(database)


def get_payment_repository(database: Any = Depends(get_database)) -> PaymentRepository:
    return PaymentRepository(database)


def get_midtrans_gateway(
    settings: Settings = Depends(get_app_settings),
) -> MidtransGateway:
    return MidtransGateway(settings)


def get_plan_service(
    repository=Depends(get_plan_repository), audit=Depends(get_audit_service)
) -> PlanService:
    return PlanService(repository, audit)


def get_payment_service(
    plans=Depends(get_plan_repository),
    payments=Depends(get_payment_repository),
    gateway=Depends(get_midtrans_gateway),
) -> PaymentService:
    return PaymentService(plans, payments, gateway)
