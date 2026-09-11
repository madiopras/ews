"""HTTP boundary tests for destination writes, wishlist, reviews, and trips."""

from fastapi.testclient import TestClient

from app.api.dependencies import get_destination_admin_service
from app.main import create_app
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.destinations.router import EXCEPTION_HANDLERS as DESTINATION_HANDLERS
from app.modules.destinations.router import router as destination_router
from app.modules.destinations.schemas import DestinationAdminPage, DestinationOut
from app.modules.itineraries.dependencies import get_itinerary_service
from app.modules.itineraries.router import EXCEPTION_HANDLERS as ITINERARY_HANDLERS
from app.modules.itineraries.router import router as itinerary_router
from app.modules.itineraries.schemas import ItineraryOut, PublicItineraryOut
from app.modules.reviews.dependencies import get_review_service
from app.modules.reviews.router import EXCEPTION_HANDLERS as REVIEW_HANDLERS
from app.modules.reviews.router import router as review_router
from app.modules.reviews.schemas import ReviewOut
from app.modules.wishlist.dependencies import get_wishlist_service
from app.modules.wishlist.router import EXCEPTION_HANDLERS as WISHLIST_HANDLERS
from app.modules.wishlist.router import router as wishlist_router


def destination(identifier="destination-1"):
    return DestinationOut(
        id=identifier,
        name="Danau Toba",
        location="Samosir",
        category="lake",
        description="Danau vulkanik terbesar di Sumatera Utara.",
        latitude=2.68,
        longitude=98.87,
        created_at="2026-01-01T00:00:00+00:00",
    )


def itinerary(identifier="itinerary-1"):
    return ItineraryOut(
        id=identifier,
        user_id="owner",
        title="Trip",
        days=2,
        budget=500000,
        interests=["nature"],
        content="## Hari 1",
        lang="id",
        created_at="2026-01-01T00:00:00+00:00",
    )


class FakeDestinationAdminService:
    async def list_all(self):
        return [destination()]

    async def search(self, **_kwargs):
        return DestinationAdminPage(
            items=[destination()], total=1, page=1, page_size=25, pages=1
        )

    async def get(self, identifier):
        return destination(identifier)

    async def create(self, _payload, _actor):
        return destination()

    async def update(self, identifier, _payload, _actor):
        return destination(identifier)

    async def toggle(self, identifier, _actor):
        return destination(identifier).model_copy(update={"is_active": False})

    async def delete(self, _identifier, _actor):
        return {"ok": True}


class FakeWishlistService:
    async def list(self, _user):
        return [destination()]

    async def add(self, _identifier, _user):
        return {"ok": True}

    async def remove(self, _identifier, _user):
        return {"ok": True}


class FakeReviewService:
    async def list(self, _destination_id):
        review = self._review()
        return {"reviews": [review.model_dump()], "average": 5.0, "count": 1}

    async def create(self, destination_id, payload, user):
        return self._review(destination_id, user["id"], payload.rating, payload.comment)

    async def update(self, review_id, payload, user):
        return self._review(
            "destination-1", user["id"], payload.rating, payload.comment, review_id
        )

    async def delete(self, _review_id, _user):
        return {"ok": True}

    @staticmethod
    def _review(
        destination_id="destination-1",
        user_id="owner",
        rating=5,
        comment="Bagus",
        review_id="review-1",
    ):
        return ReviewOut(
            id=review_id,
            destination_id=destination_id,
            user_id=user_id,
            user_name="Owner",
            rating=rating,
            comment=comment,
            created_at="2026-01-01T00:00:00+00:00",
        )


class FakeItineraryService:
    async def create(self, _payload, _user):
        return itinerary()

    async def list(self, _user):
        return [itinerary()]

    async def get(self, identifier, _user):
        return itinerary(identifier)

    async def update(self, identifier, _payload, _user):
        return itinerary(identifier)

    async def duplicate(self, _identifier, _payload, _user):
        return itinerary("copy-1")

    async def share(self, identifier, public, _user):
        return itinerary(identifier).model_copy(
            update={"is_public": public, "share_slug": "shared"}
        )

    async def public(self, _slug):
        return PublicItineraryOut(
            title="Trip",
            days=2,
            budget=500000,
            interests=["nature"],
            content="## Hari 1",
            lang="id",
            created_at="2026-01-01T00:00:00+00:00",
            author_name="Owner",
        )

    async def delete(self, _identifier, _user):
        return {"ok": True}


