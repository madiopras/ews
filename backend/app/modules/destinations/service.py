"""Business orchestration for destination discovery and administration."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.modules.destinations.exceptions import (
    DestinationNotFound,
    DestinationValidationError,
)
from app.modules.destinations.mapper import (
    destination_document_to_response,
    destination_document_to_suggestion,
)
from app.modules.destinations.ports import (
    DestinationReadRepository,
    DestinationWriteRepository,
)
from app.modules.destinations.schemas import (
    DestinationAdminPage,
    DestinationIn,
    DestinationOut,
    DestinationPublicPage,
    DestinationSuggestion,
)
from app.shared.urls import safe_public_http_url

ADMIN_SORTS = {
    "name": ("name", 1),
    "-name": ("name", -1),
    "location": ("location", 1),
    "-location": ("location", -1),
    "price": ("price", 1),
    "-price": ("price", -1),
    "created_at": ("created_at", 1),
    "-created_at": ("created_at", -1),
    "updated_at": ("updated_at", 1),
    "-updated_at": ("updated_at", -1),
}


class DestinationService:
    """Apply public visibility, normalization, and pagination rules."""

    def __init__(self, repository: DestinationReadRepository):
        self.repository = repository

    async def list_destinations(
        self,
        *,
        category: str | None,
        search: str | None,
        featured: bool | None,
    ) -> list[DestinationOut]:
        effective_category = category if category and category != "all" else None
        documents = await self.repository.list_public(
            category=effective_category,
            search=search,
            featured=featured,
            limit=500,
        )
        return [destination_document_to_response(document) for document in documents]

    async def search_destinations(
        self,
        *,
        query: str,
        category: str | None,
        location: str,
        sort: str,
        page: int,
        page_size: int,
    ) -> DestinationPublicPage:
        effective_page = max(1, page)
        effective_page_size = max(1, min(page_size, 48))
        search = query.strip()[:100]
        normalized_location = location.strip()[:200]
        documents, total = await self.repository.search_public(
            search=search,
            category=category,
            location=normalized_location,
            sort=sort,
            skip=(effective_page - 1) * effective_page_size,
            limit=effective_page_size,
        )
        return DestinationPublicPage(
            items=[
                destination_document_to_response(document) for document in documents
            ],
            total=total,
            page=effective_page,
            page_size=effective_page_size,
            pages=max(1, (total + effective_page_size - 1) // effective_page_size),
        )

    async def suggestions(
        self, *, query: str, limit: int
    ) -> list[DestinationSuggestion]:
        search = query.strip()[:100]
        if len(search) < 2:
            return []
        documents = await self.repository.suggestions(
            search=search,
            limit=max(1, min(limit, 10)),
        )
        return [destination_document_to_suggestion(document) for document in documents]

    async def locations(self) -> list[str]:
        values = await self.repository.locations()
        return sorted(
            {value.strip() for value in values if value.strip()}, key=str.casefold
        )

    async def batch(self, destination_ids: list[str]) -> list[DestinationOut]:
        unique_ids = list(dict.fromkeys(destination_ids))
        if not unique_ids:
            return []
        documents = await self.repository.batch_public(unique_ids)
        by_id = {str(document["_id"]): document for document in documents}
        return [
            destination_document_to_response(by_id[value])
            for value in unique_ids
            if value in by_id
        ]

    async def trending(self, *, days: int, limit: int) -> list[DestinationOut]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        documents = await self.repository.trending_public(since=since, limit=limit)
        return [destination_document_to_response(document) for document in documents]

    async def get_destination(self, destination_id: str) -> DestinationOut:
        document = await self.repository.get_public(destination_id)
        if document is None:
            raise DestinationNotFound("Not found")
        return destination_document_to_response(document)


class DestinationAdminService:
    """Own destination mutation policy independently from HTTP and MongoDB."""

    def __init__(self, repository: DestinationWriteRepository):
        self.repository = repository

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _payload_document(payload: DestinationIn) -> dict[str, Any]:
        document = payload.model_dump(mode="json")
        document["tags"] = list(
            dict.fromkeys(
                tag.strip().lower()[:50] for tag in payload.tags if tag.strip()
            )
        )
        source_url = (payload.source_url or "").strip()
        if source_url and not safe_public_http_url(source_url):
            raise DestinationValidationError("Invalid editorial source URL")
        document["source_url"] = source_url
        reviewed_at = (payload.editorial_reviewed_at or "").strip()
        if reviewed_at:
            try:
                datetime.fromisoformat(reviewed_at.replace("Z", "+00:00"))
            except ValueError as error:
                raise DestinationValidationError(
                    "Invalid editorial review date"
                ) from error
        document["editorial_reviewed_at"] = reviewed_at
        return document

    async def list_all(self) -> list[DestinationOut]:
        documents = await self.repository.list_admin(limit=1000)
        return [destination_document_to_response(document) for document in documents]

    async def search(
        self,
        *,
        query_text: str,
        category: str | None,
        status: str,
        featured: bool | None,
        min_price: float | None,
        max_price: float | None,
        page: int,
        page_size: int,
        sort: str,
    ) -> DestinationAdminPage:
        effective_page = max(1, page)
        effective_size = max(1, min(page_size, 100))
        if min_price is not None and min_price < 0:
            raise DestinationValidationError("Minimum price cannot be negative")
        if max_price is not None and max_price < 0:
            raise DestinationValidationError("Maximum price cannot be negative")
        if min_price is not None and max_price is not None and max_price < min_price:
            raise DestinationValidationError(
                "Maximum price must be greater than minimum price"
            )
        if sort not in ADMIN_SORTS:
            raise DestinationValidationError("Invalid sort field")

        query: dict[str, Any] = {}
        search = query_text.strip()[:100]
        if search:
            pattern = re.escape(search)
            query["$or"] = [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"name_en": {"$regex": pattern, "$options": "i"}},
                {"location": {"$regex": pattern, "$options": "i"}},
            ]
        if category:
            query["category"] = category
        if status == "active":
            query["is_active"] = {"$ne": False}
        elif status == "inactive":
            query["is_active"] = False
        if featured is not None:
            query["featured"] = featured
        if min_price is not None or max_price is not None:
            query["price"] = {}
            if min_price is not None:
                query["price"]["$gte"] = min_price
            if max_price is not None:
                query["price"]["$lte"] = max_price

        sort_field, sort_direction = ADMIN_SORTS[sort]
        documents, total = await self.repository.search_admin(
            query=query,
            sort_field=sort_field,
            sort_direction=sort_direction,
            skip=(effective_page - 1) * effective_size,
            limit=effective_size,
        )
        return DestinationAdminPage(
            items=[destination_document_to_response(item) for item in documents],
            total=total,
            page=effective_page,
            page_size=effective_size,
            pages=(total + effective_size - 1) // effective_size,
        )

    async def get(self, destination_id: str) -> DestinationOut:
        document = await self.repository.get_admin(destination_id)
        if document is None:
            raise DestinationNotFound("Destination not found")
        return destination_document_to_response(document)

    async def create(
        self, payload: DestinationIn, actor: dict[str, Any]
    ) -> DestinationOut:
        now = self._now()
        document = {
            **self._payload_document(payload),
            "created_at": now,
            "updated_at": now,
        }
        created = await self.repository.create(document)
        destination_id = str(created["_id"])
        await self.repository.record_audit(
            actor,
            action="create",
            destination_id=destination_id,
            details={"name": created["name"]},
            created_at=now,
        )
        return destination_document_to_response(created)

    async def update(
        self, destination_id: str, payload: DestinationIn, actor: dict[str, Any]
    ) -> DestinationOut:
        changes = {**self._payload_document(payload), "updated_at": self._now()}
        updated = await self.repository.replace_fields(destination_id, changes)
        if updated is None:
            raise DestinationNotFound("Not found")
        await self.repository.record_audit(
            actor,
            action="update",
            destination_id=destination_id,
            details={"name": updated["name"]},
            created_at=self._now(),
        )
        return destination_document_to_response(updated)

    async def toggle(
        self, destination_id: str, actor: dict[str, Any]
    ) -> DestinationOut:
        updated = await self.repository.toggle_active(
            destination_id, updated_at=self._now()
        )
        if updated is None:
            raise DestinationNotFound("Not found")
        action = "activate" if updated.get("is_active", True) else "deactivate"
        await self.repository.record_audit(
            actor,
            action=action,
            destination_id=destination_id,
            details={"name": updated.get("name", "")},
            created_at=self._now(),
        )
        return destination_document_to_response(updated)

    async def delete(
        self, destination_id: str, actor: dict[str, Any]
    ) -> dict[str, bool]:
        deleted = await self.repository.delete(destination_id)
        if deleted is None:
            raise DestinationNotFound("Not found")
        await self.repository.record_audit(
            actor,
            action="delete",
            destination_id=destination_id,
            details={"name": deleted.get("name", "")},
            created_at=self._now(),
        )
        return {"ok": True}
