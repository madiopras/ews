"""Review HTTP transport."""

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.modules.auth.dependencies import get_current_user
from app.modules.reviews.dependencies import get_review_service
from app.modules.reviews.exceptions import ReviewError
from app.modules.reviews.schemas import ReviewIn, ReviewOut
from app.modules.reviews.service import ReviewService

router = APIRouter(prefix="/api")


async def review_error_handler(request: Request, error: ReviewError) -> JSONResponse:
    del request
    return JSONResponse(status_code=error.status_code, content={"detail": error.detail})


EXCEPTION_HANDLERS = {ReviewError: review_error_handler}


@router.get("/destinations/{dest_id}/reviews")
async def list_reviews(
    dest_id: str, service: ReviewService = Depends(get_review_service)
):
    return await service.list(dest_id)


@router.post("/destinations/{dest_id}/reviews", response_model=ReviewOut)
async def create_review(
    dest_id: str,
    payload: ReviewIn,
    user: dict = Depends(get_current_user),
    service: ReviewService = Depends(get_review_service),
):
    return await service.create(dest_id, payload, user)


@router.put("/reviews/{review_id}", response_model=ReviewOut)
async def update_review(
    review_id: str,
    payload: ReviewIn,
    user: dict = Depends(get_current_user),
    service: ReviewService = Depends(get_review_service),
):
    return await service.update(review_id, payload, user)


@router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    user: dict = Depends(get_current_user),
    service: ReviewService = Depends(get_review_service),
):
    return await service.delete(review_id, user)
