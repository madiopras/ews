"""Application skeleton tests for Clean Architecture Phase 1."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.main import create_app


def test_application_factory_registers_health_and_feature_routers():
    router = APIRouter(prefix="/api")

    @router.get("/example")
    async def example():
        return {"source": "feature-router"}

    async def health():
        return {"status": "ok"}

    application = create_app(api_routers=(router,), health_endpoint=health)

    with TestClient(application) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/api/example").json() == {"source": "feature-router"}


def test_application_factory_creates_isolated_instances_and_lifecycle_hooks():
    events: list[str] = []

    async def startup():
        events.append("startup")

    async def shutdown():
        events.append("shutdown")

    first = create_app(startup_handlers=(startup,), shutdown_handlers=(shutdown,))
    second = create_app()

    assert first is not second
    with TestClient(first):
        assert events == ["startup"]
    assert events == ["startup", "shutdown"]


def test_application_factory_preserves_cors_policy():
    origins = ["https://example.com", "https://admin.example.com"]
    application = create_app(cors_origins=origins)
    cors = next(
        middleware
        for middleware in application.user_middleware
        if middleware.cls is CORSMiddleware
    )

    assert cors.kwargs == {
        "allow_credentials": True,
        "allow_origins": origins,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }


def test_application_factory_registers_exception_handlers():
    class ExampleApplicationError(Exception):
        pass

    router = APIRouter(prefix="/api")

    @router.get("/failure")
    async def failure():
        raise ExampleApplicationError

    async def handle_failure(_request, _error):
        return JSONResponse({"detail": "mapped"}, status_code=409)

    application = create_app(
        api_routers=(router,),
        exception_handlers={ExampleApplicationError: handle_failure},
    )

    with TestClient(application, raise_server_exceptions=False) as client:
        response = client.get("/api/failure")

    assert response.status_code == 409
    assert response.json() == {"detail": "mapped"}
