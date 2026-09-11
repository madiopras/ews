"""Saved itinerary use cases, ownership, and visibility rules."""

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from app.modules.itineraries.exceptions import ItineraryError
from app.modules.itineraries.hydration import PlannerResultHydrator
from app.modules.itineraries.mapper import (
    itinerary_document_to_public_response,
    itinerary_document_to_response,
)
from app.modules.itineraries.ports import ItineraryRepository
from app.modules.itineraries.schemas import (
    ItineraryDuplicateIn,
    ItineraryIn,
    ItineraryOut,
    ItineraryUpdateIn,
    PublicItineraryOut,
)
from app.shared.planner_result import PlannerStoredResultV2

STRUCTURED_DESTINATIONS_CHANGED = (
    "Structured itinerary destinations cannot be changed without a new result"
)


class ItineraryService:
    def __init__(self, repository: ItineraryRepository):
        self.repository = repository
        self.hydrator = PlannerResultHydrator(repository)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    async def _destination_ids(self, values: list[str]) -> list[str]:
        unique = list(dict.fromkeys(values))
        if not unique:
            return []
        valid = await self.repository.active_destination_ids(unique)
        if valid != set(unique):
            raise ItineraryError(400, "One or more destinations are unavailable")
        return unique

    async def _owned(self, itinerary_id: str, user: dict[str, Any]) -> dict[str, Any]:
        itinerary = await self.repository.get(itinerary_id)
        if itinerary is None:
            raise ItineraryError(404, "Not found")
        if itinerary.get("user_id") != user["id"]:
            raise ItineraryError(403, "Forbidden")
        return itinerary

    async def _hydrated(self, document: dict[str, Any]) -> ItineraryOut:
        structured = (
            await self.hydrator.hydrate(document.get("structured_result"))
            if document.get("result_version") == 2
            else None
        )
        return itinerary_document_to_response(document, structured)

    async def create(self, payload: ItineraryIn, user: dict[str, Any]) -> ItineraryOut:
        if payload.budget_style is None and payload.budget is None:
            raise ItineraryError(422, "Choose a travel style")
        document = payload.model_dump(exclude_none=True)
        document["destination_ids"] = await self._destination_ids(
            payload.destination_ids
        )
        if payload.structured_result:
            stored = await self.hydrator.sanitize(payload.structured_result)
            document["result_version"] = 2
            document["structured_result"] = stored.model_dump(mode="json")
        now = self._now()
        document.update(
            {
                "user_id": user["id"],
                "author_name": user.get("name", ""),
                "is_public": False,
                "share_slug": None,
                "created_at": now,
                "updated_at": now,
            }
        )
        return await self._hydrated(await self.repository.create(document))

    async def list(self, user: dict[str, Any]) -> list[ItineraryOut]:
        documents = await self.repository.list_for_user(user["id"])
        return [itinerary_document_to_response(document) for document in documents]

    async def get(self, itinerary_id: str, user: dict[str, Any]) -> ItineraryOut:
        return await self._hydrated(await self._owned(itinerary_id, user))

    async def update(
        self,
        itinerary_id: str,
        payload: ItineraryUpdateIn,
        user: dict[str, Any],
    ) -> ItineraryOut:
        current = await self._owned(itinerary_id, user)
        if payload.budget_style is None and payload.budget is None:
            raise ItineraryError(422, "Choose a travel style")
        changes = payload.model_dump(exclude_none=True)
        changes["title"] = payload.title.strip()
        changes["interests"] = list(dict.fromkeys(payload.interests))
        changes["destination_ids"] = await self._destination_ids(
            payload.destination_ids
        )
        if current.get("result_version") == 2 and not payload.structured_result:
            try:
                stored = PlannerStoredResultV2.model_validate(
                    current.get("structured_result")
                )
            except ValidationError:
                stored = None
            if stored and stored.destination_ids != changes["destination_ids"]:
                raise ItineraryError(
                    400,
                    STRUCTURED_DESTINATIONS_CHANGED,
                )
        if payload.structured_result:
            stored = await self.hydrator.sanitize(payload.structured_result)
            changes["result_version"] = 2
            changes["structured_result"] = stored.model_dump(mode="json")
        changes["updated_at"] = self._now()
        updated = await self.repository.update_owned(itinerary_id, user["id"], changes)
        if updated is None:
            raise ItineraryError(404, "Not found")
        return await self._hydrated(updated)

    async def duplicate(
        self,
        itinerary_id: str,
        payload: ItineraryDuplicateIn,
        user: dict[str, Any],
    ) -> ItineraryOut:
        current = await self._owned(itinerary_id, user)
        title = (payload.title or f"{current.get('title', 'Trip')} — Copy").strip()
        if not title:
            raise ItineraryError(400, "Title is required")
        document = {
            "title": title[:200],
            "days": current.get("days", 1),
            "interests": current.get("interests") or [],
            "content": current.get("content", ""),
            "lang": current.get("lang", "id"),
            "destination_ids": current.get("destination_ids") or [],
            "extra_context": current.get("extra_context") or "",
        }
        if current.get("budget_style"):
            document["budget_style"] = current["budget_style"]
        if "budget" in current:
            document["budget"] = current.get("budget")
        if current.get("result_version") == 2 and current.get("structured_result"):
            document["result_version"] = 2
            document["structured_result"] = current["structured_result"]
        now = self._now()
        document.update(
            {
                "user_id": user["id"],
                "author_name": user.get("name", ""),
                "is_public": False,
                "share_slug": None,
                "duplicated_from_id": itinerary_id,
                "created_at": now,
                "updated_at": now,
            }
        )
        return await self._hydrated(await self.repository.create(document))

    async def share(
        self, itinerary_id: str, public: bool, user: dict[str, Any]
    ) -> ItineraryOut:
        current = await self._owned(itinerary_id, user)
        changes: dict[str, Any] = {"is_public": public, "updated_at": self._now()}
        if public and not current.get("share_slug"):
            changes["share_slug"] = uuid.uuid4().hex[:12]
        if public and not current.get("author_name"):
            changes["author_name"] = user.get("name", "")
        updated = await self.repository.update_owned(itinerary_id, user["id"], changes)
        if updated is None:
            raise ItineraryError(404, "Not found")
        return await self._hydrated(updated)

    async def public(self, slug: str) -> PublicItineraryOut:
        document = await self.repository.get_public(slug)
        if document is None:
            raise ItineraryError(404, "Itinerary not found or not shared")
        structured = (
            await self.hydrator.hydrate(document.get("structured_result"))
            if document.get("result_version") == 2
            else None
        )
        return itinerary_document_to_public_response(document, structured)

    async def delete(self, itinerary_id: str, user: dict[str, Any]) -> dict[str, bool]:
        await self._owned(itinerary_id, user)
        if not await self.repository.delete_owned(itinerary_id, user["id"]):
            raise ItineraryError(404, "Not found")
        return {"ok": True}
