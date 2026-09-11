"""Framework-light password, token, and security-cookie primitives."""

from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from starlette.responses import Response

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL = timedelta(days=7)
ACCESS_TOKEN_COOKIE = "access_token"
PLANNER_GUEST_COOKIE = "planner_guest"

# A valid bcrypt hash used only to equalize invalid-login password work. It is
# not an account credential and avoids generating a new hash during import.
DUMMY_PASSWORD_HASH = "$2b$12$..Y.0D8wcOxz9o9WKgRjf.CRbePZrbWHVdTV4ZBaZQZKN.1L/OStu"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def encode_token(payload: dict[str, Any], secret: str) -> str:
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str, secret: str) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])


def create_access_token(
    user_id: str,
    email: str,
    secret: str,
    session_version: int = 0,
    now: datetime | None = None,
) -> str:
    issued_at = now or datetime.now(timezone.utc)
    return encode_token(
        {
            "sub": user_id,
            "email": email,
            "sv": session_version,
            "exp": issued_at + ACCESS_TOKEN_TTL,
            "type": "access",
        },
        secret,
    )


def identity_hash(value: str, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def create_planner_guest_token(
    secret: str,
    ttl_days: int,
    identity: str | None = None,
    now: datetime | None = None,
) -> tuple[str, str]:
    identity = identity or uuid.uuid4().hex
    issued_at = now or datetime.now(timezone.utc)
    token = encode_token(
        {
            "jti": identity,
            "type": "planner_guest",
            "exp": issued_at + timedelta(days=ttl_days),
        },
        secret,
    )
    return identity, token


def set_security_cookie(
    response: Response,
    *,
    key: str,
    value: str,
    secure: bool,
    max_age: int,
    path: str,
) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=secure,
        samesite="none" if secure else "lax",
        max_age=max_age,
        path=path,
    )


def set_access_token_cookie(response: Response, token: str, secure: bool) -> None:
    set_security_cookie(
        response,
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        secure=secure,
        max_age=int(ACCESS_TOKEN_TTL.total_seconds()),
        path="/",
    )


def set_planner_guest_cookie(
    response: Response, token: str, ttl_days: int, secure: bool
) -> None:
    set_security_cookie(
        response,
        key=PLANNER_GUEST_COOKIE,
        value=token,
        secure=secure,
        max_age=ttl_days * 24 * 3600,
        path="/api",
    )
