"""Ports consumed by authentication and account use cases."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, Protocol

UserDocument = dict[str, Any]


class UserRepository(Protocol):
    async def find_by_id(
        self, user_id: str, *, active_only: bool = False
    ) -> UserDocument | None: ...

    async def find_by_email(
        self, email: str, *, active_only: bool = False
    ) -> UserDocument | None: ...

    async def find_by_google_id(self, google_id: str) -> UserDocument | None: ...

    async def insert(self, document: UserDocument) -> UserDocument: ...

    async def update_google_identity(
        self, user_id: str, changes: Mapping[str, Any]
    ) -> UserDocument: ...

    async def update_password_if_version(
        self,
        user_id: str,
        current_version: int,
        password_hash: str,
        session_version: int,
        updated_at: str,
    ) -> bool: ...

    async def delete_sessions(self, user_id: str) -> None: ...

    async def mark_email_verified(self, user_id: str, verified_at: str) -> None: ...

    async def increment_verification_version(self, user_id: str) -> UserDocument: ...

    async def update_profile(
        self,
        user_id: str,
        *,
        name: str,
        preferred_language: str,
        interests: Sequence[str],
        home_city: str,
        updated_at: str,
    ) -> UserDocument: ...

    async def export_account(self, user_id: str) -> dict[str, Any]: ...

    async def delete_account_graph(
        self, user_id: str, email: str, deleted_at: str
    ) -> None: ...


class RateLimitRepository(Protocol):
    async def increment(
        self,
        *,
        action: str,
        identifier: str,
        bucket: int,
        now: datetime,
        window_seconds: int,
    ) -> int: ...


class AuthEmailGateway(Protocol):
    async def send_verification(self, user: Mapping[str, Any], token: str) -> None: ...

    async def send_password_reset(
        self, user: Mapping[str, Any], token: str
    ) -> None: ...


class GoogleIdentityGateway(Protocol):
    async def verify(self, credential: str) -> dict[str, str]: ...
