"""HTTP transport for the public destination read vertical slice."""

from __future__ import annotations

from typing import List, Literal

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.api.dependencies import get_destination_admin_service, get_destination_service
from app.modules.auth.dependencies import require_admin
from app.modules.destinations.exceptions import (
    DestinationNotFound,
    DestinationValidationError,
    InvalidDestinationId,
)
from app.modules.destinations.schemas import (
    Category,
    DestinationAdminPage,
    DestinationBatchIn,
    DestinationIn,
    DestinationOut,
    DestinationPublicPage,
    DestinationSort,
    DestinationSuggestion,
)
from app.modules.destinations.service import DestinationAdminService, DestinationService

router = APIRouter(prefix="/api")


async def invalid_destination_id_handler(
    request: Request, error: InvalidDestinationId
) -> JSONResponse:
    del request
    return JSONResponse(status_code=400, content={"detail": error.detail})


async def destination_not_found_handler(
    request: Request, error: DestinationNotFound
) -> JSONResponse:
    del request
    return JSONResponse(status_code=404, content={"detail": error.detail})


EXCEPTION_HANDLERS = {
    InvalidDestinationId: invalid_destination_id_handler,
    DestinationNotFound: destination_not_found_handler,
    DestinationValidationError: invalid_destination_id_handler,
}


@router.get("/destinations/admin", response_model=List[DestinationOut])
async def list_destinations_admin(
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    del admin
    return await service.list_all()


@router.get("/admin/destinations", response_model=DestinationAdminPage)
async def list_destinations_admin_page(
    q: str = "",
    category: Category | None = None,
    status: Literal["all", "active", "inactive"] = "all",
    featured: bool | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    page: int = 1,
    page_size: int = 25,
    sort: str = "-created_at",
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    del admin
    return await service.search(
        query_text=q,
        category=category,
        status=status,
        featured=featured,
        min_price=min_price,
        max_price=max_price,
        page=page,
        page_size=page_size,
        sort=sort,
    )


@router.get("/admin/destinations/{dest_id}", response_model=DestinationOut)
async def get_destination_admin(
    dest_id: str,
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    del admin
    return await service.get(dest_id)


@router.post("/destinations", response_model=DestinationOut)
async def create_destination(
    payload: DestinationIn,
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    return await service.create(payload, admin)


@router.put("/destinations/{dest_id}", response_model=DestinationOut)
async def update_destination(
    dest_id: str,
    payload: DestinationIn,
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    return await service.update(dest_id, payload, admin)


@router.patch("/destinations/{dest_id}/toggle-active", response_model=DestinationOut)
async def toggle_destination_active(
    dest_id: str,
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    return await service.toggle(dest_id, admin)


@router.delete("/destinations/{dest_id}")
async def delete_destination(
    dest_id: str,
    admin: dict = Depends(require_admin),
    service: DestinationAdminService = Depends(get_destination_admin_service),
):
    return await service.delete(dest_id, admin)


@router.get("/destinations", response_model=List[DestinationOut])
async def list_destinations(
    category: str | None = None,
    search: str | None = None,
    featured: bool | None = None,
    service: DestinationService = Depends(get_destination_service),
):
    return await service.list_destinations(
        category=category, search=search, featured=featured
    )


@router.get("/destinations/search", response_model=DestinationPublicPage)
async def search_destinations(
    q: str = "",
    category: Category | None = None,
    location: str = "",
    sort: DestinationSort = "updated",
    page: int = 1,
    page_size: int = 12,
    service: DestinationService = Depends(get_destination_service),
):
    return await service.search_destinations(
        query=q,
        category=category,
        location=location,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/destinations/suggestions", response_model=List[DestinationSuggestion])
async def destination_suggestions(
    q: str,
    limit: int = 6,
    service: DestinationService = Depends(get_destination_service),
):
    return await service.suggestions(query=q, limit=limit)


@router.get("/destinations/locations", response_model=List[str])
async def destination_locations(
    service: DestinationService = Depends(get_destination_service),
):
    return await service.locations()


@router.post("/destinations/batch", response_model=List[DestinationOut])
async def destination_batch(
    payload: DestinationBatchIn,
    service: DestinationService = Depends(get_destination_service),
):
    return await service.batch(payload.ids)


@router.get("/destinations/trending", response_model=List[DestinationOut])
async def trending(
    days: int = 30,
    limit: int = 6,
    service: DestinationService = Depends(get_destination_service),
):
    return await service.trending(days=days, limit=limit)


@router.get("/destinations/{dest_id}", response_model=DestinationOut)
async def get_destination(
    dest_id: str,
    service: DestinationService = Depends(get_destination_service),
):
    return await service.get_destination(dest_id)
