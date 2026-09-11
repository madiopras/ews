"""Persistence boundary for wishlist use cases."""

from typing import Any, Protocol


class WishlistRepository(Protocol):
    async def list_active(self, destination_ids: list[str]) -> list[dict[str, Any]]: ...

    async def active_destination_exists(self, destination_id: str) -> bool: ...

    async def add(
        self, user_id: str, destination_id: str, *, created_at: str
    ) -> None: ...

    async def remove(self, user_id: str, destination_id: str) -> None: ...
