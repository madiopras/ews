"""Compatibility entrypoint; prefer ``app.main:app``."""

from app.main import app

__all__ = ["app"]
