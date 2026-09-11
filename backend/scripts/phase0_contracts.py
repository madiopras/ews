"""Generate and verify the Phase 0 API and legacy-coupling baselines.

Run from ``backend/``:

    python -m scripts.phase0_contracts --write
    python -m scripts.phase0_contracts --check

The generated files intentionally contain contract metadata only. They never
read or serialize environment variable values.
"""

from __future__ import annotations

import argparse
import ast
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

from fastapi import FastAPI
from fastapi.routing import APIRoute

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
CONTRACT_DIR = BACKEND_DIR / "tests" / "contracts"
DOCS_DIR = PROJECT_DIR / "docsplan" / "backend"
OPENAPI_BASELINE = CONTRACT_DIR / "openapi-baseline.json"
ROUTES_BASELINE = CONTRACT_DIR / "routes-baseline.json"
COUPLING_BASELINE = CONTRACT_DIR / "server-coupling-baseline.json"
ROUTE_INVENTORY = DOCS_DIR / "phase-0-route-inventory.md"

HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "TRACE"}


def load_app() -> FastAPI:
    # Import lazily so AST-only users do not initialize runtime dependencies.
    from app.main import app

    return app


def normalized_openapi(app: FastAPI) -> dict[str, Any]:
    """Return a deterministic, JSON-compatible OpenAPI document."""
    return json.loads(json.dumps(app.openapi(), sort_keys=True))


def _callable_name(value: Any) -> str:
    module = getattr(value, "__module__", "")
    qualname = getattr(value, "__qualname__", getattr(value, "__name__", repr(value)))
    return f"{module}.{qualname}" if module else str(qualname)


def _response_model_name(value: Any) -> str | None:
    if value is None:
        return None
    module = getattr(value, "__module__", "")
    qualname = getattr(value, "__qualname__", "")
    if qualname:
        return f"{module}.{qualname}" if module else qualname
    return str(value).replace("typing.", "")


def _dependency_names(route: APIRoute) -> list[str]:
    names: set[str] = set()

    def walk(dependant: Any) -> None:
        for dependency in dependant.dependencies:
            if dependency.call is not None:
                names.add(_callable_name(dependency.call))
            walk(dependency)

    walk(route.dependant)
    return sorted(names)


def route_domain(path: str) -> str:
    """Classify a public path by the owning business/technical domain."""
    if path == "/health" or path == "/api/":
        return "health"
    if path.startswith("/api/admin"):
        return "admin"
    if "/reviews" in path:
        return "reviews"
    if path.startswith(("/api/auth", "/api/profile", "/api/account")):
        return "auth-users"
    if path.startswith("/api/wishlist"):
        return "wishlist"
    if path.startswith("/api/destinations"):
        return "destinations"
    if path.startswith(("/api/partners", "/api/mitra", "/api/analytics/partner")):
        return "partners"
    if path.startswith(("/api/itineraries", "/api/public/itineraries")):
        return "itineraries"
    if path.startswith(("/api/planner", "/api/trip-planner", "/api/analytics/planner")):
        return "planner"
    if path.startswith(("/api/payments", "/api/premium")):
        return "payments"
    if path.startswith(("/api/upload", "/api/files")):
        return "media"
    if path.startswith("/api/share"):
        return "sharing"
    if path.startswith(("/api/notifications", "/api/reports")):
        return "governance-notifications"
    if path.startswith("/api/experience"):
        return "experience"
    return "other"


def route_inventory(app: FastAPI) -> list[dict[str, Any]]:
    inventory: list[dict[str, Any]] = []
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.include_in_schema:
            continue
        for method in sorted((route.methods or set()) & HTTP_METHODS):
            inventory.append(
                {
                    "domain": route_domain(route.path),
                    "method": method,
                    "path": route.path,
                    "name": route.name,
                    "operation_id": route.operation_id,
                    "status_code": route.status_code or 200,
                    "response_model": _response_model_name(route.response_model),
                    "dependencies": _dependency_names(route),
                }
            )
    return sorted(
        inventory, key=lambda item: (item["domain"], item["path"], item["method"])
    )


def duplicate_routes(app: FastAPI) -> dict[str, int]:
    pairs: list[str] = []
    for route in app.routes:
        methods = getattr(route, "methods", set()) or set()
        for method in methods & HTTP_METHODS:
            pairs.append(f"{method} {route.path}")
    return {pair: count for pair, count in Counter(pairs).items() if count > 1}


def _root_attribute(node: ast.AST, module_aliases: set[str]) -> str | None:
    current = node
    first_attribute: str | None = None
    while isinstance(current, ast.Attribute):
        first_attribute = current.attr
        current = current.value
    if isinstance(current, ast.Name) and current.id in module_aliases:
        return first_attribute
    return None


