"""Mapping and redaction for authenticated user data."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.modules.auth.schemas import UserOut


def user_document_to_response(user: Mapping[str, Any]) -> UserOut:
    provider = user.get("auth_provider") or (
        "password" if user.get("password_hash") else "google"
    )
    return UserOut(
        id=str(user.get("_id") or user.get("id")),
        email=user.get("email", ""),
        name=user.get("name", ""),
        role=user.get("role", "user"),
        email_verified=bool(user.get("email_verified", provider == "google")),
        auth_provider=provider,
        preferred_language=user.get("preferred_language", "id"),
        interests=user.get("interests", []),
        home_city=user.get("home_city", ""),
        created_at=user.get("created_at", ""),
    )


def authenticated_user(user: Mapping[str, Any]) -> dict[str, Any]:
    """Copy a persisted user into the legacy-compatible request identity."""

    identity = dict(user)
    identity["id"] = str(identity.pop("_id"))
    identity.pop("password_hash", None)
    return identity