def make_client():
    application = create_app(
        api_routers=(
            destination_router,
            wishlist_router,
            review_router,
            itinerary_router,
        ),
        exception_handlers={
            **DESTINATION_HANDLERS,
            **WISHLIST_HANDLERS,
            **REVIEW_HANDLERS,
            **ITINERARY_HANDLERS,
        },
    )
    identity = {"id": "owner", "name": "Owner", "role": "admin", "wishlist": []}
    application.dependency_overrides.update(
        {
            get_current_user: lambda: identity,
            require_admin: lambda: identity,
            get_destination_admin_service: FakeDestinationAdminService,
            get_wishlist_service: FakeWishlistService,
            get_review_service: FakeReviewService,
            get_itinerary_service: FakeItineraryService,
        }
    )
    return TestClient(application)


DESTINATION_PAYLOAD = {
    "name": "Danau Toba",
    "location": "Samosir",
    "category": "lake",
    "description": "Danau vulkanik terbesar di Sumatera Utara.",
    "latitude": 2.68,
    "longitude": 98.87,
}


def test_destination_write_and_wishlist_http_contracts():
    with make_client() as client:
        assert client.get("/api/destinations/admin").status_code == 200
        assert client.get("/api/admin/destinations").json()["total"] == 1
        assert client.get("/api/admin/destinations/destination-1").status_code == 200
        assert (
            client.post("/api/destinations", json=DESTINATION_PAYLOAD).status_code
            == 200
        )
        assert (
            client.put(
                "/api/destinations/destination-1", json=DESTINATION_PAYLOAD
            ).status_code
            == 200
        )
        assert (
            client.patch("/api/destinations/destination-1/toggle-active").json()[
                "is_active"
            ]
            is False
        )
        assert client.delete("/api/destinations/destination-1").json() == {"ok": True}
        assert client.get("/api/wishlist").status_code == 200
        assert client.post("/api/wishlist/destination-1").json() == {"ok": True}
        assert client.delete("/api/wishlist/destination-1").json() == {"ok": True}


def test_review_and_itinerary_http_contracts_keep_public_response_private():
    with make_client() as client:
        review_payload = {"rating": 5, "comment": "Bagus"}
        assert (
            client.get("/api/destinations/destination-1/reviews").json()["count"] == 1
        )
        assert (
            client.post(
                "/api/destinations/destination-1/reviews", json=review_payload
            ).status_code
            == 200
        )
        assert (
            client.put("/api/reviews/review-1", json=review_payload).status_code == 200
        )
        assert client.delete("/api/reviews/review-1").json() == {"ok": True}

        create_payload = {
            "title": "Trip",
            "days": 2,
            "budget": 500000,
            "content": "## Hari 1",
        }
        update_payload = {
            "title": "Trip",
            "days": 2,
            "budget": 500000,
        }
        assert client.post("/api/itineraries", json=create_payload).status_code == 200
        assert client.get("/api/itineraries").status_code == 200
        assert client.get("/api/itineraries/itinerary-1").status_code == 200
        assert (
            client.put("/api/itineraries/itinerary-1", json=update_payload).status_code
            == 200
        )
        assert (
            client.post("/api/itineraries/itinerary-1/duplicate", json={}).status_code
            == 200
        )
        assert (
            client.patch(
                "/api/itineraries/itinerary-1/share", json={"public": True}
            ).status_code
            == 200
        )
        public = client.get("/api/public/itineraries/shared")
        assert public.status_code == 200
        assert "user_id" not in public.json()
        assert "extra_context" not in public.json()
        assert client.delete("/api/itineraries/itinerary-1").json() == {"ok": True}
