"""Partner feature composition dependencies."""

from fastapi import Depends, Request

from app.api.dependencies import get_app_settings, get_database
from app.modules.partners.gateways import (
    PartnerNotificationGateway,
    PartnerStorageGateway,
)
from app.modules.partners.repository import MongoPartnerRepository
from app.modules.partners.service import PartnerService


def get_partner_repository(request: Request) -> MongoPartnerRepository:
    return MongoPartnerRepository(get_database(request))


def get_partner_storage(request: Request) -> PartnerStorageGateway:
    return PartnerStorageGateway(get_app_settings(request))


def get_partner_notifications(request: Request) -> PartnerNotificationGateway:
    return PartnerNotificationGateway(get_database(request), get_app_settings(request))


def get_partner_service(
    request: Request,
    repository: MongoPartnerRepository = Depends(get_partner_repository),
    storage: PartnerStorageGateway = Depends(get_partner_storage),
    notifications: PartnerNotificationGateway = Depends(get_partner_notifications),
) -> PartnerService:
    settings = get_app_settings(request)
    return PartnerService(
        repository,
        analytics_secret=settings.jwt_secret.get_secret_value(),
        storage=storage,
        notifications=notifications,
    )
