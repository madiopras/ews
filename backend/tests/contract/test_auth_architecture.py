"""Static architecture checks for the Phase 4 auth slice."""

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODULE_DIR = BACKEND_DIR / "app" / "modules" / "auth"


def test_auth_router_contains_no_database_or_provider_sdk_calls():
    source = (MODULE_DIR / "router.py").read_text(encoding="utf-8")

    assert ".find(" not in source
    assert ".find_one(" not in source
    assert ".update_one(" not in source
    assert ".update_many(" not in source
    assert ".delete_one(" not in source
    assert ".delete_many(" not in source
    assert "google.oauth" not in source
    assert "smtplib" not in source


def test_auth_service_is_framework_and_database_driver_independent():
    source = (MODULE_DIR / "service.py").read_text(encoding="utf-8")

    assert "fastapi" not in source.lower()
    assert "HTTPException" not in source
    assert "motor" not in source.lower()
    assert "ObjectId" not in source


def test_legacy_module_no_longer_registers_auth_or_account_routes():
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    prefixes = (
        '@api_router.get("/auth',
        '@api_router.post("/auth',
        '@api_router.put("/profile',
        '@api_router.get("/account',
        '@api_router.delete("/account',
    )

    assert all(prefix not in source for prefix in prefixes)


def test_authorization_dependencies_are_owned_by_auth_module():
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")

    assert "async def get_current_user(" not in source
    assert "async def get_optional_user(" not in source
    assert "async def require_admin(" not in source
    assert "from app.main import app" in source
