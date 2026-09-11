"""Review persistence boundary."""

from typing import Any, Protocol


class ReviewRepository(Protocol):
    async def list_visible(self, destination_id: str) -> list[dict[str, Any]]: ...

    async def active_destination_exists(self, destination_id: str) -> bool: ...

    async def create(self, document: dict[str, Any]) -> dict[str, Any]: ...

    async def get(self, review_id: str) -> dict[str, Any] | None: ...

    async def update_owned(
        self, review_id: str, user_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None: ...

    async def delete_authorized(
        self, review_id: str, user_id: str, *, is_admin: bool
    ) -> bool: ...
