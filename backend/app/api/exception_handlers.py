"""Application exception-handler registration."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from fastapi import FastAPI


def register_exception_handlers(
    application: FastAPI,
    handlers: Mapping[type[Exception] | int, Callable[..., Any]],
) -> None:
    """Register explicit exception mappings at the HTTP boundary."""

    for exception_or_status, handler in handlers.items():
        application.add_exception_handler(exception_or_status, handler)
