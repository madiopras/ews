"""FastAPI-owned MongoDB client lifecycle."""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable, Sequence
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import Settings

LifecycleHandler = Callable[..., Awaitable[None] | None]
ResourceBinder = Callable[[Any | None, Any | None], None]
ClientFactory = Callable[[str], Any]


async def _invoke(handler: LifecycleHandler, application: FastAPI) -> None:
    parameters = inspect.signature(handler).parameters
    result = handler(application) if parameters else handler()
    if inspect.isawaitable(result):
        await result


def create_mongo_lifespan(
    settings: Settings,
    *,
    startup_handlers: Sequence[LifecycleHandler] = (),
    shutdown_handlers: Sequence[LifecycleHandler] = (),
    bind_resources: ResourceBinder | None = None,
    client_factory: ClientFactory = AsyncIOMotorClient,
):
    """Build a lifespan that owns exactly one MongoDB client per app instance."""

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        client = client_factory(settings.mongo_url)
        database = client[settings.db_name]
        application.state.mongo_client = client
        application.state.database = database
        if bind_resources is not None:
            bind_resources(client, database)

        startup_complete = False
        try:
            for handler in startup_handlers:
                await _invoke(handler, application)
            startup_complete = True
            yield
        finally:
            try:
                if startup_complete:
                    for handler in shutdown_handlers:
                        await _invoke(handler, application)
            finally:
                try:
                    client.close()
                finally:
                    application.state.mongo_client = None
                    application.state.database = None
                    if bind_resources is not None:
                        bind_resources(None, None)

    return lifespan
