"""Saved and public itinerary HTTP transport."""

from typing import List

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import get_current_user
from app.modules.itineraries.dependencies import get_itinerary_service
from app.modules.itineraries.exceptions import ItineraryError
from app.modules.itineraries.schemas import (
    ItineraryDuplicateIn,
    ItineraryIn,
    ItineraryOut,
    ItineraryUpdateIn,
    PublicItineraryOut,
    ShareIn,
)
from app.modules.itineraries.service import ItineraryService

router = APIRouter(prefix="/api")


async def itinerary_error_handler(
    request: Request, error: ItineraryError
) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {ItineraryError: itinerary_error_handler}


@router.post("/itineraries", response_model=ItineraryOut)
async def save_itinerary(
    payload: ItineraryIn,
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.create(payload, user)


@router.get("/itineraries", response_model=List[ItineraryOut])
async def list_itineraries(
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.list(user)


@router.get("/itineraries/{itin_id}", response_model=ItineraryOut)
async def get_itinerary(
    itin_id: str,
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.get(itin_id, user)


@router.put("/itineraries/{itin_id}", response_model=ItineraryOut)
async def update_itinerary(
    itin_id: str,
    payload: ItineraryUpdateIn,
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.update(itin_id, payload, user)


@router.post("/itineraries/{itin_id}/duplicate", response_model=ItineraryOut)
async def duplicate_itinerary(
    itin_id: str,
    payload: ItineraryDuplicateIn,
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.duplicate(itin_id, payload, user)


@router.patch("/itineraries/{itin_id}/share", response_model=ItineraryOut)
async def toggle_itinerary_share(
    itin_id: str,
    payload: ShareIn,
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.share(itin_id, payload.public, user)


@router.get("/public/itineraries/{slug}", response_model=PublicItineraryOut)
async def get_public_itinerary(
    slug: str, service: ItineraryService = Depends(get_itinerary_service)
):
    return await service.public(slug)


@router.delete("/itineraries/{itin_id}")
async def delete_itinerary(
    itin_id: str,
    user: dict = Depends(get_current_user),
    service: ItineraryService = Depends(get_itinerary_service),
):
    return await service.delete(itin_id, user)
