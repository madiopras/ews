"""Authentication and account application use cases."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

from app.core.security import DUMMY_PASSWORD_HASH, hash_password, verify_password
from app.modules.auth.exceptions import (
    AuthError,
    DuplicateEmailError,
    GoogleCredentialInvalid,
)
from app.modules.auth.mapper import authenticated_user
from app.modules.auth.ports import (
    AuthEmailGateway,
    GoogleIdentityGateway,
    RateLimitRepository,
    UserDocument,
    UserRepository,
)
from app.modules.auth.schemas import AccountDeleteIn, ProfileUpdateIn, RegisterIn
from app.modules.auth.tokens import AuthTokenService


class AuthRateLimiter:
    def __init__(self, repository: RateLimitRepository):
        self.repository = repository

    async def enforce(
        self, action: str, identifier: str, limit: int, window_seconds: int
    ) -> None:
        now = datetime.now(timezone.utc)
        count = await self.repository.increment(
            action=action,
            identifier=identifier,
            bucket=int(now.timestamp()) // window_seconds,
            now=now,
            window_seconds=window_seconds,
        )
        if count > limit:
            raise AuthError(429, "Too many attempts. Please try again later.")


class IdentityService:
    def __init__(self, users: UserRepository, tokens: AuthTokenService):
        self.users = users
        self.tokens = tokens

    async def authenticate(self, token: str) -> dict[str, Any]:
        payload = self.tokens.decode_access(token)
        user = await self.users.find_by_id(str(payload.get("sub", "")))
        if not user:
            raise AuthError(401, "User not found")
        if user.get("account_active", True) is False:
            raise AuthError(403, "Account is inactive")
        if int(payload.get("sv", 0)) != int(user.get("auth_session_version", 0)):
            raise AuthError(401, "Session has been revoked")
        return authenticated_user(user)

    @staticmethod
    def require_admin(user: Mapping[str, Any]) -> dict[str, Any]:
        if user.get("role") != "admin":
            raise AuthError(403, "Admin access required")
        return dict(user)


class RegisterUser:
    def __init__(
        self,
        users: UserRepository,
        limiter: AuthRateLimiter,
        tokens: AuthTokenService,
        email_gateway: AuthEmailGateway,
    ):
        self.users = users
        self.limiter = limiter
        self.tokens = tokens
        self.email_gateway = email_gateway

    async def execute(
        self, payload: RegisterIn, client_ip: str
    ) -> tuple[UserDocument, str]:
        email = payload.email.lower()
        if not payload.accepted_terms:
            raise AuthError(400, "Terms and Privacy consent is required")
        await self.limiter.enforce("register_ip", client_ip, 100, 3600)
        await self.limiter.enforce("register_email", email, 3, 3600)
        if await self.users.find_by_email(email):
            raise AuthError(400, "Email already registered")
        now = datetime.now(timezone.utc).isoformat()
        document: UserDocument = {
            "email": email,
            "password_hash": await asyncio.to_thread(hash_password, payload.password),
            "name": payload.name.strip(),
            "role": "user",
            "account_active": True,
            "auth_provider": "password",
            "email_verified": False,
            "email_verification_version": 0,
            "password_reset_version": 0,
            "auth_session_version": 0,
            "preferred_language": "id",
            "interests": [],
            "home_city": "",
            "terms_accepted_at": now,
            "wishlist": [],
            "created_at": now,
            "updated_at": now,
        }
        try:
            user = await self.users.insert(document)
        except DuplicateEmailError as error:
            raise AuthError(400, "Email already registered") from error
        token = self.tokens.create_access(str(user["_id"]), email, 0)
        verification_token = self.tokens.create_action(
            user, "email_verification", 24 * 60, 0
        )
        await self.email_gateway.send_verification(user, verification_token)
        return user, token


class LoginUser:
    def __init__(
        self,
        users: UserRepository,
        limiter: AuthRateLimiter,
        tokens: AuthTokenService,
    ):
        self.users = users
        self.limiter = limiter
        self.tokens = tokens

    async def execute(
        self, email: str, password: str, client_ip: str
    ) -> tuple[UserDocument, str]:
        normalized_email = email.lower()
        user = await self.users.find_by_email(normalized_email)
        password_hash = user.get("password_hash", "") if user else DUMMY_PASSWORD_HASH
        password_valid = await asyncio.to_thread(
            verify_password, password, password_hash
        )
        failure_identifier = f"{client_ip}:{normalized_email}"
        if not user or not password_valid:
            await self.limiter.enforce("login_failure", failure_identifier, 10, 900)
            raise AuthError(401, "Invalid email or password")
        if user.get("account_active", True) is False:
            await self.limiter.enforce("login_failure", failure_identifier, 10, 900)
            raise AuthError(403, "Account is inactive")
        token = self.tokens.create_access(
            str(user["_id"]),
            normalized_email,
            int(user.get("auth_session_version", 0)),
        )
        return user, token


class GoogleLoginUser:
    def __init__(
        self,
        users: UserRepository,
        limiter: AuthRateLimiter,
        tokens: AuthTokenService,
        google: GoogleIdentityGateway,
        *,
        enabled: bool,
    ):
        self.users = users
        self.limiter = limiter
        self.tokens = tokens
        self.google = google
        self.enabled = enabled

    async def execute(
        self, credential: str, client_ip: str
    ) -> tuple[UserDocument, str]:
        if not self.enabled:
            raise AuthError(503, "Google sign-in is not configured")
        try:
            data = await self.google.verify(credential)
        except GoogleCredentialInvalid as error:
            await self.limiter.enforce("google_login_failure", client_ip, 10, 900)
            raise AuthError(401, "Invalid or expired Google credential") from error
        except Exception as error:
            raise AuthError(503, "Google sign-in is temporarily unavailable") from error

        user = await self._upsert(data)
        token = self.tokens.create_access(
            str(user["_id"]),
            user["email"],
            int(user.get("auth_session_version", 0)),
        )
        return user, token

    async def _upsert(self, data: Mapping[str, str]) -> UserDocument:
        now = datetime.now(timezone.utc).isoformat()
        user = await self.users.find_by_google_id(data["id"])
        if not user:
            user = await self.users.find_by_email(data["email"])
        if user:
            return await self._link_existing(user, data, now)

        document: UserDocument = {
            "email": data["email"],
            "name": data.get("name") or data["email"].split("@")[0],
            "role": "user",
            "account_active": True,
            "wishlist": [],
            "google_id": data["id"],
            "picture": data.get("picture", ""),
            "auth_provider": "google",
            "email_verified": True,
            "auth_session_version": 0,
            "password_reset_version": 0,
            "email_verification_version": 0,
            "preferred_language": "id",
            "interests": [],
            "home_city": "",
            "created_at": now,
            "updated_at": now,
        }
        try:
            return await self.users.insert(document)
        except DuplicateEmailError:
            existing = await self.users.find_by_email(data["email"])
            if not existing:
                raise
            return await self._link_existing(existing, data, now)

    async def _link_existing(
        self,
        user: UserDocument,
        data: Mapping[str, str],
        now: str,
    ) -> UserDocument:
        if user.get("account_active", True) is False:
            raise AuthError(403, "Account is inactive")
        changes = {
            "google_id": data["id"],
            "picture": data.get("picture", ""),
            "email_verified": True,
            "updated_at": now,
        }
        if not user.get("name"):
            changes["name"] = data.get("name") or data["email"].split("@")[0]
        return await self.users.update_google_identity(str(user["_id"]), changes)


class RecoverCredentials:
    def __init__(
        self,
        users: UserRepository,
        limiter: AuthRateLimiter,
        tokens: AuthTokenService,
        email_gateway: AuthEmailGateway,
    ):
        self.users = users
        self.limiter = limiter
        self.tokens = tokens
        self.email_gateway = email_gateway

    async def forgot_password(self, email: str, client_ip: str) -> None:
        normalized_email = email.lower()
        await self.limiter.enforce("forgot_password_ip", client_ip, 10, 3600)
        await self.limiter.enforce("forgot_password_email", normalized_email, 3, 3600)
        user = await self.users.find_by_email(normalized_email, active_only=True)
        if user and user.get("password_hash"):
            version = int(user.get("password_reset_version", 0))
            token = self.tokens.create_action(user, "password_reset", 30, version)
            await self.email_gateway.send_password_reset(user, token)

    async def reset_password(self, token: str, password: str, client_ip: str) -> None:
        await self.limiter.enforce("reset_password", client_ip, 15, 3600)
        payload = self.tokens.decode_action(token, "password_reset")
        user = await self.users.find_by_id(
            str(payload.get("sub", "")), active_only=True
        )
        if not user or user.get("email") != payload.get("email"):
            raise AuthError(400, "Invalid token")
        current_version = int(user.get("password_reset_version", 0))
        if int(payload.get("ver", -1)) != current_version:
            raise AuthError(400, "Token has already been used")
        changed = await self.users.update_password_if_version(
            str(user["_id"]),
            current_version,
            await asyncio.to_thread(hash_password, password),
            int(user.get("auth_session_version", 0)) + 1,
            datetime.now(timezone.utc).isoformat(),
        )
        if not changed:
            raise AuthError(409, "Password reset state changed. Request a new link.")
        await self.users.delete_sessions(str(user["_id"]))

    async def verify_email(self, token: str) -> bool:
        payload = self.tokens.decode_action(token, "email_verification")
        user = await self.users.find_by_id(
            str(payload.get("sub", "")), active_only=True
        )
        if not user or user.get("email") != payload.get("email"):
            raise AuthError(400, "Invalid token")
        if user.get("email_verified"):
            return True
        if int(payload.get("ver", -1)) != int(
            user.get("email_verification_version", 0)
        ):
            raise AuthError(400, "Token has been replaced by a newer link")
        await self.users.mark_email_verified(
            str(user["_id"]), datetime.now(timezone.utc).isoformat()
        )
        return False

    async def resend_verification(
        self, user: Mapping[str, Any], client_ip: str
    ) -> bool:
        if user.get("email_verified"):
            return True
        await self.limiter.enforce(
            "verify_resend", f"{client_ip}:{user['email']}", 3, 3600
        )
        updated = await self.users.increment_verification_version(str(user["id"]))
        version = int(updated.get("email_verification_version", 0))
        token = self.tokens.create_action(
            updated, "email_verification", 24 * 60, version
        )
        await self.email_gateway.send_verification(updated, token)
        return False


class ManageAccount:
    def __init__(self, users: UserRepository):
        self.users = users

    async def update_profile(
        self, user_id: str, payload: ProfileUpdateIn
    ) -> UserDocument:
        return await self.users.update_profile(
            user_id,
            name=payload.name.strip(),
            preferred_language=payload.preferred_language,
            interests=list(dict.fromkeys(payload.interests)),
            home_city=payload.home_city.strip(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

    async def export(self, user_id: str) -> dict[str, Any]:
        export = await self.users.export_account(user_id)
        account = export["account"]
        for field in (
            "password_hash",
            "google_id",
            "auth_session_version",
            "password_reset_version",
            "email_verification_version",
        ):
            account.pop(field, None)
        for payment in export["payment_orders"]:
            payment.pop("snap_token", None)
            payment.pop("midtrans", None)
        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            **export,
        }

    async def delete(
        self, identity: Mapping[str, Any], payload: AccountDeleteIn
    ) -> None:
        if payload.confirmation != "DELETE":
            raise AuthError(400, "Type DELETE to confirm account deletion")
        if identity.get("role") == "admin":
            raise AuthError(403, "Admin accounts cannot be deleted here")
        user = await self.users.find_by_id(str(identity["id"]))
        if not user:
            raise AuthError(404, "Account not found")
        if user.get("password_hash") and not await asyncio.to_thread(
            verify_password, payload.password or "", user["password_hash"]
        ):
            raise AuthError(401, "Password is incorrect")
        await self.users.delete_account_graph(
            str(identity["id"]),
            str(user.get("email", "")),
            datetime.now(timezone.utc).isoformat(),
        )
