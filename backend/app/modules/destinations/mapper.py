"""Mapping from persisted destination documents to public API DTOs."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.modules.destinations.schemas import DestinationOut, DestinationSuggestion
from app.shared.urls import safe_public_http_url, safe_public_media_url


def destination_document_to_response(document: Mapping[str, Any]) -> DestinationOut:
    """Map and sanitize one MongoDB destination document."""

    return DestinationOut(
        id=str(document["_id"]),
        name=document["name"],
        name_en=document.get("name_en", ""),
        location=document["location"],
        category=document["category"],
        price=document.get("price"),
        description=document["description"],
        description_en=document.get("description_en", ""),
        tags=document.get("tags", []),
        source_label=document.get("source_label", "Explore Wisata Sumut"),
        source_url=safe_public_http_url(document.get("source_url", "")),
        editorial_reviewed_at=document.get("editorial_reviewed_at", ""),
        images=[
            value
            for value in (
                safe_public_media_url(item) for item in document.get("images", [])
            )
            if value
        ][:10],
        video=safe_public_media_url(document.get("video", "")),
        latitude=document["latitude"],
        longitude=document["longitude"],
        featured=document.get("featured", False),
        is_active=document.get("is_active", True),
        created_at=document.get("created_at", ""),
        updated_at=document.get("updated_at", document.get("created_at", "")),
    )


def destination_document_to_suggestion(
    document: Mapping[str, Any],
) -> DestinationSuggestion:
    """Map the intentionally small public autocomplete projection."""

    image = next(
        (
            value
            for value in (
                safe_public_media_url(item) for item in (document.get("images") or [])
            )
            if value
        ),
        "",
    )
    return DestinationSuggestion(
        id=str(document["_id"]),
        name=document["name"],
        name_en=document.get("name_en", ""),
        location=document.get("location", ""),
        category=document.get("category", "nature"),
        image=image,
    )
