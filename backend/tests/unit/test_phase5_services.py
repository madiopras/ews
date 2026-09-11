"""Unit coverage for Phase 5 business and ownership boundaries."""

import asyncio
from copy import deepcopy

import pytest
from bson import ObjectId

from app.modules.destinations.exceptions import DestinationValidationError
from app.modules.destinations.schemas import DestinationIn
from app.modules.destinations.service import DestinationAdminService
from app.modules.itineraries.exceptions import ItineraryError
from app.modules.itineraries.schemas import ItineraryUpdateIn
from app.modules.itineraries.service import ItineraryService
from app.modules.reviews.exceptions import ReviewError
from app.modules.reviews.schemas import ReviewIn
from app.modules.reviews.service import ReviewService
from app.modules.wishlist.exceptions import WishlistError
from app.modules.wishlist.service import WishlistService


def destination_document(**overrides):
    document = {
        "_id": ObjectId(),
        "name": "Danau Toba",
        "location": "Samosir",
        "category": "lake",
        "description": "Danau vulkanik terbesar di Sumatera Utara.",
        "latitude": 2.68,
        "longitude": 98.87,
        "created_at": "2026-01-01T00:00:00+00:00",
        "is_active": True,
    }
    document.update(overrides)
    return document


def destination_payload(**overrides):
    values = {
        "name": "Danau Toba",
        "location": "Samosir",
        "category": "lake",
        "description": "Danau vulkanik terbesar di Sumatera Utara.",
        "latitude": 2.68,
        "longitude": 98.87,
        "tags": [" Alam ", "alam", "  "],
    }
    values.update(overrides)
    return DestinationIn(**values)


class FakeDestinationAdminRepository:
    def __init__(self):
        self.document = destination_document()
        self.audit = []
        self.created = None

    async def list_admin(self, **_kwargs):
        return [self.document]

    async def search_admin(self, **_kwargs):
        return [self.document], 1

    async def get_admin(self, _destination_id):
        return self.document

    async def create(self, document):
        self.created = {**document, "_id": self.document["_id"]}
        return self.created

    async def replace_fields(self, _destination_id, changes):
        self.document.update(changes)
        return self.document

    async def toggle_active(self, _destination_id, **_kwargs):
        self.document["is_active"] = not self.document.get("is_active", True)
        return self.document

    async def delete(self, _destination_id):
        return self.document

    async def record_audit(self, actor, **values):
        self.audit.append((actor, values))


def test_destination_admin_normalizes_content_and_rejects_unsafe_editorial_data():
    repository = FakeDestinationAdminRepository()
    service = DestinationAdminService(repository)
    actor = {"id": "admin", "email": "admin@example.com"}

    created = asyncio.run(service.create(destination_payload(), actor))
    assert created.tags == ["alam"]
    assert repository.audit[-1][1]["action"] == "create"

    with pytest.raises(
        DestinationValidationError, match="Invalid editorial source URL"
    ):
        asyncio.run(
            service.create(destination_payload(source_url="javascript:alert(1)"), actor)
        )
    with pytest.raises(DestinationValidationError, match="Maximum price"):
        asyncio.run(
            service.search(
                query_text="",
                category=None,
                status="all",
                featured=None,
                min_price=10,
                max_price=5,
                page=1,
                page_size=25,
                sort="-created_at",
            )
        )


class FakeWishlistRepository:
    def __init__(self, *, active=True):
        self.active = active
        self.calls = []

    async def list_active(self, _ids):
        return [destination_document()] if self.active else []

    async def active_destination_exists(self, destination_id):
        self.calls.append(("exists", destination_id))
        return self.active

    async def add(self, user_id, destination_id, **kwargs):
        self.calls.append(("add", user_id, destination_id, kwargs))

    async def remove(self, user_id, destination_id):
        self.calls.append(("remove", user_id, destination_id))


def test_wishlist_requires_active_destination_and_delegates_atomic_mutations():
    user = {"id": "user-1", "wishlist": ["destination-1"]}
    repository = FakeWishlistRepository()
    service = WishlistService(repository)
    assert asyncio.run(service.add("destination-1", user)) == {"ok": True}
    assert repository.calls[-1][:3] == ("add", "user-1", "destination-1")
    assert asyncio.run(service.remove("destination-1", user)) == {"ok": True}

    unavailable = WishlistService(FakeWishlistRepository(active=False))
    with pytest.raises(WishlistError) as error:
        asyncio.run(unavailable.add("destination-1", user))
    assert (error.value.status_code, error.value.detail) == (
        404,
        "Destination not found",
    )


