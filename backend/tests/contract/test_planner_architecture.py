"""Architecture enforcement for the Phase 8 planner vertical slice."""

import ast
from pathlib import Path

from fastapi.routing import APIRoute

from app.modules.planner.router import router

BACKEND = Path(__file__).resolve().parents[2]
MODULE = BACKEND / "app" / "modules" / "planner"


def test_planner_router_has_no_persistence_or_generation_logic():
    source = (MODULE / "router.py").read_text()
    for forbidden in (
        "pymongo",
        "ObjectId",
        "find_one",
        "insert_one",
        "planner_structured_engine",
        "active_llm.stream",
    ):
        assert forbidden not in source


def test_generation_service_is_independent_of_http_mongo_and_sse_wire_format():
    source = (MODULE / "service.py").read_text()
    for forbidden in (
        "fastapi",
        "Request",
        "Response",
        "StreamingResponse",
        "ObjectId",
        "pymongo",
        '"data: ',
    ):
        assert forbidden not in source


def test_sse_wire_format_has_one_explicit_serializer():
    assert 'f"data: {json.dumps(event)}\\n\\n"' in (MODULE / "sse.py").read_text()


def test_planner_repositories_are_split_by_operational_boundary():
    tree = ast.parse((MODULE / "repositories.py").read_text())
    names = {node.name for node in tree.body if isinstance(node, ast.ClassDef)}
    assert names == {
        "PlannerQuotaRepository",
        "PlannerCatalogRepository",
        "PlannerAnalyticsRepository",
        "PlannerLogRepository",
    }


def test_planner_router_owns_exactly_the_three_frozen_operations():
    routes = [route for route in router.routes if isinstance(route, APIRoute)]
    assert {(next(iter(route.methods)), route.path) for route in routes} == {
        ("POST", "/api/analytics/planner-events"),
        ("GET", "/api/planner/quota"),
        ("POST", "/api/trip-planner/stream"),
    }


def test_legacy_server_no_longer_declares_planner_routes_or_schemas():
    tree = ast.parse((BACKEND / "server.py").read_text())
    names = {
        node.name
        for node in tree.body
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
    }
    assert "TripPlanIn" not in names
    assert "PlannerAnalyticsEventIn" not in names
    assert "trip_planner_stream" not in names
    assert "reserve_planner_quota" not in names
