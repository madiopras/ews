"""FastAPI dependency composition for the affiliates module."""

from __future__ import annotations

from typing import Any

from fastapi import Depends

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.administration.dependencies import get_audit_service
from app.modules.affiliates.gateways import (
    AffiliateCryptoGateway,
    TiketPartnerApiGateway,
)
from app.modules.affiliates.repositories import (
    AffiliateAnalyticsRepository,
    AffiliateConfigRepository,
    AffiliateDestinationRepository,
    AffiliateSettingsReader,
)
from app.modules.affiliates.service import AffiliateService


def get_affiliate_config_repository(
    database: Any = Depends(get_database),
) -> AffiliateConfigRepository:
    return AffiliateConfigRepository(database)


def get_affiliate_analytics_repository(
    database: Any = Depends(get_database),
) -> AffiliateAnalyticsRepository:
    return AffiliateAnalyticsRepository(database)


def get_affiliate_destination_repository(
    database: Any = Depends(get_database),
) -> AffiliateDestinationRepository:
    return AffiliateDestinationRepository(database)


def get_affiliate_settings_reader(
    database: Any = Depends(get_database),
) -> AffiliateSettingsReader:
    return AffiliateSettingsReader(database)


def get_affiliate_crypto_gateway(
    settings: Settings = Depends(get_app_settings),
) -> AffiliateCryptoGateway:
    return AffiliateCryptoGateway(settings)


def get_tiket_partner_api_gateway(
    crypto: AffiliateCryptoGateway = Depends(get_affiliate_crypto_gateway),
) -> TiketPartnerApiGateway:
    return TiketPartnerApiGateway(crypto)


def get_affiliate_service(
    config_repo: AffiliateConfigRepository = Depends(get_affiliate_config_repository),
    analytics_repo: AffiliateAnalyticsRepository = Depends(
        get_affiliate_analytics_repository
    ),
    destination_repo: AffiliateDestinationRepository = Depends(
        get_affiliate_destination_repository
    ),
    settings_reader: AffiliateSettingsReader = Depends(get_affiliate_settings_reader),
    crypto: AffiliateCryptoGateway = Depends(get_affiliate_crypto_gateway),
    tiket_gateway: TiketPartnerApiGateway = Depends(get_tiket_partner_api_gateway),
    audit: Any = Depends(get_audit_service),
) -> AffiliateService:
    return AffiliateService(
        config_repo=config_repo,
        analytics_repo=analytics_repo,
        destination_repo=destination_repo,
        settings_reader=settings_reader,
        crypto_gateway=crypto,
        tiket_gateway=tiket_gateway,
        audit=audit,
    )
