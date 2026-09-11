from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import require_admin
from app.modules.media.dependencies import get_media_service
from app.modules.media.exceptions import MediaError
from app.modules.media.service import MediaService

router = APIRouter(prefix="/api")


async def media_error_handler(request: Request, error: MediaError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {MediaError: media_error_handler}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
    service: MediaService = Depends(get_media_service),
):
    return await service.upload(
        file.filename, await file.read(MediaService.MAX_SIZE + 1), admin
    )


@router.get("/files/{path:path}")
async def serve_file(path: str, service: MediaService = Depends(get_media_service)):
    data, content_type = await service.read_public(path)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
