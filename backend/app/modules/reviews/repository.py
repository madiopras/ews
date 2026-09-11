"""MongoDB review adapter."""

from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from app.modules.reviews.exceptions import ReviewError


class MongoReviewRepository:
    def __init__(self, database: Any):
        self.reviews = database.reviews
        self.destinations = database.destinations

    @staticmethod
    def _object_id(value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise ReviewError(400, "Invalid id") from error

    async def list_visible(self, destination_id: str) -> list[dict[str, Any]]:
        return (
            await self.reviews.find(
                {
                    "destination_id": destination_id,
                    "moderation_status": {"$ne": "hidden"},
                }
            )
            .sort("created_at", -1)
            .to_list(500)
        )

    async def active_destination_exists(self, destination_id: str) -> bool:
        document = await self.destinations.find_one(
            {
                "_id": self._object_id(destination_id),
                "is_active": {"$ne": False},
            },
            {"_id": 1},
        )
        return document is not None

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self.reviews.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def get(self, review_id: str) -> dict[str, Any] | None:
        return await self.reviews.find_one({"_id": self._object_id(review_id)})

    async def update_owned(
        self, review_id: str, user_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None:
        return await self.reviews.find_one_and_update(
            {"_id": self._object_id(review_id), "user_id": user_id},
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )

    async def delete_authorized(
        self, review_id: str, user_id: str, *, is_admin: bool
    ) -> bool:
        query: dict[str, Any] = {"_id": self._object_id(review_id)}
        if not is_admin:
            query["user_id"] = user_id
        result = await self.reviews.delete_one(query)
        return result.deleted_count > 0
