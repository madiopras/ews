"""Wishlist business use cases."""

from datetime import datetime, timezone
from typing import Any

from app.modules.destinations.mapper import destination_document_to_response
from app.modules.destinations.schemas import DestinationOut
from app.modules.wishlist.exceptions import WishlistError
from app.modules.wishlist.ports import WishlistRepository


class WishlistService:
    def __init__(self, repository: WishlistRepository):
        self.repository = repository

    async def list(self, user: dict[str, Any]) -> list[DestinationOut]:
        destination_ids = user.get("wishlist") or []
        if not destination_ids:
            return []
        documents = await self.repository.list_active(destination_ids)
        return [destination_document_to_response(document) for document in documents]

    async def add(self, destination_id: str, user: dict[str, Any]) -> dict[str, bool]:
        if not await self.repository.active_destination_exists(destination_id):
            raise WishlistError(404, "Destination not found")
        await self.repository.add(
            user["id"],
            destination_id,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        return {"ok": True}

    async def remove(
        self, destination_id: str, user: dict[str, Any]
    ) -> dict[str, bool]:
        await self.repository.remove(user["id"], destination_id)
        return {"ok": True}
