"""HTTP routes for authentication, profile, and account use cases."""

from __future__ import annotations

from bson import json_util
from fastapi import APIRouter, Depends, Request, Response
from starlette.responses import JSONResponse

from app.api.dependencies import get_app_settings
from app.core import security
from app.core.config import Settings
from app.modules.auth.dependencies import (
    get_current_user,
    get_google_login_user,
    get_login_user,
    get_manage_account,
    get_recover_credentials,
    get_register_user,
)
from app.modules.auth.exceptions import AuthError
from app.modules.auth.mapper import user_document_to_response
from app.modules.auth.schemas import (
    AccountDeleteIn,
    ForgotPasswordIn,
    GoogleCredentialIn,
    LoginIn,
    ProfileUpdateIn,
    RegisterIn,
    ResetPasswordIn,
    UserOut,
    VerifyEmailIn,
)
from app.modules.auth.service import (
    GoogleLoginUser,
    LoginUser,
    ManageAccount,
    RecoverCredentials,
    RegisterUser,
)

router = APIRouter(prefix="/api")


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def auth_error_handler(request: Request, error: AuthError) -> JSONResponse:
    del request
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": error.detail},
    )


EXCEPTION_HANDLERS = {AuthError: auth_error_handler}


@router.post("/auth/register", response_model=UserOut)
async def register(
    payload: RegisterIn,
    response: Response,
    request: Request,
    use_case: RegisterUser = Depends(get_register_user),
):
    user, token = await use_case.execute(payload, _client_ip(request))
    security.set_access_token_cookie(
        response, token, request.app.state.settings.cookie_secure
    )
    return user_document_to_response(user)


@router.post("/auth/login", response_model=UserOut)
async def login(
    payload: LoginIn,
    response: Response,
    request: Request,
    use_case: LoginUser = Depends(get_login_user),
):
    user, token = await use_case.execute(
        str(payload.email), payload.password, _client_ip(request)
    )
    security.set_access_token_cookie(
        response, token, request.app.state.settings.cookie_secure
    )
    return user_document_to_response(user)


@router.get("/auth/google/config")
async def google_auth_config(settings: Settings = Depends(get_app_settings)):
    """Expose only the public GIS Client ID needed by the browser."""

    return {
        "enabled": bool(settings.google_oauth_enabled and settings.google_client_id),
        "client_id": settings.google_client_id if settings.google_oauth_enabled else "",
    }


@router.post("/auth/google", response_model=UserOut)
async def google_login(
    payload: GoogleCredentialIn,
    response: Response,
    request: Request,
    use_case: GoogleLoginUser = Depends(get_google_login_user),
):
    user, token = await use_case.execute(payload.credential, _client_ip(request))
    security.set_access_token_cookie(
        response, token, request.app.state.settings.cookie_secure
    )
    return user_document_to_response(user)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_document_to_response(user)


@router.post("/auth/forgot-password")
async def forgot_password(
    payload: ForgotPasswordIn,
    request: Request,
    use_case: RecoverCredentials = Depends(get_recover_credentials),
):
    await use_case.forgot_password(str(payload.email), _client_ip(request))
    return {
        "ok": True,
        "message": "If the account exists, reset instructions have been sent.",
    }


@router.post("/auth/reset-password")
async def reset_password(
    payload: ResetPasswordIn,
    request: Request,
    response: Response,
    use_case: RecoverCredentials = Depends(get_recover_credentials),
):
    await use_case.reset_password(payload.token, payload.password, _client_ip(request))
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.post("/auth/verify-email")
async def verify_email(
    payload: VerifyEmailIn,
    use_case: RecoverCredentials = Depends(get_recover_credentials),
):
    already_verified = await use_case.verify_email(payload.token)
    return {"ok": True, "already_verified": already_verified}


@router.post("/auth/verify-email/resend")
async def resend_verification(
    request: Request,
    user: dict = Depends(get_current_user),
    use_case: RecoverCredentials = Depends(get_recover_credentials),
):
    already_verified = await use_case.resend_verification(user, _client_ip(request))
    return {"ok": True, "already_verified": already_verified}


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdateIn,
    user: dict = Depends(get_current_user),
    use_case: ManageAccount = Depends(get_manage_account),
):
    updated = await use_case.update_profile(user["id"], payload)
    return user_document_to_response(updated)


@router.get("/account/export")
async def export_account(
    user: dict = Depends(get_current_user),
    use_case: ManageAccount = Depends(get_manage_account),
):
    content = json_util.dumps(
        await use_case.export(user["id"]), ensure_ascii=False, indent=2
    )
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": (
                "attachment; filename=explore-wisata-sumut-account.json"
            )
        },
    )


@router.delete("/account")
async def delete_account(
    payload: AccountDeleteIn,
    response: Response,
    user: dict = Depends(get_current_user),
    use_case: ManageAccount = Depends(get_manage_account),
):
    await use_case.delete(user, payload)
    response.delete_cookie("access_token", path="/")
    return {"ok": True}
