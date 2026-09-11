"""Repository boundaries consumed by destination services."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any, Protocol

DestinationDocument = dict[str, Any]


class DestinationReadRepository(Protocol):
    async def list_public(
        self,
        *,
        category: str | None,
        search: str | None,
        featured: bool | None,
        limit: int,
    ) -> list[DestinationDocument]: ...

    async def search_public(
        self,
        *,
        search: str,
        category: str | None,
        location: str,
        sort: str,
        skip: int,
        limit: int,
    ) -> tuple[list[DestinationDocument], int]: ...

    async def suggestions(
        self, *, search: str, limit: int
    ) -> list[DestinationDocument]: ...

    async def locations(self) -> list[str]: ...

    async def batch_public(
        self, destination_ids: Sequence[str]
    ) -> list[DestinationDocument]: ...

    async def trending_public(
        self, *, since: datetime, limit: int
    ) -> list[DestinationDocument]: ...

    async def get_public(self, destination_id: str) -> DestinationDocument | None: ...


class DestinationWriteRepository(Protocol):
    async def list_admin(self, *, limit: int) -> list[DestinationDocument]: ...

    async def search_admin(
        self,
        *,
        query: dict[str, Any],
        sort_field: str,
        sort_direction: int,
        skip: int,
        limit: int,
    ) -> tuple[list[DestinationDocument], int]: ...

    async def get_admin(self, destination_id: str) -> DestinationDocument | None: ...

    async def create(self, document: DestinationDocument) -> DestinationDocument: ...

    async def replace_fields(
        self, destination_id: str, changes: DestinationDocument
    ) -> DestinationDocument | None: ...

    async def toggle_active(
        self, destination_id: str, *, updated_at: str
    ) -> DestinationDocument | None: ...

    async def delete(self, destination_id: str) -> DestinationDocument | None: ...

    async def record_audit(
        self,
        actor: dict[str, Any],
        *,
        action: str,
        destination_id: str,
        details: dict[str, Any],
        created_at: str,
    ) -> None: ...
