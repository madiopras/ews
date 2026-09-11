"""Explicit private and public itinerary serializers."""

from typing import Any, Mapping

from app.modules.itineraries.schemas import ItineraryOut, PublicItineraryOut
from app.shared.planner_result import PlannerResultV2


def itinerary_document_to_response(
    document: Mapping[str, Any],
    structured_result: PlannerResultV2 | None = None,
) -> ItineraryOut:
    return ItineraryOut(
        id=str(document["_id"]),
        user_id=document["user_id"],
        title=document["title"],
        days=document["days"],
        budget=document.get("budget"),
        budget_style=document.get("budget_style"),
        interests=document.get("interests") or [],
        content=document["content"],
        lang=document.get("lang", "id"),
        created_at=document["created_at"],
        author_name=document.get("author_name", ""),
        is_public=document.get("is_public", False),
        share_slug=document.get("share_slug"),
        destination_ids=document.get("destination_ids") or [],
        extra_context=document.get("extra_context") or "",
        updated_at=document.get("updated_at", document.get("created_at", "")),
        duplicated_from_id=document.get("duplicated_from_id"),
        result_version=2 if document.get("result_version") == 2 else None,
        structured_result=structured_result,
    )


def itinerary_document_to_public_response(
    document: Mapping[str, Any],
    structured_result: PlannerResultV2 | None = None,
) -> PublicItineraryOut:
    return PublicItineraryOut(
        title=document["title"],
        days=document["days"],
        budget=document.get("budget"),
        budget_style=document.get("budget_style"),
        interests=document.get("interests") or [],
        content=document["content"],
        lang=document.get("lang", "id"),
        created_at=document["created_at"],
        author_name=document.get("author_name", ""),
        destination_ids=document.get("destination_ids") or [],
        updated_at=document.get("updated_at", document.get("created_at", "")),
        result_version=2 if document.get("result_version") == 2 else None,
        structured_result=structured_result,
    )
