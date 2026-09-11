"""Review business use cases and ownership policy."""

from datetime import datetime, timezone
from typing import Any

from app.modules.reviews.exceptions import ReviewError
from app.modules.reviews.mapper import review_document_to_response
from app.modules.reviews.ports import ReviewRepository
from app.modules.reviews.schemas import ReviewIn, ReviewOut


class ReviewService:
    def __init__(self, repository: ReviewRepository):
        self.repository = repository

    async def list(self, destination_id: str) -> dict[str, Any]:
        documents = await self.repository.list_visible(destination_id)
        reviews = [
            review_document_to_response(document).model_dump() for document in documents
        ]
        average = (
            sum(item["rating"] for item in reviews) / len(reviews) if reviews else 0
        )
        return {"reviews": reviews, "average": round(average, 1), "count": len(reviews)}

    async def create(
        self, destination_id: str, payload: ReviewIn, user: dict[str, Any]
    ) -> ReviewOut:
        if not await self.repository.active_destination_exists(destination_id):
            raise ReviewError(404, "Destination not found")
        document = {
            "destination_id": destination_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "rating": payload.rating,
            "comment": payload.comment,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return review_document_to_response(await self.repository.create(document))

    async def update(
        self, review_id: str, payload: ReviewIn, user: dict[str, Any]
    ) -> ReviewOut:
        review = await self.repository.get(review_id)
        if review is None:
            raise ReviewError(404, "Not found")
        if review.get("user_id") != user["id"]:
            raise ReviewError(403, "Forbidden")
        updated = await self.repository.update_owned(
            review_id,
            user["id"],
            {
                "rating": payload.rating,
                "comment": payload.comment,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        if updated is None:
            raise ReviewError(404, "Not found")
        return review_document_to_response(updated)

    async def delete(self, review_id: str, user: dict[str, Any]) -> dict[str, bool]:
        review = await self.repository.get(review_id)
        if review is None:
            raise ReviewError(404, "Not found")
        is_admin = user.get("role") == "admin"
        if review.get("user_id") != user["id"] and not is_admin:
            raise ReviewError(403, "Forbidden")
        deleted = await self.repository.delete_authorized(
            review_id, user["id"], is_admin=is_admin
        )
        if not deleted:
            raise ReviewError(404, "Not found")
        return {"ok": True}
