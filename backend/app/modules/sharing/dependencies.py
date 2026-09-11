from typing import Any

from fastapi import Depends

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.sharing.repository import SharingRepository
from app.modules.sharing.service import SharingService


def get_sharing_repository(database: Any = Depends(get_database)) -> SharingRepository:
    return SharingRepository(database)


def get_sharing_service(
    repository=Depends(get_sharing_repository),
    settings: Settings = Depends(get_app_settings),
) -> SharingService:
    return SharingService(repository, settings.public_app_url)
