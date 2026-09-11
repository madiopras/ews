"""Permanent Clean Architecture enforcement after the Phase 10 cutover."""

import ast
from pathlib import Path

from app.main import app
from scripts.phase0_contracts import duplicate_routes, scan_server_coupling

BACKEND = Path(__file__).resolve().parents[2]
APP = BACKEND / "app"


def imports(path: Path):
    for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
        if isinstance(node, ast.ImportFrom) and node.module:
            yield node.module
        elif isinstance(node, ast.Import):
            yield from (alias.name for alias in node.names)


def test_server_is_only_a_compatibility_entrypoint():
    path = BACKEND / "server.py"
    assert len(path.read_text().splitlines()) <= 6
    tree = ast.parse(path.read_text())
    imports_from_main = [
        node
        for node in tree.body
        if isinstance(node, ast.ImportFrom) and node.module == "app.main"
    ]
    assert len(imports_from_main) == 1
    assert [alias.name for alias in imports_from_main[0].names] == ["app"]


def test_no_test_imports_or_monkeypatches_server_globals():
    assert scan_server_coupling() == {}


def test_services_are_framework_and_persistence_adapter_independent():
    forbidden_imports = {"fastapi", "bson", "pymongo", "motor"}
    implementation_suffixes = {
        "service",
        "repository",
        "repositories",
        "gateways",
        "dependencies",
        "router",
    }
    for path in (APP / "modules").glob("*/service.py"):
        owner = path.parent.name
        for module in imports(path):
            assert module.split(".")[0] not in forbidden_imports, (path, module)
            parts = module.split(".")
            if (
                len(parts) >= 4
                and parts[:2] == ["app", "modules"]
                and parts[2] != owner
            ):
                assert parts[-1] not in implementation_suffixes, (path, module)


def test_routers_do_not_execute_database_or_provider_operations():
    forbidden = (
        ".find_one(",
        ".find(",
        ".insert_one(",
        ".update_one(",
        ".delete_one(",
        "AsyncIOMotorClient",
        "MongoClient(",
        "httpx.AsyncClient",
        "requests.",
        "smtplib.",
    )
    for path in (APP / "modules").glob("*/router.py"):
        source = path.read_text()
        assert all(token not in source for token in forbidden), path


def test_infrastructure_never_imports_api_or_feature_routers():
    for path in (APP / "infrastructure").rglob("*.py"):
        for module in imports(path):
            assert not module.startswith("app.api"), (path, module)
            assert not module.endswith(".router"), (path, module)


def test_root_legacy_modules_and_duplicate_definitions_are_gone():
    removed = (
        "minimal_server.py",
        "planner_contract.py",
        "planner_guard.py",
        "planner_result_contract.py",
        "planner_structured_engine.py",
        "audit_culinary_partners.py",
        "import_destinations.py",
        "migrate_is_active.py",
        "quick_test.py",
    )
    assert all(not (BACKEND / name).exists() for name in removed)
    for path in APP.rglob("*.py"):
        names = [
            node.name
            for node in ast.parse(path.read_text()).body
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
        ]
        assert len(names) == len(set(names)), path
    assert duplicate_routes(app) == {}
