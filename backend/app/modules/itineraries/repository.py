"""MongoDB saved itinerary adapter."""

from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from app.modules.itineraries.exceptions import ItineraryError


class MongoItineraryRepository:
    def __init__(self, database: Any):
        self.itineraries = database.itineraries
        self.destinations = database.destinations
        self.partners = database.partners
        self.offerings = database.partner_offerings

    @staticmethod
    def _object_id(value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise ItineraryError(400, "Invalid id") from error

    @staticmethod
    def _valid_object_ids(values: list[str]) -> list[ObjectId]:
        object_ids = []
        for value in values:
            try:
                object_ids.append(ObjectId(value))
            except Exception:
                continue
        return object_ids

    async def active_destination_ids(self, values: list[str]) -> set[str]:
        try:
            object_ids = [ObjectId(value) for value in values]
        except Exception as error:
            raise ItineraryError(400, "Invalid destination id") from error
        documents = await self.destinations.find(
            {"_id": {"$in": object_ids}, "is_active": {"$ne": False}},
            {"_id": 1},
        ).to_list(len(object_ids))
        return {str(document["_id"]) for document in documents}

    async def eligible_partners(self, values: list[str]) -> list[dict[str, Any]]:
        object_ids = self._valid_object_ids(values)
        if not object_ids:
            return []
        return await self.partners.find(
            {
                "_id": {"$in": object_ids},
                "status": "approved",
                "is_active": {"$ne": False},
                "accepting_contacts": {"$ne": False},
            }
        ).to_list(len(object_ids))

    async def active_offerings(self, partner_ids: list[str]) -> list[dict[str, Any]]:
        if not partner_ids:
            return []
        return await self.offerings.find(
            {"partner_id": {"$in": partner_ids}, "is_active": True}
        ).to_list(5000)

    async def destination_cards(self, values: list[str]) -> list[dict[str, Any]]:
        object_ids = self._valid_object_ids(values)
        if not object_ids:
            return []
        return await self.destinations.find(
            {"_id": {"$in": object_ids}, "is_active": {"$ne": False}}
        ).to_list(len(object_ids))

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self.itineraries.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def list_for_user(self, user_id: str) -> list[dict[str, Any]]:
        return (
            await self.itineraries.find({"user_id": user_id})
            .sort([("updated_at", -1), ("created_at", -1)])
            .to_list(500)
        )

    async def get(self, itinerary_id: str) -> dict[str, Any] | None:
        return await self.itineraries.find_one({"_id": self._object_id(itinerary_id)})

    async def update_owned(
        self, itinerary_id: str, user_id: str, changes: dict[str, Any]
    ) -> dict[str, Any] | None:
        return await self.itineraries.find_one_and_update(
            {"_id": self._object_id(itinerary_id), "user_id": user_id},
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )

    async def delete_owned(self, itinerary_id: str, user_id: str) -> bool:
        result = await self.itineraries.delete_one(
            {"_id": self._object_id(itinerary_id), "user_id": user_id}
        )
        return result.deleted_count > 0

    async def get_public(self, slug: str) -> dict[str, Any] | None:
        return await self.itineraries.find_one({"share_slug": slug, "is_public": True})
