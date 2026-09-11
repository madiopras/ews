"""MongoDB wishlist adapter."""

from typing import Any

from bson import ObjectId

from app.modules.wishlist.exceptions import WishlistError


class MongoWishlistRepository:
    def __init__(self, database: Any):
        self.users = database.users
        self.destinations = database.destinations
        self.events = database.wishlist_events

    @staticmethod
    def _object_id(value: str, detail: str = "Invalid id") -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise WishlistError(400, detail) from error

    async def list_active(self, destination_ids: list[str]) -> list[dict[str, Any]]:
        object_ids = []
        for destination_id in destination_ids:
            try:
                object_ids.append(ObjectId(destination_id))
            except Exception:
                continue
        if not object_ids:
            return []
        return await self.destinations.find(
            {"_id": {"$in": object_ids}, "is_active": {"$ne": False}}
        ).to_list(500)

    async def active_destination_exists(self, destination_id: str) -> bool:
        document = await self.destinations.find_one(
            {
                "_id": self._object_id(destination_id),
                "is_active": {"$ne": False},
            },
            {"_id": 1},
        )
        return document is not None

    async def add(self, user_id: str, destination_id: str, *, created_at: str) -> None:
        await self.users.update_one(
            {"_id": self._object_id(user_id)},
            {"$addToSet": {"wishlist": destination_id}},
        )
        await self.events.insert_one(
            {
                "user_id": user_id,
                "destination_id": destination_id,
                "created_at": created_at,
            }
        )

    async def remove(self, user_id: str, destination_id: str) -> None:
        await self.users.update_one(
            {"_id": self._object_id(user_id)},
            {"$pull": {"wishlist": destination_id}},
        )
