"""Foundation tests for Clean Architecture Phase 2."""

from __future__ import annotations

import asyncio
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.responses import Response

from app.api.dependencies import get_app_settings, get_database
from app.core.config import Settings
from app.core.security import (
    create_access_token,
    create_planner_guest_token,
    decode_token,
    hash_password,
    identity_hash,
    set_access_token_cookie,
    set_planner_guest_cookie,
    verify_password,
)
from app.infrastructure.database.indexes import INDEX_DEFINITIONS, ensure_indexes
from app.infrastructure.database.mongo import create_mongo_lifespan
from app.main import create_app

BACKEND_DIR = Path(__file__).resolve().parents[1]


def make_settings(**overrides) -> Settings:
    values = {
        "mongo_url": "mongodb://database.test:27017",
        "db_name": "ews_test",
        "jwt_secret": "unit-test-jwt-secret",
        "use_llm": False,
        "environment": "test",
        "midtrans_merchant_id": "",
        "midtrans_client_key": "",
        "midtrans_server_key": "",
        "midtrans_merchant_id_production": "",
        "midtrans_client_key_production": "",
        "midtrans_server_key_production": "",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_importing_app_package_does_not_import_server_or_motor():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import sys; import app; "
                "assert 'server' not in sys.modules; "
                "assert 'motor.motor_asyncio' not in sys.modules"
            ),
        ],
        cwd=BACKEND_DIR,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_settings_parse_groups_mask_secrets_and_normalize_lists():
    settings = make_settings(
        cors_origins="https://one.example, https://two.example",
        llm_api_key="provider-secret",
        llm_allowed_hosts="LLM.EXAMPLE, llm.internal",
    )

    assert settings.cors_origin_list == [
        "https://one.example",
        "https://two.example",
    ]
    assert settings.llm_allowed_host_set == {"llm.example", "llm.internal"}
    assert settings.llm_api_key.get_secret_value() == "provider-secret"
    assert "provider-secret" not in repr(settings)


def test_settings_validate_only_enabled_features():
    disabled = make_settings(google_oauth_enabled=False, google_client_id="")
    assert disabled.google_client_id == ""

    with pytest.raises(ValidationError, match="GOOGLE_CLIENT_ID"):
        make_settings(google_oauth_enabled=True, google_client_id="")


def test_settings_derive_environment_aware_llm_ssrf_policy():
    assert make_settings(environment="development").allow_private_llm_urls is True
    assert make_settings(environment="production").allow_private_llm_urls is False
    assert (
        make_settings(
            environment="production", llm_allow_private_urls=True
        ).allow_private_llm_urls
        is True
    )


def test_midtrans_credentials_are_selected_and_validated_per_environment():
    sandbox = make_settings(
        midtrans_merchant_id="merchant",
        midtrans_client_key="client",
        midtrans_server_key="server",
    )
    assert sandbox.midtrans_credentials() == ("merchant", "client", "server")

    with pytest.raises(RuntimeError, match="incomplete"):
        make_settings().midtrans_credentials()


class FakeMongoClient:
    def __init__(self, url: str):
        self.url = url
        self.database = SimpleNamespace(name="ews_test")
        self.closed = False

    def __getitem__(self, name: str):
        assert name == "ews_test"
        return self.database

    def close(self):
        self.closed = True


def test_mongo_lifespan_binds_app_state_dependencies_and_closes_client():
    settings = make_settings()
    clients: list[FakeMongoClient] = []
    bindings: list[tuple[object | None, object | None]] = []
    events: list[str] = []

    def client_factory(url: str):
        client = FakeMongoClient(url)
        clients.append(client)
        return client

    def bind_resources(client, database):
        bindings.append((client, database))

    async def startup(application):
        assert application.state.database.name == "ews_test"
        events.append("startup")

    async def shutdown(application):
        assert application.state.mongo_client is clients[0]
        events.append("shutdown")

    router = APIRouter(prefix="/api")

    @router.get("/resources")
    async def resources(
        database=Depends(get_database),
        app_settings=Depends(get_app_settings),
    ):
        return {"database": database.name, "environment": app_settings.environment}

    lifespan = create_mongo_lifespan(
        settings,
        startup_handlers=(startup,),
        shutdown_handlers=(shutdown,),
        bind_resources=bind_resources,
        client_factory=client_factory,
    )
    application = create_app(
        api_routers=(router,), lifespan=lifespan, settings=settings
    )

    assert clients == []
    with TestClient(application) as test_client:
        assert clients[0].url == settings.mongo_url
        assert test_client.get("/api/resources").json() == {
            "database": "ews_test",
            "environment": "test",
        }
        assert events == ["startup"]
        assert bindings[-1] == (clients[0], clients[0].database)

    assert events == ["startup", "shutdown"]
    assert clients[0].closed is True
    assert bindings[-1] == (None, None)
    assert application.state.mongo_client is None
    assert application.state.database is None


