"""Portable runtime configuration for API integration tests."""

import os
from pathlib import Path

from dotenv import dotenv_values


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def backend_url() -> str:
    frontend_env = dotenv_values(PROJECT_ROOT / "frontend" / ".env")
    return (
        os.environ.get("REACT_APP_BACKEND_URL")
        or frontend_env.get("REACT_APP_BACKEND_URL")
        or "http://127.0.0.1:8000"
    ).rstrip("/")


def backend_environment() -> dict:
    values = dict(dotenv_values(PROJECT_ROOT / "backend" / ".env"))
    for key in ("JWT_SECRET", "MONGO_URL", "DB_NAME"):
        if os.environ.get(key):
            values[key] = os.environ[key]
    return values

