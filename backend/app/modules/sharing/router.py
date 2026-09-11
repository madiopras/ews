from fastapi import APIRouter, Depends, Request, Response
from starlette.responses import JSONResponse

from app.modules.sharing.dependencies import get_sharing_service
from app.modules.sharing.exceptions import SharingError
from app.modules.sharing.service import SharingService

router = APIRouter(prefix="/api")


async def sharing_error_handler(request: Request, error: SharingError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {SharingError: sharing_error_handler}


@router.get("/share/{slug}/image.png")
async def share_card_image(
    slug: str, service: SharingService = Depends(get_sharing_service)
):
    return Response(
        content=await service.image(slug),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=600"},
    )


@router.get("/share/{slug}")
async def share_preview_page(
    slug: str, request: Request, service: SharingService = Depends(get_sharing_service)
):
    page, status = await service.preview(slug, request.headers)
    return Response(content=page, media_type="text/html", status_code=status)
