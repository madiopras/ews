"""Wishlist HTTP transport."""

from typing import List

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import get_current_user
from app.modules.destinations.schemas import DestinationOut
from app.modules.wishlist.dependencies import get_wishlist_service
from app.modules.wishlist.exceptions import WishlistError
from app.modules.wishlist.service import WishlistService

router = APIRouter(prefix="/api")


async def wishlist_error_handler(
    request: Request, error: WishlistError
) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {WishlistError: wishlist_error_handler}


@router.get("/wishlist", response_model=List[DestinationOut])
async def get_wishlist(
    user: dict = Depends(get_current_user),
    service: WishlistService = Depends(get_wishlist_service),
):
    return await service.list(user)


@router.post("/wishlist/{dest_id}")
async def add_wishlist(
    dest_id: str,
    user: dict = Depends(get_current_user),
    service: WishlistService = Depends(get_wishlist_service),
):
    return await service.add(dest_id, user)


@router.delete("/wishlist/{dest_id}")
async def remove_wishlist(
    dest_id: str,
    user: dict = Depends(get_current_user),
    service: WishlistService = Depends(get_wishlist_service),
):
    return await service.remove(dest_id, user)
