"""Request composition and authorization dependencies for authentication."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, Request

from app.api.dependencies import get_app_settings, get_database
from app.modules.auth.exceptions import AuthError
from app.modules.auth.gateways import GoogleTokenGateway, MongoAuthEmailGateway
from app.modules.auth.repository import MongoRateLimitRepository, MongoUserRepository
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


def access_token_from_request(request: Request) -> str | None:
    """Parse the existing cookie-first, bearer-second authentication contract."""

    token = request.cookies.get("access_token")
    if token:
        return token
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return None


def get_user_repository(request: Request) -> MongoUserRepository:
    return MongoUserRepository(get_database(request))


def get_rate_limiter(request: Request) -> AuthRateLimiter:
    return AuthRateLimiter(MongoRateLimitRepository(get_database(request)))


def get_token_service(request: Request) -> AuthTokenService:
    settings = get_app_settings(request)
    return AuthTokenService(settings.jwt_secret.get_secret_value())


def get_email_gateway(request: Request) -> MongoAuthEmailGateway:
    return MongoAuthEmailGateway(get_database(request), get_app_settings(request))


def get_google_gateway(request: Request) -> GoogleTokenGateway:
    return GoogleTokenGateway(get_app_settings(request).google_client_id)


def get_register_user(
    users: MongoUserRepository = Depends(get_user_repository),
    limiter: AuthRateLimiter = Depends(get_rate_limiter),
    tokens: AuthTokenService = Depends(get_token_service),
    email: MongoAuthEmailGateway = Depends(get_email_gateway),
) -> RegisterUser:
    return RegisterUser(users, limiter, tokens, email)


def get_login_user(
    users: MongoUserRepository = Depends(get_user_repository),
    limiter: AuthRateLimiter = Depends(get_rate_limiter),
    tokens: AuthTokenService = Depends(get_token_service),
) -> LoginUser:
    return LoginUser(users, limiter, tokens)


def get_google_login_user(
    request: Request,
    users: MongoUserRepository = Depends(get_user_repository),
    limiter: AuthRateLimiter = Depends(get_rate_limiter),
    tokens: AuthTokenService = Depends(get_token_service),
    google: GoogleTokenGateway = Depends(get_google_gateway),
) -> GoogleLoginUser:
    settings = get_app_settings(request)
    return GoogleLoginUser(
        users,
        limiter,
        tokens,
        google,
        enabled=bool(settings.google_oauth_enabled and settings.google_client_id),
    )


def get_recover_credentials(
    users: MongoUserRepository = Depends(get_user_repository),
    limiter: AuthRateLimiter = Depends(get_rate_limiter),
    tokens: AuthTokenService = Depends(get_token_service),
    email: MongoAuthEmailGateway = Depends(get_email_gateway),
) -> RecoverCredentials:
    return RecoverCredentials(users, limiter, tokens, email)


def get_manage_account(
    users: MongoUserRepository = Depends(get_user_repository),
) -> ManageAccount:
    return ManageAccount(users)


async def get_current_user(request: Request) -> dict[str, Any]:
    token = access_token_from_request(request)
    if not token:
        raise AuthError(401, "Not authenticated")
    service = IdentityService(get_user_repository(request), get_token_service(request))
    return await service.authenticate(token)


async def get_optional_user(request: Request) -> dict[str, Any] | None:
    if access_token_from_request(request) is None:
        return None
    return await get_current_user(request)


async def require_admin(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    return IdentityService.require_admin(user)
