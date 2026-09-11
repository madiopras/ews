"""HTTP transport for Partner discovery, administration, and Mitra workspace."""

from typing import List, Literal

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
    require_admin,
)
from app.modules.partners.dependencies import get_partner_service
from app.modules.partners.exceptions import PartnerError
from app.modules.partners.schemas import (
    PartnerAdminOut,
    PartnerAdminPage,
    PartnerAnalyticsEventIn,
    PartnerAvailabilityIn,
    PartnerDraftIn,
    PartnerIn,
    PartnerMemberIn,
    PartnerOfferingIn,
    PartnerOfferingOut,
    PartnerOnboardingStartIn,
    PartnerOut,
    PartnerOwnerAssignIn,
    PartnerPublicDetailOut,
    PartnerPublicOut,
    PartnerSelfServiceIn,
    PartnerStatusIn,
    PartnerType,
    PartnerWorkspaceOut,
)
from app.modules.partners.service import PartnerService

router = APIRouter(prefix="/api")


async def partner_error_handler(request: Request, error: PartnerError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {PartnerError: partner_error_handler}


@router.post("/partners", response_model=PartnerOut)
async def register_partner(
    payload: PartnerIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.register(payload, user)


@router.post("/mitra/onboarding", response_model=PartnerWorkspaceOut, status_code=201)
async def start_partner_onboarding(
    payload: PartnerOnboardingStartIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.start_onboarding(payload, user)


@router.get("/mitra/partners", response_model=List[PartnerWorkspaceOut])
async def list_my_partners(
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.list_mine(user)


@router.get("/mitra/partners/{partner_id}", response_model=PartnerWorkspaceOut)
async def get_my_partner(
    partner_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.get_mine(partner_id, user)


@router.put("/mitra/partners/{partner_id}/draft", response_model=PartnerWorkspaceOut)
async def save_partner_draft(
    partner_id: str,
    payload: PartnerDraftIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.save_draft(partner_id, payload, user)


@router.post("/mitra/partners/{partner_id}/submit", response_model=PartnerWorkspaceOut)
async def submit_my_partner(
    partner_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.submit(partner_id, user, False)


@router.post(
    "/mitra/partners/{partner_id}/resubmit", response_model=PartnerWorkspaceOut
)
async def resubmit_my_partner(
    partner_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.submit(partner_id, user, True)


@router.post("/mitra/partners/{partner_id}/members", response_model=PartnerWorkspaceOut)
async def add_partner_staff(
    partner_id: str,
    payload: PartnerMemberIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.add_staff(partner_id, str(payload.email), user)


@router.delete(
    "/mitra/partners/{partner_id}/members/{member_user_id}",
    response_model=PartnerWorkspaceOut,
)
async def remove_partner_staff(
    partner_id: str,
    member_user_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.remove_staff(partner_id, member_user_id, user)


@router.put("/mitra/partners/{partner_id}/profile", response_model=PartnerWorkspaceOut)
async def update_my_partner_profile(
    partner_id: str,
    payload: PartnerSelfServiceIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.update_profile(partner_id, payload, user)


@router.patch(
    "/mitra/partners/{partner_id}/availability", response_model=PartnerWorkspaceOut
)
async def update_my_partner_availability(
    partner_id: str,
    payload: PartnerAvailabilityIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.availability(partner_id, payload, user)


@router.post(
    "/mitra/partners/{partner_id}/confirm-freshness", response_model=PartnerWorkspaceOut
)
async def confirm_my_partner_freshness(
    partner_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.confirm_freshness(partner_id, user)


@router.get(
    "/mitra/partners/{partner_id}/offerings", response_model=List[PartnerOfferingOut]
)
async def list_my_partner_offerings(
    partner_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.list_offerings(partner_id, user)


@router.post(
    "/mitra/partners/{partner_id}/offerings",
    response_model=PartnerOfferingOut,
    status_code=201,
)
async def create_my_partner_offering(
    partner_id: str,
    payload: PartnerOfferingIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.create_offering(partner_id, payload, user)


@router.put(
    "/mitra/partners/{partner_id}/offerings/{offering_id}",
    response_model=PartnerOfferingOut,
)
async def update_my_partner_offering(
    partner_id: str,
    offering_id: str,
    payload: PartnerOfferingIn,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.update_offering(partner_id, offering_id, payload, user)


@router.delete("/mitra/partners/{partner_id}/offerings/{offering_id}")
async def delete_my_partner_offering(
    partner_id: str,
    offering_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.delete_offering(partner_id, offering_id, user)


@router.get("/mitra/partners/{partner_id}/insights")
async def get_my_partner_insights(
    partner_id: str,
    days: int = 30,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.insights(partner_id, days, user)


@router.get("/partners/{partner_id}/public", response_model=PartnerPublicDetailOut)
async def get_public_partner(
    partner_id: str, service: PartnerService = Depends(get_partner_service)
):
    return await service.public_detail(partner_id)


@router.get("/partners", response_model=List[PartnerPublicOut])
async def list_partners(
    destination_id: str | None = None,
    type: PartnerType | None = None,
    service: PartnerService = Depends(get_partner_service),
):
    return await service.list_public(destination_id, type)


@router.post("/analytics/partner-events")
async def track_partner_event(
    payload: PartnerAnalyticsEventIn,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    service: PartnerService = Depends(get_partner_service),
):
    """Store only explicitly consented, pseudonymous product analytics."""

    return await service.track_event(
        payload,
        request.headers.get("x-analytics-consent", "").lower() == "granted",
        user,
    )


@router.post("/partners/admin", response_model=PartnerAdminOut)
async def create_partner_admin(
    payload: PartnerIn,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.create_admin(payload, admin)


@router.get("/partners/admin", response_model=List[PartnerAdminOut])
async def list_partners_admin(
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    del admin
    return await service.list_admin()


@router.get("/admin/partners", response_model=PartnerAdminPage)
async def list_partners_admin_page(
    q: str = "",
    type: PartnerType | None = None,
    approval: Literal[
        "all", "draft", "pending", "needs_revision", "approved", "rejected"
    ] = "all",
    status: Literal["all", "active", "inactive"] = "all",
    premium: bool | None = None,
    destination_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
    sort: str = "-created_at",
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    del admin
    return await service.admin_page(
        query_text=q,
        partner_type=type,
        approval=approval,
        status=status,
        premium=premium,
        destination_id=destination_id,
        page=page,
        page_size=page_size,
        sort=sort,
    )


@router.get("/admin/partners/{partner_id}", response_model=PartnerAdminOut)
async def get_partner_admin(
    partner_id: str,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    del admin
    return await service.get_admin(partner_id)


@router.put("/partners/{partner_id}", response_model=PartnerAdminOut)
async def update_partner_admin(
    partner_id: str,
    payload: PartnerIn,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.update_admin(partner_id, payload, admin)


@router.put("/admin/partners/{partner_id}/owner", response_model=PartnerAdminOut)
async def assign_partner_owner(
    partner_id: str,
    payload: PartnerOwnerAssignIn,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.assign_owner(partner_id, payload, admin)


@router.patch("/partners/{partner_id}/toggle-active", response_model=PartnerAdminOut)
async def toggle_partner_active(
    partner_id: str,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.toggle(partner_id, admin)


@router.patch("/partners/{partner_id}/status", response_model=PartnerAdminOut)
async def update_partner_status(
    partner_id: str,
    payload: PartnerStatusIn,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.status(partner_id, payload, admin)


@router.post("/partners/{partner_id}/upload-docs", response_model=PartnerAdminOut)
async def upload_partner_document(
    partner_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.upload_document(
        partner_id,
        document_type,
        file.filename or "document",
        file.content_type,
        await file.read(5 * 1024 * 1024 + 1),
        user,
    )


@router.get("/mitra/partners/{partner_id}/documents/{document_id}")
@router.get("/admin/partners/{partner_id}/documents/{document_id}")
async def download_partner_document(
    partner_id: str,
    document_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    result = await service.download_document(partner_id, document_id, user)
    return Response(
        content=result.data,
        media_type=result.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{result.filename}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete(
    "/partners/{partner_id}/documents/{document_id}", response_model=PartnerAdminOut
)
async def delete_partner_document(
    partner_id: str,
    document_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.delete_document(partner_id, document_id, user)


@router.post("/mitra/partners/{partner_id}/gallery", response_model=PartnerWorkspaceOut)
async def upload_partner_gallery_image(
    partner_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.upload_gallery(
        partner_id,
        file.filename or "image",
        file.content_type,
        await file.read(8 * 1024 * 1024 + 1),
        user,
    )


@router.delete(
    "/mitra/partners/{partner_id}/gallery/{image_id}",
    response_model=PartnerWorkspaceOut,
)
async def delete_partner_gallery_image(
    partner_id: str,
    image_id: str,
    user: dict = Depends(get_current_user),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.delete_gallery(partner_id, image_id, user)


@router.delete("/partners/{partner_id}")
async def delete_partner(
    partner_id: str,
    admin: dict = Depends(require_admin),
    service: PartnerService = Depends(get_partner_service),
):
    return await service.delete(partner_id, admin)
