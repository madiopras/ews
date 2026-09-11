"""Static architecture gates for the Phase 5 vertical slices."""

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODULES_DIR = BACKEND_DIR / "app" / "modules"


def test_phase5_routers_contain_no_database_queries_or_bson_types():
    for module in ("destinations", "wishlist", "reviews", "itineraries"):
        source = (MODULES_DIR / module / "router.py").read_text(encoding="utf-8")
        assert ".find(" not in source
        assert ".update_one(" not in source
        assert ".delete_one(" not in source
        assert "ObjectId" not in source


def test_phase5_services_are_framework_and_bson_independent():
    for module in ("destinations", "wishlist", "reviews", "itineraries"):
        source = (MODULES_DIR / module / "service.py").read_text(encoding="utf-8")
        assert "fastapi" not in source.lower()
        assert "HTTPException" not in source
        assert "ObjectId" not in source


def test_legacy_module_no_longer_defines_phase5_routes():
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    decorators = (
        '@api_router.get("/destinations/admin")',
        '@api_router.get("/admin/destinations")',
        '@api_router.get("/admin/destinations/{dest_id}")',
        '@api_router.post("/destinations")',
        '@api_router.put("/destinations/{dest_id}")',
        '@api_router.patch("/destinations/{dest_id}/toggle-active")',
        '@api_router.delete("/destinations/{dest_id}")',
        '@api_router.get("/wishlist")',
        '@api_router.post("/wishlist/{dest_id}")',
        '@api_router.delete("/wishlist/{dest_id}")',
        '@api_router.get("/destinations/{dest_id}/reviews")',
        '@api_router.post("/destinations/{dest_id}/reviews")',
        '@api_router.put("/reviews/{review_id}")',
        '@api_router.delete("/reviews/{review_id}")',
        '@api_router.post("/itineraries")',
        '@api_router.get("/itineraries")',
        '@api_router.get("/itineraries/{itin_id}")',
        '@api_router.put("/itineraries/{itin_id}")',
        '@api_router.post("/itineraries/{itin_id}/duplicate")',
        '@api_router.patch("/itineraries/{itin_id}/share")',
        '@api_router.get("/public/itineraries/{slug}")',
        '@api_router.delete("/itineraries/{itin_id}")',
    )
    assert all(decorator not in source for decorator in decorators)


def test_public_itinerary_dto_has_an_explicit_private_field_denylist():
    from app.modules.itineraries.schemas import PublicItineraryOut

    private_fields = {
        "id",
        "user_id",
        "extra_context",
        "share_slug",
        "is_public",
        "duplicated_from_id",
    }
    assert private_fields.isdisjoint(PublicItineraryOut.model_fields)
