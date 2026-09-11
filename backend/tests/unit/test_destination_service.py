"""Unit tests for the destination read application service."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest
from bson import ObjectId

from app.modules.destinations.exceptions import DestinationNotFound
from app.modules.destinations.mapper import destination_document_to_response
from app.modules.destinations.service import DestinationService


def destination_document(**overrides):
    document = {
        "_id": ObjectId(),
        "name": "Danau Toba",
        "name_en": "Lake Toba",
        "location": "Samosir",
        "category": "lake",
        "price": None,
        "description": "Danau vulkanik terbesar di Sumatera Utara.",
        "description_en": "A large volcanic lake in North Sumatra.",
        "tags": ["danau", "alam"],
        "source_label": "Editorial",
        "source_url": "javascript:alert(1)",
        "editorial_reviewed_at": "2026-01-01T00:00:00+00:00",
        "images": [
            "data:image/png;base64,private",
            "/api/files/toba.webp",
            "https://cdn.example.com/toba.webp",
        ],
        "video": "blob:https://example.com/private",
        "latitude": 2.6845,
        "longitude": 98.8756,
        "featured": True,
        "is_active": True,
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    document.update(overrides)
    return document


class FakeDestinationRepository:
    def __init__(self, documents=None):
        self.documents = documents or [destination_document()]
        self.calls = []
        self.total = len(self.documents)

    async def list_public(self, **kwargs):
        self.calls.append(("list", kwargs))
        return self.documents

    async def search_public(self, **kwargs):
        self.calls.append(("search", kwargs))
        return self.documents, self.total

    async def suggestions(self, **kwargs):
        self.calls.append(("suggestions", kwargs))
        return self.documents

    async def locations(self):
        self.calls.append(("locations", {}))
        return [" Medan ", "samosir", "Samosir", "", "medan"]

    async def batch_public(self, destination_ids):
        self.calls.append(("batch", {"destination_ids": destination_ids}))
        return list(reversed(self.documents))

    async def trending_public(self, **kwargs):
        self.calls.append(("trending", kwargs))
        return self.documents

    async def get_public(self, destination_id):
        self.calls.append(("get", {"destination_id": destination_id}))
        return (
            self.documents[0]
            if destination_id == str(self.documents[0]["_id"])
            else None
        )


def test_mapper_matches_frozen_legacy_public_fixture():
    document = destination_document()

    actual = destination_document_to_response(document).model_dump()

    assert actual == {
        "id": str(document["_id"]),
        "name": "Danau Toba",
        "name_en": "Lake Toba",
        "location": "Samosir",
        "category": "lake",
        "price": None,
        "description": "Danau vulkanik terbesar di Sumatera Utara.",
        "description_en": "A large volcanic lake in North Sumatra.",
        "tags": ["danau", "alam"],
        "source_label": "Editorial",
        "source_url": "",
        "editorial_reviewed_at": "2026-01-01T00:00:00+00:00",
        "images": [
            "/api/files/toba.webp",
            "https://cdn.example.com/toba.webp",
        ],
        "video": "",
        "latitude": 2.6845,
        "longitude": 98.8756,
        "featured": True,
        "is_active": True,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


def test_list_normalizes_all_category_and_maps_documents():
    repository = FakeDestinationRepository()
    service = DestinationService(repository)

    result = asyncio.run(
        service.list_destinations(category="all", search="Toba", featured=True)
    )

    assert [item.name for item in result] == ["Danau Toba"]
    assert repository.calls == [
        (
            "list",
            {
                "category": None,
                "search": "Toba",
                "featured": True,
                "limit": 500,
            },
        )
    ]


def test_search_clamps_pagination_and_sanitizes_filter_lengths():
    repository = FakeDestinationRepository()
    repository.total = 97
    service = DestinationService(repository)

    result = asyncio.run(
        service.search_destinations(
            query=f"  {'x' * 120}  ",
            category="lake",
            location=f"  {'y' * 220}  ",
            sort="updated",
            page=0,
            page_size=1000,
        )
    )

    assert result.page == 1
    assert result.page_size == 48
    assert result.pages == 3
    _, call = repository.calls[-1]
    assert call["search"] == "x" * 100
    assert call["location"] == "y" * 200
    assert call["skip"] == 0
    assert call["limit"] == 48


def test_suggestions_locations_and_batch_preserve_legacy_rules():
    first = destination_document(name="First")
    second = destination_document(name="Second")
    repository = FakeDestinationRepository([first, second])
    service = DestinationService(repository)

    assert asyncio.run(service.suggestions(query=" x ", limit=99)) == []
    assert not repository.calls

    suggestions = asyncio.run(service.suggestions(query=" toba ", limit=99))
    assert [item.name for item in suggestions] == ["First", "Second"]
    assert repository.calls[-1] == (
        "suggestions",
        {"search": "toba", "limit": 10},
    )

    locations = asyncio.run(service.locations())
    assert set(locations) == {"Medan", "medan", "samosir", "Samosir"}
    assert [value.casefold() for value in locations] == [
        "medan",
        "medan",
        "samosir",
        "samosir",
    ]

    ids = [str(first["_id"]), str(second["_id"]), str(first["_id"])]
    result = asyncio.run(service.batch(ids))
    assert [item.name for item in result] == ["First", "Second"]
    assert repository.calls[-1][1]["destination_ids"] == ids[:2]


def test_trending_and_detail_delegate_without_framework_dependencies():
    repository = FakeDestinationRepository()
    service = DestinationService(repository)
    destination_id = str(repository.documents[0]["_id"])

    before = datetime.now(timezone.utc)
    trending = asyncio.run(service.trending(days=30, limit=6))
    after = datetime.now(timezone.utc)
    assert trending[0].name == "Danau Toba"
    since = repository.calls[-1][1]["since"]
    assert before.timestamp() - 30 * 86400 <= since.timestamp() <= after.timestamp()

    detail = asyncio.run(service.get_destination(destination_id))
    assert detail.id == destination_id
    with pytest.raises(DestinationNotFound, match="Not found"):
        asyncio.run(service.get_destination(str(ObjectId())))
