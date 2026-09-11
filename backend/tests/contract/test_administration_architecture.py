"""Architecture and authorization gates for the Phase 7 feature."""

import ast
from pathlib import Path

from fastapi.routing import APIRoute

from app.modules.administration.router import router

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODULE_DIR = BACKEND_DIR / "app" / "modules" / "administration"


def test_administration_router_contains_no_persistence_or_gateway_logic():
    source = (MODULE_DIR / "router.py").read_text(encoding="utf-8")
    forbidden = (
        "ObjectId",
        ".find(",
        ".find_one(",
        ".insert_one(",
        ".update_one(",
        ".delete_one(",
        "httpx",
        "AESGCM",
    )
    assert all(value not in source for value in forbidden)


def test_administration_services_are_framework_transport_and_bson_independent():
    source = (MODULE_DIR / "service.py").read_text(encoding="utf-8")
    assert "fastapi" not in source.lower()
    assert "HTTPException" not in source
    assert "ObjectId" not in source
    assert "httpx" not in source
    assert "pymongo" not in source.lower()


def test_repositories_are_split_by_cohesive_aggregate():
    source = (MODULE_DIR / "repositories.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    classes = {node.name for node in tree.body if isinstance(node, ast.ClassDef)}
    assert {
        "AuditLogRepository",
        "DashboardRepository",
        "AdminUserRepository",
        "SettingsRepository",
        "GovernanceRepository",
        "NotificationRepository",
        "EmailTemplateRepository",
        "LlmProfileRepository",
    } <= classes
    assert "GenericRepository" not in classes


def test_all_admin_routes_resolve_the_shared_admin_policy():
    for route in router.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/admin"):
            continue
        dependencies = {
            dependency.call.__name__
            for dependency in route.dependant.dependencies
            if dependency.call
        }
        assert "require_admin" in dependencies, route.path


def test_legacy_server_no_longer_declares_phase7_routes_or_schemas():
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    route_fragments = (
        '@api_router.get("/admin/dashboard")',
        '@api_router.get("/admin/governance',
        '@api_router.patch("/admin/governance',
        '@api_router.post("/admin/governance',
        '@api_router.post("/reports")',
        '@api_router.get("/notifications")',
        '@api_router.patch("/notifications/',
        '@api_router.get("/admin/users")',
        '@api_router.patch("/admin/users/',
        '@api_router.get("/admin/audit-logs")',
        '@api_router.get("/admin/ai-logs")',
        '@api_router.get("/admin/system-logs")',
        '@api_router.get("/admin/settings")',
        '@api_router.put("/admin/settings")',
        '@api_router.get("/experience/features")',
        '@api_router.get("/admin/llm-profiles',
        '@api_router.post("/admin/llm-profiles',
        '@api_router.put("/admin/llm-profiles',
        '@api_router.delete("/admin/llm-profiles',
        '@api_router.get("/admin/email-templates',
        '@api_router.post("/admin/email-templates',
        '@api_router.put("/admin/email-templates',
        '@api_router.delete("/admin/email-templates',
    )
    assert all(value not in source for value in route_fragments)
    for schema in (
        "AdminUserOut",
        "GeneralSettingsIn",
        "EditorialWorkflowIn",
        "ContentReportIn",
        "LlmProfileCreateIn",
        "EmailTemplateIn",
    ):
        assert f"class {schema}(" not in source
