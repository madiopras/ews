"""Framework-free tests for authentication and account use cases."""

from __future__ import annotations

import asyncio
from copy import deepcopy

import pytest
from bson import ObjectId

from app.core.security import hash_password
from app.modules.auth.exceptions import AuthError, GoogleCredentialInvalid
from app.modules.auth.schemas import AccountDeleteIn, ProfileUpdateIn, RegisterIn
from app.modules.auth.service import (
    AuthRateLimiter,
    GoogleLoginUser,
    IdentityService,
    LoginUser,
    ManageAccount,
    RecoverCredentials,
    RegisterUser,
)
from app.modules.auth.tokens import AuthTokenService

SECRET = "phase4-unit-test-secret-with-at-least-32-bytes"


def user_document(**overrides):
    document = {
        "_id": ObjectId(),
        "email": "user@example.com",
        "name": "User",
        "role": "user",
        "password_hash": hash_password("password123"),
        "account_active": True,
        "auth_provider": "password",
        "email_verified": False,
        "email_verification_version": 0,
        "password_reset_version": 0,
        "auth_session_version": 0,
        "preferred_language": "id",
        "interests": [],
        "home_city": "",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    document.update(overrides)
    return document


class FakeUsers:
    def __init__(self, user=None):
        self.user = deepcopy(user) if user else None
        self.profile_call = None
        self.deleted = None
        self.sessions_deleted = []
        self.password_update_result = True

    async def find_by_id(self, user_id, **_kwargs):
        if self.user and str(self.user["_id"]) == user_id:
            return deepcopy(self.user)
        return None

    async def find_by_email(self, email, **_kwargs):
        if self.user and self.user["email"] == email:
            return deepcopy(self.user)
        return None

    async def find_by_google_id(self, google_id):
        if self.user and self.user.get("google_id") == google_id:
            return deepcopy(self.user)
        return None

    async def insert(self, document):
        self.user = deepcopy(document)
        self.user["_id"] = ObjectId()
        return deepcopy(self.user)

    async def update_google_identity(self, _user_id, changes):
        self.user.update(changes)
        return deepcopy(self.user)

    async def update_password_if_version(
        self, user_id, current_version, password_hash, session_version, updated_at
    ):
        if self.password_update_result:
            self.user.update(
                password_hash=password_hash,
                password_reset_version=current_version + 1,
                auth_session_version=session_version,
                updated_at=updated_at,
            )
        return self.password_update_result

    async def delete_sessions(self, user_id):
        self.sessions_deleted.append(user_id)

    async def mark_email_verified(self, _user_id, verified_at):
        self.user.update(email_verified=True, email_verified_at=verified_at)

    async def increment_verification_version(self, _user_id):
        self.user["email_verification_version"] += 1
        return deepcopy(self.user)

    async def update_profile(self, user_id, **changes):
        self.profile_call = {"user_id": user_id, **changes}
        self.user.update(changes)
        return deepcopy(self.user)

    async def export_account(self, _user_id):
        return {
            "account": deepcopy(self.user),
            "reviews": [],
            "itineraries": [],
            "partners": [],
            "payment_orders": [
                {"order_id": "order-1", "snap_token": "secret", "midtrans": {}}
            ],
        }

    async def delete_account_graph(self, user_id, email, deleted_at):
        self.deleted = {"user_id": user_id, "email": email, "deleted_at": deleted_at}


class FakeRateRepository:
    def __init__(self, count=1):
        self.count = count
        self.calls = []

    async def increment(self, **kwargs):
        self.calls.append(kwargs)
        return self.count


class FakeEmail:
    def __init__(self):
        self.verifications = []
        self.resets = []

    async def send_verification(self, user, token):
        self.verifications.append((deepcopy(user), token))

    async def send_password_reset(self, user, token):
        self.resets.append((deepcopy(user), token))


class FakeGoogle:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error

    async def verify(self, _credential):
        if self.error:
            raise self.error
        return self.result


def test_identity_validates_session_version_and_redacts_password():
    user = user_document(auth_session_version=4)
    users = FakeUsers(user)
    tokens = AuthTokenService(SECRET)
    service = IdentityService(users, tokens)
    token = tokens.create_access(str(user["_id"]), user["email"], 4)

    identity = asyncio.run(service.authenticate(token))

    assert identity["id"] == str(user["_id"])
    assert "_id" not in identity
    assert "password_hash" not in identity

    revoked = tokens.create_access(str(user["_id"]), user["email"], 3)
    with pytest.raises(AuthError, match="Session has been revoked"):
        asyncio.run(service.authenticate(revoked))


def test_rate_limiter_uses_stable_bucket_and_rejects_excess():
    repository = FakeRateRepository(count=11)
    limiter = AuthRateLimiter(repository)

    with pytest.raises(AuthError, match="Too many attempts") as error:
        asyncio.run(limiter.enforce("login_failure", "USER@example.com", 10, 900))

    assert error.value.status_code == 429
    assert repository.calls[0]["action"] == "login_failure"
    assert repository.calls[0]["window_seconds"] == 900


def test_registration_requires_consent_and_sends_verification():
    users = FakeUsers()
    limiter = AuthRateLimiter(FakeRateRepository())
    tokens = AuthTokenService(SECRET)
    email = FakeEmail()
    use_case = RegisterUser(users, limiter, tokens, email)

    with pytest.raises(AuthError, match="Terms and Privacy"):
        asyncio.run(
            use_case.execute(
                RegisterIn(
                    email="USER@example.com",
                    password="password123",
                    name=" User ",
                    accepted_terms=False,
                ),
                "127.0.0.1",
            )
        )

    user, token = asyncio.run(
        use_case.execute(
            RegisterIn(
                email="USER@example.com",
                password="password123",
                name=" User ",
                accepted_terms=True,
            ),
            "127.0.0.1",
        )
    )
    assert user["email"] == "user@example.com"
    assert user["name"] == "User"
    assert email.verifications
    assert tokens.decode_access(token)["sub"] == str(user["_id"])


def test_login_preserves_dummy_hash_path_and_inactive_contract():
    limiter = AuthRateLimiter(FakeRateRepository())
    tokens = AuthTokenService(SECRET)
    missing = LoginUser(FakeUsers(), limiter, tokens)
    with pytest.raises(AuthError, match="Invalid email or password") as error:
        asyncio.run(missing.execute("missing@example.com", "wrong", "127.0.0.1"))
    assert error.value.status_code == 401

    inactive_user = user_document(account_active=False)
    inactive = LoginUser(FakeUsers(inactive_user), limiter, tokens)
    with pytest.raises(AuthError, match="Account is inactive") as error:
        asyncio.run(
            inactive.execute(inactive_user["email"], "password123", "127.0.0.1")
        )
    assert error.value.status_code == 403


def test_google_invalid_credential_is_rate_limited():
    rate_repository = FakeRateRepository()
    use_case = GoogleLoginUser(
        FakeUsers(user_document()),
        AuthRateLimiter(rate_repository),
        AuthTokenService(SECRET),
        FakeGoogle(error=GoogleCredentialInvalid("invalid")),
        enabled=True,
    )
    with pytest.raises(AuthError, match="Invalid or expired") as error:
        asyncio.run(use_case.execute("credential", "127.0.0.1"))
    assert error.value.status_code == 401
    assert rate_repository.calls[0]["action"] == "google_login_failure"


def test_password_reset_rotates_versions_and_invalidates_sessions():
    user = user_document(password_reset_version=2, auth_session_version=5)
    users = FakeUsers(user)
    tokens = AuthTokenService(SECRET)
    recovery = RecoverCredentials(
        users, AuthRateLimiter(FakeRateRepository()), tokens, FakeEmail()
    )
    token = tokens.create_action(user, "password_reset", 30, 2)

    asyncio.run(recovery.reset_password(token, "new-password", "127.0.0.1"))

    assert users.user["password_reset_version"] == 3
    assert users.user["auth_session_version"] == 6
    assert users.sessions_deleted == [str(user["_id"])]

    with pytest.raises(AuthError, match="already been used"):
        asyncio.run(recovery.reset_password(token, "new-password", "127.0.0.1"))


def test_profile_export_and_delete_apply_privacy_rules():
    user = user_document(google_id="google-id")
    users = FakeUsers(user)
    account = ManageAccount(users)
    payload = ProfileUpdateIn(
        name=" New Name ",
        preferred_language="en",
        interests=["lake", "lake", "nature"],
        home_city=" Medan ",
    )

    updated = asyncio.run(account.update_profile(str(user["_id"]), payload))
    assert updated["name"] == "New Name"
    assert users.profile_call["interests"] == ["lake", "nature"]

    exported = asyncio.run(account.export(str(user["_id"])))
    assert "password_hash" not in exported["account"]
    assert "google_id" not in exported["account"]
    assert "snap_token" not in exported["payment_orders"][0]

    asyncio.run(
        account.delete(
            {"id": str(user["_id"]), "role": "user"},
            AccountDeleteIn(confirmation="DELETE", password="password123"),
        )
    )
    assert users.deleted["user_id"] == str(user["_id"])