class FakeReviewRepository:
    def __init__(self):
        self.review = {
            "_id": ObjectId(),
            "destination_id": "destination-1",
            "user_id": "owner",
            "user_name": "Owner",
            "rating": 4,
            "comment": "Bagus",
            "created_at": "2026-01-01T00:00:00+00:00",
        }

    async def list_visible(self, _destination_id):
        return [self.review]

    async def active_destination_exists(self, _destination_id):
        return True

    async def create(self, document):
        return {**document, "_id": ObjectId()}

    async def get(self, _review_id):
        return deepcopy(self.review)

    async def update_owned(self, _review_id, user_id, changes):
        if user_id != self.review["user_id"]:
            return None
        self.review.update(changes)
        return deepcopy(self.review)

    async def delete_authorized(self, _review_id, user_id, *, is_admin):
        return is_admin or user_id == self.review["user_id"]


def test_review_ownership_rejects_cross_account_but_allows_admin_delete():
    service = ReviewService(FakeReviewRepository())
    payload = ReviewIn(rating=5, comment="Diperbarui")
    with pytest.raises(ReviewError) as update_error:
        asyncio.run(service.update("review-1", payload, {"id": "other"}))
    assert update_error.value.status_code == 403
    with pytest.raises(ReviewError) as delete_error:
        asyncio.run(service.delete("review-1", {"id": "other", "role": "user"}))
    assert delete_error.value.status_code == 403
    assert asyncio.run(
        service.delete("review-1", {"id": "admin", "role": "admin"})
    ) == {"ok": True}


class FakeItineraryRepository:
    def __init__(self):
        self.document = {
            "_id": "itinerary-1",
            "user_id": "owner",
            "title": "Private Trip",
            "days": 2,
            "budget": 500000,
            "interests": ["nature"],
            "content": "## Hari 1",
            "lang": "id",
            "created_at": "2026-01-01T00:00:00+00:00",
            "author_name": "Owner",
            "is_public": True,
            "share_slug": "shared-trip",
            "destination_ids": [],
            "extra_context": "PRIVATE FAMILY CONTEXT",
            "internal_note": "PRIVATE INTERNAL NOTE",
        }

    async def active_destination_ids(self, values):
        return set(values)

    async def eligible_partners(self, _values):
        return []

    async def active_offerings(self, _values):
        return []

    async def destination_cards(self, _values):
        return []

    async def create(self, document):
        self.document = {**document, "_id": "created"}
        return deepcopy(self.document)

    async def list_for_user(self, _user_id):
        return [deepcopy(self.document)]

    async def get(self, _itinerary_id):
        return deepcopy(self.document)

    async def update_owned(self, _itinerary_id, user_id, changes):
        if user_id != self.document["user_id"]:
            return None
        self.document.update(changes)
        return deepcopy(self.document)

    async def delete_owned(self, _itinerary_id, user_id):
        return user_id == self.document["user_id"]

    async def get_public(self, slug):
        return deepcopy(self.document) if slug == "shared-trip" else None


def test_itinerary_service_enforces_ownership_and_public_projection():
    service = ItineraryService(FakeItineraryRepository())
    with pytest.raises(ItineraryError) as error:
        asyncio.run(service.get("itinerary-1", {"id": "other"}))
    assert error.value.status_code == 403

    with pytest.raises(ItineraryError) as update_error:
        asyncio.run(
            service.update(
                "itinerary-1",
                ItineraryUpdateIn(
                    title="Attempt",
                    days=2,
                    budget=500000,
                    destination_ids=[],
                ),
                {"id": "other"},
            )
        )
    assert update_error.value.status_code == 403

    public = asyncio.run(service.public("shared-trip")).model_dump()
    assert public["title"] == "Private Trip"
    assert "extra_context" not in public
    assert "user_id" not in public
    assert "share_slug" not in public
    assert "internal_note" not in public
