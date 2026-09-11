"""Top-level API router aggregation."""

from __future__ import annotations

from collections.abc import Iterable

from fastapi import APIRouter, FastAPI


def register_routers(application: FastAPI, routers: Iterable[APIRouter]) -> None:
    """Register feature routers in their supplied, contract-sensitive order."""

    for router in routers:
        application.include_router(router)
