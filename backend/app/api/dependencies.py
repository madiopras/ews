"""Application-level FastAPI dependency providers."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, Request

from app.core.config import Settings
from app.modules.destinations.repository import MongoDestinationRepository
from app.modules.destinations.service import DestinationAdminService, DestinationService


def get_database(request: Request) -> Any:
    """Return the lifespan-owned database for request-scoped dependencies."""

    database = getattr(request.app.state, "database", None)
    if database is None:
        raise RuntimeError("MongoDB is not available outside the application lifespan")
    return database


def get_app_settings(request: Request) -> Settings:
    """Return the validated settings bound by the composition root."""

    settings = getattr(request.app.state, "settings", None)
    if settings is None:
        raise RuntimeError("Application settings are not configured")
    return settings


def get_destination_repository(
    database: Any = Depends(get_database),
) -> MongoDestinationRepository:
    """Build the MongoDB adapter at the request composition boundary."""

    return MongoDestinationRepository(database)


def get_destination_service(
    repository: MongoDestinationRepository = Depends(get_destination_repository),
) -> DestinationService:
    """Build an isolated destination service for one request."""

    return DestinationService(repository)


def get_destination_admin_service(
    repository: MongoDestinationRepository = Depends(get_destination_repository),
) -> DestinationAdminService:
    """Build the admin destination use cases at the composition boundary."""

    return DestinationAdminService(repository)
