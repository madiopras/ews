"""FastAPI application factory and canonical production composition root."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
from contextlib import AbstractAsyncContextManager
from typing import Any

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.router import register_routers
from app.core.config import Settings

LifecycleHandler = Callable[[], Awaitable[None] | None]
ExceptionHandlerMap = Mapping[type[Exception] | int, Callable[..., Any]]
Lifespan = Callable[[FastAPI], AbstractAsyncContextManager[Any]]


def create_app(
    *,
    api_routers: Sequence[APIRouter] = (),
    health_endpoint: Callable[..., Any] | None = None,
    startup_handlers: Sequence[LifecycleHandler] = (),
    shutdown_handlers: Sequence[LifecycleHandler] = (),
    exception_handlers: ExceptionHandlerMap | None = None,
    cors_origins: Sequence[str] = ("*",),
    title: str = "Explore Wisata Sumut API",
    lifespan: Lifespan | None = None,
    settings: Settings | None = None,
) -> FastAPI:
    """Create one fully wired FastAPI application instance.

    Dependencies are supplied explicitly so tests can build isolated apps and
    production can bind typed settings plus a lifespan-owned MongoDB client.
    """

    application = FastAPI(title=title, lifespan=lifespan)
    if settings is not None:
        application.state.settings = settings

    for handler in startup_handlers:
        application.add_event_handler("startup", handler)
    for handler in shutdown_handlers:
        application.add_event_handler("shutdown", handler)

    if health_endpoint is not None:
        application.add_api_route("/health", health_endpoint, methods=["GET"])

    register_routers(application, api_routers)
    register_exception_handlers(application, exception_handlers or {})

    application.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=list(cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return application


def create_application(settings: Settings | None = None) -> FastAPI:
    """Build the production application from modular feature routers."""
    from app.api.system import health
    from app.api.system import router as system_router
    from app.core.config import get_settings
    from app.infrastructure.database.mongo import create_mongo_lifespan
    from app.infrastructure.database.startup import initialize_application
    from app.modules.administration.router import (
        EXCEPTION_HANDLERS as ADMINISTRATION_HANDLERS,
    )
    from app.modules.administration.router import router as administration_router
    from app.modules.auth.router import EXCEPTION_HANDLERS as AUTH_HANDLERS
    from app.modules.auth.router import router as auth_router
    from app.modules.backups.router import EXCEPTION_HANDLERS as BACKUP_HANDLERS
    from app.modules.backups.router import router as backup_router
    from app.modules.billing.router import EXCEPTION_HANDLERS as BILLING_HANDLERS
    from app.modules.billing.router import router as billing_router
    from app.modules.destinations.router import (
        EXCEPTION_HANDLERS as DESTINATION_HANDLERS,
    )
    from app.modules.destinations.router import router as destination_router
    from app.modules.itineraries.router import EXCEPTION_HANDLERS as ITINERARY_HANDLERS
    from app.modules.itineraries.router import router as itinerary_router
    from app.modules.media.router import EXCEPTION_HANDLERS as MEDIA_HANDLERS
    from app.modules.media.router import router as media_router
    from app.modules.partners.router import EXCEPTION_HANDLERS as PARTNER_HANDLERS
    from app.modules.partners.router import router as partner_router
    from app.modules.planner.router import EXCEPTION_HANDLERS as PLANNER_HANDLERS
    from app.modules.planner.router import router as planner_router
    from app.modules.reviews.router import EXCEPTION_HANDLERS as REVIEW_HANDLERS
    from app.modules.reviews.router import router as review_router
    from app.modules.sharing.router import EXCEPTION_HANDLERS as SHARING_HANDLERS
    from app.modules.sharing.router import router as sharing_router
    from app.modules.wishlist.router import EXCEPTION_HANDLERS as WISHLIST_HANDLERS
    from app.modules.wishlist.router import router as wishlist_router

    runtime = settings or get_settings()
    return create_app(
        api_routers=(
            system_router,
            auth_router,
            destination_router,
            wishlist_router,
            review_router,
            itinerary_router,
            partner_router,
            administration_router,
            planner_router,
            backup_router,
            billing_router,
            media_router,
            sharing_router,
        ),
        health_endpoint=health,
        exception_handlers={
            **AUTH_HANDLERS,
            **DESTINATION_HANDLERS,
            **WISHLIST_HANDLERS,
            **REVIEW_HANDLERS,
            **ITINERARY_HANDLERS,
            **PARTNER_HANDLERS,
            **ADMINISTRATION_HANDLERS,
            **PLANNER_HANDLERS,
            **BACKUP_HANDLERS,
            **BILLING_HANDLERS,
            **MEDIA_HANDLERS,
            **SHARING_HANDLERS,
        },
        cors_origins=runtime.cors_origin_list,
        lifespan=create_mongo_lifespan(
            runtime,
            startup_handlers=(initialize_application,),
        ),
        settings=runtime,
    )


app = create_application()
