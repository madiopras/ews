import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import Request, Response
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server


def test_google_credential_contract_rejects_missing_or_tiny_tokens():
    with pytest.raises(ValidationError):
        server.GoogleCredentialIn(credential="short")
    assert len(server.GoogleCredentialIn(credential="x" * 100).credential) == 100


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

    monkeypatch.setattr(server, "GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setattr(server.google_id_token, "verify_oauth2_token", verify)
    identity = server.verify_google_credential("signed-token")

    assert captured["audience"] == "client.apps.googleusercontent.com"
    assert identity["id"] == "google-subject-1"
    assert identity["email"] == "user@example.com"


def test_google_token_requires_verified_email(monkeypatch):
    monkeypatch.setattr(server.google_id_token, "verify_oauth2_token", lambda *_args: {
        "sub": "google-subject-2",
        "email": "user@example.com",
        "email_verified": False,
    })
    with pytest.raises(ValueError):
        server.verify_google_credential("signed-token")


class FakeUsers:
    def __init__(self, document):
        self.document = document

    async def find_one(self, query):
        if "google_id" in query and self.document.get("google_id") != query["google_id"]:
            return None
        if "email" in query and self.document.get("email") != query["email"]:
            return None
        if "_id" in query and self.document.get("_id") != query["_id"]:
            return None
        return dict(self.document)

    async def update_one(self, _query, update):
        self.document.update(update["$set"])
        return SimpleNamespace(modified_count=1)


def test_google_email_link_preserves_existing_role_and_password(monkeypatch):
    password_hash = "existing-password-hash"
    users = FakeUsers({
        "_id": ObjectId(),
        "email": "admin@example.com",
        "name": "Existing Admin",
        "role": "admin",
        "password_hash": password_hash,
        "account_active": True,
        "auth_session_version": 3,
    })
    monkeypatch.setattr(server, "db", SimpleNamespace(users=users))

    linked = asyncio.run(server.upsert_google_user({
        "id": "google-admin-subject",
        "email": "admin@example.com",
        "name": "Google Name",
        "picture": "https://example.com/admin.jpg",
    }))

    assert linked["role"] == "admin"
    assert linked["password_hash"] == password_hash
    assert linked["name"] == "Existing Admin"
    assert linked["google_id"] == "google-admin-subject"


def test_direct_google_endpoint_sets_application_session_cookie(monkeypatch):
    user_id = ObjectId()
    monkeypatch.setattr(server, "GOOGLE_OAUTH_ENABLED", True)
    monkeypatch.setattr(server, "GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
    monkeypatch.setattr(server, "verify_google_credential", lambda _credential: {
        "id": "google-subject-3",
        "email": "user@example.com",
        "name": "Google User",
        "picture": "",
    })

    async def user_from_google(_data):
        return {
            "_id": user_id,
            "email": "user@example.com",
            "name": "Google User",
            "role": "user",
            "account_active": True,
            "auth_provider": "google",
            "email_verified": True,
            "auth_session_version": 0,
        }

    monkeypatch.setattr(server, "upsert_google_user", user_from_google)
    response = Response()
    request = Request({
        "type": "http",
        "method": "POST",
        "path": "/api/auth/google",
        "headers": [],
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 80),
        "scheme": "http",
        "query_string": b"",
    })

    result = asyncio.run(server.google_login(
        server.GoogleCredentialIn(credential="x" * 100),
        response,
        request,
    ))

    assert result.email == "user@example.com"
    cookie = response.headers["set-cookie"]
    assert "access_token=" in cookie
    assert "HttpOnly" in cookie
