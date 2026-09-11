"""Architecture enforcement for Phase 9 external-I/O slices."""

import ast
from pathlib import Path

from fastapi.routing import APIRoute

from app.modules.backups.router import router as backup_router
from app.modules.billing.router import router as billing_router
from app.modules.media.router import router as media_router
from app.modules.sharing.router import router as sharing_router

BACKEND = Path(__file__).resolve().parents[2]


def operations(router):
    return {
        (next(iter(route.methods)), route.path)
        for route in router.routes
        if isinstance(route, APIRoute)
    }


def test_phase9_routers_own_exactly_the_frozen_operations():
    assert len(operations(backup_router)) == 5
    assert len(operations(billing_router)) == 11
    assert operations(media_router) == {
        ("POST", "/api/upload"),
        ("GET", "/api/files/{path:path}"),
    }
    assert operations(sharing_router) == {
        ("GET", "/api/share/{slug}"),
        ("GET", "/api/share/{slug}/image.png"),
    }
    assert (
        len(
            operations(backup_router)
            | operations(billing_router)
            | operations(media_router)
            | operations(sharing_router)
        )
        == 20
    )


def test_legacy_server_no_longer_declares_phase9_handlers_or_schemas():
    tree = ast.parse((BACKEND / "server.py").read_text())
    forbidden = {
        "backup_status",
        "create_backup",
        "upload_file",
        "serve_file",
        "PlanIn",
        "SnapTokenIn",
        "create_snap_token",
        "midtrans_notification",
        "share_preview_page",
    }
    names = {
        node.name
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
    }
    assert not names & forbidden


def test_async_application_paths_do_not_use_blocking_http_clients():
    for module in ("billing", "media", "backups", "sharing"):
        for path in (BACKEND / "app" / "modules" / module).glob("*.py"):
            if path.name == "gateway.py" and module == "backups":
                continue
            assert "import requests" not in path.read_text()
    assert (
        "httpx.AsyncClient" in (BACKEND / "app/modules/billing/gateways.py").read_text()
    )
    assert (
        "httpx.AsyncClient" in (BACKEND / "app/modules/media/gateways.py").read_text()
    )


def test_cpu_and_file_work_is_explicitly_offloaded():
    assert (
        "asyncio.to_thread(self.files.write"
        in (BACKEND / "app/modules/backups/service.py").read_text()
    )
    sharing = (BACKEND / "app/modules/sharing/service.py").read_text()
    assert "asyncio.to_thread" in sharing and "self.renderer" in sharing
    assert (
        "asyncio.to_thread" in (BACKEND / "app/modules/media/gateways.py").read_text()
    )
