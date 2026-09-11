"""Direct Google identity tests without network or legacy server coupling."""

from __future__ import annotations

import asyncio

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app
from app.modules.auth.dependencies import get_google_login_user
from app.modules.auth.exceptions import GoogleCredentialInvalid
from app.modules.auth.gateways import verify_google_credential
from app.modules.auth.router import EXCEPTION_HANDLERS, router
from app.modules.auth.schemas import GoogleCredentialIn
from app.modules.auth.service import GoogleLoginUser


def test_google_credential_contract_rejects_missing_or_tiny_tokens():
    with pytest.raises(ValidationError):
        GoogleCredentialIn(credential="short")
    assert len(GoogleCredentialIn(credential="x" * 100).credential) == 100


def test_google_token_verification_uses_configured_audience(monkeypatch):
    captured = {}

    def verify(token, request, audience):
        captured.update(token=token, request=request, audience=audience)
        return {
            "sub": "google-subject-1",
            "email": "USER@EXAMPLE.COM",
            "email_verified": True,
            "name": "Google User",
            "picture": "https://example.com/photo.jpg",
        }

    monkeypatch.setattr(
        "app.modules.auth.gateways.google_id_token.verify_oauth2_token", verify
    )
    identity = verify_google_credential(
        "signed-token", "client.apps.googleusercontent.com"
    )

    assert captured["audience"] == "client.apps.googleusercontent.com"
    assert identity["id"] == "google-subject-1"
    assert identity["email"] == "user@example.com"


def test_google_token_requires_verified_email(monkeypatch):
    monkeypatch.setattr(
        "app.modules.auth.gateways.google_id_token.verify_oauth2_token",
        lambda *_args: {
            "sub": "google-subject-2",
            "email": "user@example.com",
            "email_verified": False,
        },
    )
    with pytest.raises(GoogleCredentialInvalid):
        verify_google_credential("signed-token", "client-id")


class FakeUsers:
    def __init__(self, document):
        self.document = document

    async def find_by_google_id(self, google_id):
        if self.document.get("google_id") == google_id:
            return dict(self.document)
        return None

    async def find_by_email(self, email, **_kwargs):
        if self.document.get("email") == email:
            return dict(self.document)
        return None

    async def update_google_identity(self, _user_id, changes):
        self.document.update(changes)
        return dict(self.document)

    async def insert(self, document):
        document["_id"] = ObjectId()
        self.document = document
        return document


class FakeLimiter:
    async def enforce(self, *_args):
        return None


class FakeTokens:
    def create_access(self, *_args):
        return "application-session-token"


class FakeGoogle:
    def __init__(self, data):
        self.data = data

    async def verify(self, _credential):
        return self.data


def test_google_email_link_preserves_existing_role_and_password():
    password_hash = "existing-password-hash"
    users = FakeUsers(
        {
            "_id": ObjectId(),
            "email": "admin@example.com",
            "name": "Existing Admin",
            "role": "admin",
            "password_hash": password_hash,
            "account_active": True,
            "auth_session_version": 3,
        }
    )
    use_case = GoogleLoginUser(
        users,
        FakeLimiter(),
        FakeTokens(),
        FakeGoogle(
            {
                "id": "google-admin-subject",
                "email": "admin@example.com",
                "name": "Google Name",
                "picture": "https://example.com/admin.jpg",
            }
        ),
        enabled=True,
    )

    linked, token = asyncio.run(use_case.execute("signed-token", "127.0.0.1"))

    assert linked["role"] == "admin"
    assert linked["password_hash"] == password_hash
    assert linked["name"] == "Existing Admin"
    assert linked["google_id"] == "google-admin-subject"
    assert token == "application-session-token"


class FakeGoogleLoginUseCase:
    async def execute(self, _credential, _client_ip):
        return (
            {
                "_id": ObjectId(),
                "email": "user@example.com",
                "name": "Google User",
                "role": "user",
                "account_active": True,
                "auth_provider": "google",
                "email_verified": True,
                "auth_session_version": 0,
            },
            "application-session-token",
        )


def test_direct_google_endpoint_sets_application_session_cookie():
    settings = Settings(
        _env_file=None,
        mongo_url="mongodb://database.test:27017",
        db_name="test",
        jwt_secret="unit-test-secret",
        use_llm=False,
        google_oauth_enabled=True,
        google_client_id="client.apps.googleusercontent.com",
    )
    application = create_app(
        api_routers=(router,),
        exception_handlers=EXCEPTION_HANDLERS,
        settings=settings,
    )
    application.dependency_overrides[get_google_login_user] = FakeGoogleLoginUseCase

    with TestClient(application) as client:
        response = client.post("/api/auth/google", json={"credential": "x" * 100})

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"
    cookie = response.headers["set-cookie"]
    assert "access_token=" in cookie
    assert "HttpOnly" in cookie
