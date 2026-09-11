"""Authentication token policy over shared JWT primitives."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core import security
from app.modules.auth.exceptions import AuthError


class AuthTokenService:
    def __init__(self, secret: str):
        self.secret = secret

    def create_access(self, user_id: str, email: str, session_version: int = 0) -> str:
        return security.create_access_token(
            user_id,
            email,
            self.secret,
            session_version=session_version,
        )

    def decode_access(self, token: str) -> dict[str, Any]:
        try:
            payload = security.decode_token(token, self.secret)
        except jwt.ExpiredSignatureError as error:
            raise AuthError(401, "Token expired") from error
        except jwt.InvalidTokenError as error:
            raise AuthError(401, "Invalid token") from error
        if payload.get("type") != "access":
            raise AuthError(401, "Invalid token type")
        return payload

    def create_action(
        self,
        user: Mapping[str, Any],
        token_type: str,
        minutes: int,
        version: int,
    ) -> str:
        return security.encode_token(
            {
                "sub": str(user["_id"]),
                "email": user["email"],
                "type": token_type,
                "ver": version,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
            },
            self.secret,
        )

    def decode_action(self, token: str, expected_type: str) -> dict[str, Any]:
        try:
            payload = security.decode_token(token, self.secret)
        except jwt.ExpiredSignatureError as error:
            raise AuthError(400, "Token has expired") from error
        except jwt.InvalidTokenError as error:
            raise AuthError(400, "Invalid token") from error
        if payload.get("type") != expected_type:
            raise AuthError(400, "Invalid token type")
        return payload
