"""Architecture and security contract gates for the affiliates vertical slice."""

from __future__ import annotations

from pathlib import Path

from fastapi.routing import APIRoute

from app.modules.affiliates.router import router

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODULE_DIR = BACKEND_DIR / "app" / "modules" / "affiliates"


def test_affiliate_router_has_no_persistence_or_gateway_calls():
    source = (MODULE_DIR / "router.py").read_text(encoding="utf-8")
    for forbidden in (
        "ObjectId",
        ".find(",
        ".find_one(",
        ".insert_one(",
        ".update_one(",
        "httpx",
        "AESGCM",
    ):
        assert forbidden not in source


def test_affiliate_service_is_framework_and_persistence_independent():
    source = (MODULE_DIR / "service.py").read_text(encoding="utf-8")
    for forbidden in ("fastapi", "HTTPException", "ObjectId", "pymongo", "httpx"):
        assert forbidden not in source


def test_all_admin_affiliate_routes_require_admin():
    for route in router.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/admin"):
            continue
        deps = {
            dep.call.__name__
            for dep in route.dependant.dependencies
            if dep.call is not None
        }
        assert "require_admin" in deps, route.path


def test_affiliate_router_owns_expected_routes():
    routes = [route for route in router.routes if isinstance(route, APIRoute)]
    assert {(next(iter(route.methods)), route.path) for route in routes} == {
        ("GET", "/api/affiliates/recommendations"),
        ("POST", "/api/affiliates/tiket/miniapp-session"),
        ("GET", "/api/affiliates/go"),
        ("GET", "/api/admin/affiliates/tiket"),
        ("PUT", "/api/admin/affiliates/tiket"),
        ("POST", "/api/admin/affiliates/tiket/preview"),
        ("GET", "/api/admin/affiliates/analytics"),
    }
