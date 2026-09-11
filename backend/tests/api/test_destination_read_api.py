"""HTTP boundary tests for destination public read routes."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.dependencies import get_destination_service
from app.main import create_app
from app.modules.destinations.exceptions import (
    DestinationNotFound,
    InvalidDestinationId,
)
from app.modules.destinations.router import EXCEPTION_HANDLERS, router
from app.modules.destinations.schemas import DestinationOut, DestinationPublicPage


def destination_response(identifier: str = "destination-id") -> DestinationOut:
    return DestinationOut(
        id=identifier,
        name="Danau Toba",
        location="Samosir",
        category="lake",
        description="Danau vulkanik terbesar di Sumatera Utara.",
        latitude=2.6845,
        longitude=98.8756,
        created_at="2026-01-01T00:00:00+00:00",
    )


class FakeDestinationService:
    async def list_destinations(self, **kwargs):
        return [destination_response()]

    async def search_destinations(self, **kwargs):
        return DestinationPublicPage(
            items=[destination_response()],
            total=1,
            page=max(1, kwargs["page"]),
            page_size=min(48, max(1, kwargs["page_size"])),
            pages=1,
        )

    async def suggestions(self, **kwargs):
        return []

    async def locations(self):
        return ["Samosir"]

    async def batch(self, destination_ids):
        if destination_ids == ["invalid"]:
            raise InvalidDestinationId("Invalid destination id")
        return [destination_response(identifier) for identifier in destination_ids]

    async def trending(self, **kwargs):
        return [destination_response()]

    async def get_destination(self, destination_id):
        if destination_id == "invalid":
            raise InvalidDestinationId("Invalid id")
        if destination_id == "missing":
            raise DestinationNotFound("Not found")
        return destination_response(destination_id)


def test_destination_read_http_contracts_and_error_translation():
    application = create_app(
        api_routers=(router,), exception_handlers=EXCEPTION_HANDLERS
    )
    application.dependency_overrides[get_destination_service] = FakeDestinationService

    with TestClient(application) as client:
        assert client.get("/api/destinations").status_code == 200
        search = client.get("/api/destinations/search", params={"page_size": 99})
        assert search.status_code == 200
        assert search.json()["page_size"] == 48
        assert (
            client.get("/api/destinations/suggestions", params={"q": "x"}).json() == []
        )
        assert client.get("/api/destinations/locations").json() == ["Samosir"]
        assert client.get("/api/destinations/trending").status_code == 200
        assert (
            client.post(
                "/api/destinations/batch", json={"ids": ["one", "two"]}
            ).status_code
            == 200
        )
        assert client.get("/api/destinations/known").status_code == 200

        invalid_batch = client.post(
            "/api/destinations/batch", json={"ids": ["invalid"]}
        )
        assert invalid_batch.status_code == 400
        assert invalid_batch.json() == {"detail": "Invalid destination id"}

        invalid_detail = client.get("/api/destinations/invalid")
        assert invalid_detail.status_code == 400
        assert invalid_detail.json() == {"detail": "Invalid id"}

        missing = client.get("/api/destinations/missing")
        assert missing.status_code == 404
        assert missing.json() == {"detail": "Not found"}


def test_destination_query_validation_contract_remains_fastapi_managed():
    application = create_app(
        api_routers=(router,), exception_handlers=EXCEPTION_HANDLERS
    )
    application.dependency_overrides[get_destination_service] = FakeDestinationService

    with TestClient(application) as client:
        assert (
            client.get(
                "/api/destinations/search", params={"category": "unknown"}
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/api/destinations/batch", json={"ids": [str(i) for i in range(51)]}
            ).status_code
            == 422
        )
