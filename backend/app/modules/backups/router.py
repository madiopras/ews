from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import require_admin
from app.modules.backups.dependencies import get_backup_service
from app.modules.backups.exceptions import BackupError
from app.modules.backups.service import BackupService

router = APIRouter(prefix="/api")


async def backup_error_handler(request: Request, error: BackupError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {BackupError: backup_error_handler}


@router.get("/admin/backups/status")
async def backup_status(
    admin: dict = Depends(require_admin),
    service: BackupService = Depends(get_backup_service),
):
    del admin
    return await service.status()


@router.get("/admin/backups")
async def list_backups(
    page: int = 1,
    page_size: int = 25,
    q: str = "",
    status: Optional[str] = None,
    sort: str = "-created_at",
    admin: dict = Depends(require_admin),
    service: BackupService = Depends(get_backup_service),
):
    del admin
    return await service.page(page, page_size, q, status, sort)


@router.post("/admin/backups", status_code=202)
async def create_backup(
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_admin),
    service: BackupService = Depends(get_backup_service),
):
    output, job_id = await service.create(admin)
    background_tasks.add_task(service.run, job_id)
    return output


@router.get("/admin/backups/{backup_id}/download")
async def download_backup(
    backup_id: str,
    admin: dict = Depends(require_admin),
    service: BackupService = Depends(get_backup_service),
):
    del admin
    path, filename = await service.download(backup_id)
    return FileResponse(
        path,
        media_type="application/gzip",
        filename=filename,
        headers={"Cache-Control": "no-store"},
    )


@router.delete("/admin/backups/{backup_id}")
async def delete_backup(
    backup_id: str,
    admin: dict = Depends(require_admin),
    service: BackupService = Depends(get_backup_service),
):
    return await service.delete(backup_id, admin)
