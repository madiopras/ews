"""HTTP contract tests for extracted authentication and account routes."""

from __future__ import annotations

from bson import ObjectId
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.modules.auth.dependencies import (
    get_current_user,
    get_google_login_user,
    get_login_user,
    get_manage_account,
    get_recover_credentials,
    get_register_user,
)
from app.modules.auth.exceptions import AuthError
from app.modules.auth.router import EXCEPTION_HANDLERS, router


def user_document(**overrides):
    document = {
        "_id": ObjectId(),
        "email": "user@example.com",
        "name": "User",
        "role": "user",
        "auth_provider": "password",
        "email_verified": False,
        "preferred_language": "id",
        "interests": [],
        "home_city": "",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    document.update(overrides)
    return document


class FakeRegister:
    async def execute(self, payload, client_ip):
        return user_document(email=str(payload.email).lower()), "session-token"


class FakeLogin:
    async def execute(self, email, password, client_ip):
        if password == "invalid":
            raise AuthError(401, "Invalid email or password")
        return user_document(email=email.lower()), "session-token"


class FakeGoogleLogin:
    async def execute(self, credential, client_ip):
        return (
            user_document(auth_provider="google", email_verified=True),
            "google-token",
        )


class FakeRecovery:
    async def forgot_password(self, email, client_ip):
        return None

    async def reset_password(self, token, password, client_ip):
        return None

    async def verify_email(self, token):
        return token.endswith("verified")

    async def resend_verification(self, user, client_ip):
        return bool(user.get("email_verified"))


class FakeAccount:
    async def update_profile(self, user_id, payload):
        return user_document(
            _id=ObjectId(user_id),
            name=payload.name.strip(),
            preferred_language=payload.preferred_language,
            interests=payload.interests,
            home_city=payload.home_city.strip(),
        )

    async def export(self, user_id):
        return {
            "exported_at": "2026-01-01T00:00:00+00:00",
            "account": {"_id": ObjectId(user_id), "email": "user@example.com"},
            "reviews": [],
            "itineraries": [],
            "partners": [],
            "payment_orders": [],
        }

    async def delete(self, user, payload):
        if payload.confirmation != "DELETE":
            raise AuthError(400, "Type DELETE to confirm account deletion")


def make_client():
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
    identity = user_document()
    application.dependency_overrides.update(
        {
            get_current_user: lambda: {
                **identity,
                "id": str(identity["_id"]),
            },
            get_register_user: FakeRegister,
            get_login_user: FakeLogin,
            get_google_login_user: FakeGoogleLogin,
            get_recover_credentials: FakeRecovery,
            get_manage_account: FakeAccount,
        }
    )
    return TestClient(application)


def test_session_routes_preserve_cookie_and_response_contracts():
    with make_client() as client:
        registered = client.post(
            "/api/auth/register",
            json={
                "email": "USER@example.com",
                "password": "password123",
                "name": "User",
                "accepted_terms": True,
            },
        )
        assert registered.status_code == 200
        assert registered.json()["email"] == "user@example.com"
        assert "HttpOnly" in registered.headers["set-cookie"]

        logged_in = client.post(
            "/api/auth/login",
            json={"email": "USER@example.com", "password": "password123"},
        )
        assert logged_in.status_code == 200
        assert "access_token=" in logged_in.headers["set-cookie"]

        google = client.post("/api/auth/google", json={"credential": "x" * 100})
        assert google.status_code == 200
        assert google.json()["auth_provider"] == "google"

        assert client.get("/api/auth/me").status_code == 200
        logout = client.post("/api/auth/logout")
        assert logout.json() == {"ok": True}
        assert "Max-Age=0" in logout.headers["set-cookie"]


def test_google_config_and_login_error_contracts():
    with make_client() as client:
        config = client.get("/api/auth/google/config")
        assert config.json() == {
            "enabled": True,
            "client_id": "client.apps.googleusercontent.com",
        }

        invalid = client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "invalid"},
        )
        assert invalid.status_code == 401
        assert invalid.json() == {"detail": "Invalid email or password"}


def test_recovery_profile_export_and_delete_contracts():
    with make_client() as client:
        forgot = client.post(
            "/api/auth/forgot-password", json={"email": "user@example.com"}
        )
        assert forgot.json() == {
            "ok": True,
            "message": "If the account exists, reset instructions have been sent.",
        }
        assert client.post(
            "/api/auth/reset-password",
            json={"token": "x" * 20, "password": "new-password"},
        ).json() == {"ok": True}
        assert client.post(
            "/api/auth/verify-email", json={"token": f"{'x' * 20}verified"}
        ).json() == {"ok": True, "already_verified": True}
        assert client.post("/api/auth/verify-email/resend").json() == {
            "ok": True,
            "already_verified": False,
        }

        profile = client.put(
            "/api/profile",
            json={
                "name": " Updated ",
                "preferred_language": "en",
                "interests": ["lake"],
                "home_city": " Medan ",
            },
        )
        assert profile.status_code == 200
        assert profile.json()["name"] == "Updated"

        exported = client.get("/api/account/export")
        assert exported.status_code == 200
        assert exported.headers["content-disposition"].endswith(
            "explore-wisata-sumut-account.json"
        )
        assert exported.json()["account"]["email"] == "user@example.com"

        rejected = client.request("DELETE", "/api/account", json={"confirmation": "NO"})
        assert rejected.status_code == 400
        deleted = client.request(
            "DELETE", "/api/account", json={"confirmation": "DELETE"}
        )
        assert deleted.json() == {"ok": True}