def scan_server_coupling(
    test_dir: Path | None = None,
) -> dict[str, dict[str, list[str]]]:
    """Inventory explicit imports and attribute access to the legacy module."""
    test_dir = test_dir or BACKEND_DIR / "tests"
    result: dict[str, dict[str, list[str]]] = {}
    for path in sorted(test_dir.rglob("test_*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        imports: set[str] = set()
        attributes: set[str] = set()
        monkeypatch_targets: set[str] = set()
        module_aliases: set[str] = set()

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == "server":
                        imports.add("server")
                        module_aliases.add(alias.asname or alias.name)
            elif isinstance(node, ast.ImportFrom) and node.module == "server":
                imports.update(alias.name for alias in node.names)

        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute):
                attribute = _root_attribute(node, module_aliases)
                if attribute:
                    attributes.add(attribute)
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr == "setattr" and len(node.args) >= 2:
                    target, name = node.args[0], node.args[1]
                    if (
                        isinstance(target, ast.Name)
                        and target.id in module_aliases
                        and isinstance(name, ast.Constant)
                    ):
                        if isinstance(name.value, str):
                            monkeypatch_targets.add(name.value)

        if imports or attributes or monkeypatch_targets:
            result[path.relative_to(BACKEND_DIR).as_posix()] = {
                "imports": sorted(imports),
                "attributes": sorted(attributes),
                "monkeypatch_targets": sorted(monkeypatch_targets),
            }
    return result


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def _format_list(values: Iterable[str]) -> str:
    values = list(values)
    return ", ".join(f"`{value}`" for value in values) if values else "—"


def render_route_inventory(routes: list[dict[str, Any]]) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for route in routes:
        grouped[route["domain"]].append(route)

    lines = [
        "# Phase 0 — Route Inventory",
        "",
        "> Generated by `python -m scripts.phase0_contracts --write`. Do not edit route rows manually.",
        "",
        "## Summary",
        "",
        f"- OpenAPI operations: **{len(routes)}**.",
        f"- Domain groups: **{len(grouped)}**.",
        "- Inventory includes method, path, handler, status code, response model, and resolved FastAPI dependencies.",
        "- FastAPI documentation routes (`/docs`, `/redoc`, and `/openapi.json`) are intentionally excluded.",
        "",
        "| Domain | Operations |",
        "|---|---:|",
    ]
    for domain in sorted(grouped):
        lines.append(f"| `{domain}` | {len(grouped[domain])} |")

    for domain in sorted(grouped):
        lines.extend(
            [
                "",
                f"## {domain}",
                "",
                "| Method | Path | Handler | Status | Response model | Dependencies |",
                "|---|---|---|---:|---|---|",
            ]
        )
        for route in grouped[domain]:
            lines.append(
                "| {method} | `{path}` | `{name}` | {status} | {response} | {dependencies} |".format(
                    method=route["method"],
                    path=route["path"],
                    name=route["name"],
                    status=route["status_code"],
                    response=(
                        f"`{route['response_model']}`"
                        if route["response_model"]
                        else "—"
                    ),
                    dependencies=_format_list(route["dependencies"]),
                )
            )
    lines.extend(
        [
            "",
            "## Regeneration",
            "",
            "Run from `backend/` after an intentional API contract change:",
            "",
            "```bash",
            "python -m scripts.phase0_contracts --write",
            "pytest -n 0 tests/test_phase0_contracts.py",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def write_baselines() -> None:
    app = load_app()
    duplicates = duplicate_routes(app)
    if duplicates:
        raise SystemExit(f"Cannot write a baseline with duplicate routes: {duplicates}")
    routes = route_inventory(app)
    _write_json(OPENAPI_BASELINE, normalized_openapi(app))
    _write_json(ROUTES_BASELINE, routes)
    _write_json(COUPLING_BASELINE, scan_server_coupling())
    ROUTE_INVENTORY.parent.mkdir(parents=True, exist_ok=True)
    ROUTE_INVENTORY.write_text(render_route_inventory(routes), encoding="utf-8")


def check_baselines() -> list[str]:
    app = load_app()
    checks = (
        (OPENAPI_BASELINE, normalized_openapi(app)),
        (ROUTES_BASELINE, route_inventory(app)),
    )
    errors: list[str] = []
    for path, actual in checks:
        if not path.exists():
            errors.append(f"missing baseline: {path.relative_to(PROJECT_DIR)}")
            continue
        expected = json.loads(path.read_text(encoding="utf-8"))
        if actual != expected:
            errors.append(f"contract changed: {path.relative_to(PROJECT_DIR)}")
    duplicates = duplicate_routes(app)
    if duplicates:
        errors.append(f"duplicate routes: {duplicates}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--write", action="store_true", help="write the current approved baselines"
    )
    mode.add_argument(
        "--check",
        action="store_true",
        help="verify runtime contracts against baselines",
    )
    args = parser.parse_args()

    if args.write:
        write_baselines()
        print(f"Wrote {OPENAPI_BASELINE.relative_to(PROJECT_DIR)}")
        print(f"Wrote {ROUTES_BASELINE.relative_to(PROJECT_DIR)}")
        print(f"Wrote {COUPLING_BASELINE.relative_to(PROJECT_DIR)}")
        print(f"Wrote {ROUTE_INVENTORY.relative_to(PROJECT_DIR)}")
        return 0

    errors = check_baselines()
    if errors:
        print("\n".join(errors))
        return 1
    print("Phase 0 API baselines match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