@pytest.mark.parametrize("failure_stage", ["startup", "shutdown"])
def test_mongo_lifespan_always_cleans_up_after_handler_failure(failure_stage):
    settings = make_settings()
    clients: list[FakeMongoClient] = []
    bindings: list[tuple[object | None, object | None]] = []

    def client_factory(url: str):
        client = FakeMongoClient(url)
        clients.append(client)
        return client

    async def startup():
        if failure_stage == "startup":
            raise RuntimeError("startup failed")

    async def shutdown():
        if failure_stage == "shutdown":
            raise RuntimeError("shutdown failed")

    application = create_app(settings=settings)
    lifespan = create_mongo_lifespan(
        settings,
        startup_handlers=(startup,),
        shutdown_handlers=(shutdown,),
        bind_resources=lambda client, database: bindings.append((client, database)),
        client_factory=client_factory,
    )

    async def run_lifecycle():
        async with lifespan(application):
            pass

    with pytest.raises(RuntimeError, match=f"{failure_stage} failed"):
        asyncio.run(run_lifecycle())

    assert clients[0].closed is True
    assert bindings[-1] == (None, None)
    assert application.state.mongo_client is None
    assert application.state.database is None


def test_index_registry_replays_every_definition_with_options():
    calls: list[tuple[str, object, dict]] = []

    class Collection:
        def __init__(self, name: str):
            self.name = name

        async def create_index(self, keys, **options):
            calls.append((self.name, keys, options))

    class Database:
        def __getitem__(self, name: str):
            return Collection(name)

    asyncio.run(ensure_indexes(Database()))

    assert len(INDEX_DEFINITIONS) == 67
    assert len(calls) == len(INDEX_DEFINITIONS)
    assert ("users", "email", {"unique": True}) in calls
    assert (
        "llm_profiles",
        "active",
        {"unique": True, "partialFilterExpression": {"active": True}},
    ) in calls
    assert (
        "partner_analytics",
        "created_at",
        {"expireAfterSeconds": 31536000},
    ) in calls


def test_password_token_hash_and_cookie_primitives_preserve_contracts():
    password_hash = hash_password("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", password_hash) is True
    assert verify_password("wrong", password_hash) is False
    assert verify_password("wrong", "not-a-bcrypt-hash") is False

    issued_at = datetime.now(timezone.utc)
    jwt_secret = "unit-test-jwt-secret-with-at-least-32-bytes"
    token = create_access_token(
        "user-id",
        "user@example.com",
        jwt_secret,
        session_version=3,
        now=issued_at,
    )
    payload = decode_token(token, jwt_secret)
    assert payload["sub"] == "user-id"
    assert payload["email"] == "user@example.com"
    assert payload["sv"] == 3
    assert payload["type"] == "access"

    assert identity_hash("identity", jwt_secret) == identity_hash(
        "identity", jwt_secret
    )
    identity, guest_token = create_planner_guest_token(
        jwt_secret, 2, identity="guest-id", now=issued_at
    )
    assert identity == "guest-id"
    assert decode_token(guest_token, jwt_secret)["type"] == "planner_guest"

    response = Response()
    set_access_token_cookie(response, token, secure=False)
    cookie = response.headers["set-cookie"]
    assert "access_token=" in cookie
    assert "HttpOnly" in cookie
    assert "Max-Age=604800" in cookie
    assert "Path=/" in cookie
    assert "SameSite=lax" in cookie
    assert "Secure" not in cookie

    guest_response = Response()
    set_planner_guest_cookie(guest_response, guest_token, 2, secure=True)
    guest_cookie = guest_response.headers["set-cookie"]
    assert "planner_guest=" in guest_cookie
    assert "Max-Age=172800" in guest_cookie
    assert "Path=/api" in guest_cookie
    assert "SameSite=none" in guest_cookie
    assert "Secure" in guest_cookie
