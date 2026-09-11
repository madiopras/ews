from typing import Any

from fastapi import Depends

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.administration.dependencies import get_audit_service
from app.modules.media.gateways import ObjectStorageGateway
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService


def get_media_repository(database: Any = Depends(get_database)) -> MediaRepository:
    return MediaRepository(database)


def get_object_storage(
    settings: Settings = Depends(get_app_settings),
) -> ObjectStorageGateway:
    return ObjectStorageGateway(settings)


def get_media_service(
    repository=Depends(get_media_repository),
    storage=Depends(get_object_storage),
    audit=Depends(get_audit_service),
    settings: Settings = Depends(get_app_settings),
) -> MediaService:
    return MediaService(repository, storage, audit, settings.storage_app_name)
