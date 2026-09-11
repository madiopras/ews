"""Static architecture checks for the Phase 3 pilot slice."""

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODULE_DIR = BACKEND_DIR / "app" / "modules" / "destinations"


def test_destination_router_contains_no_mongodb_queries():
    source = (MODULE_DIR / "router.py").read_text(encoding="utf-8")

    assert ".find(" not in source
    assert ".aggregate(" not in source
    assert "ObjectId" not in source


def test_destination_service_is_framework_and_database_independent():
    source = (MODULE_DIR / "service.py").read_text(encoding="utf-8")

    assert "fastapi" not in source.lower()
    assert "HTTPException" not in source
    assert "motor" not in source.lower()
    assert "ObjectId" not in source


def test_legacy_module_no_longer_registers_public_destination_reads():
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    legacy_read_decorators = (
        '@api_router.get("/destinations")',
        '@api_router.get("/destinations/search")',
        '@api_router.get("/destinations/suggestions")',
        '@api_router.get("/destinations/locations")',
        '@api_router.post("/destinations/batch")',
        '@api_router.get("/destinations/trending")',
        '@api_router.get("/destinations/{dest_id}")',
    )

    assert all(decorator not in source for decorator in legacy_read_decorators)
