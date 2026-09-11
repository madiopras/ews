from typing import Any

from fastapi import Depends

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.modules.administration.dependencies import get_audit_service
from app.modules.backups.gateway import BackupFileGateway
from app.modules.backups.repository import BackupRepository
from app.modules.backups.service import BackupService


def get_backup_repository(database: Any = Depends(get_database)) -> BackupRepository:
    return BackupRepository(database)


def get_backup_files(
    settings: Settings = Depends(get_app_settings),
) -> BackupFileGateway:
    return BackupFileGateway(settings.backup_dir, settings.mongo_url, settings.db_name)


def get_backup_service(
    repository=Depends(get_backup_repository),
    files=Depends(get_backup_files),
    audit=Depends(get_audit_service),
) -> BackupService:
    return BackupService(repository, files, audit)
