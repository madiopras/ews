"""MongoDB implementation of destination read persistence operations."""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument

from app.modules.destinations.exceptions import InvalidDestinationId
from app.modules.destinations.ports import DestinationDocument

PUBLIC_FILTER = {"is_active": {"$ne": False}}

SEARCH_SORTS: dict[str, list[tuple[str, int]]] = {
    "updated": [("featured", -1), ("updated_at", -1), ("created_at", -1)],
    "name": [("name", 1)],
    "-name": [("name", -1)],
    "location": [("location", 1), ("name", 1)],
    "-location": [("location", -1), ("name", 1)],
}


class MongoDestinationRepository:
    """Issue destination read queries without owning business policy."""

    def __init__(self, database: Any):
        self.destinations = database.destinations
        self.wishlist_events = database.wishlist_events
        self.audit_logs = database.audit_logs

    @staticmethod
    def _object_id(destination_id: str) -> ObjectId:
        try:
            return ObjectId(destination_id)
        except Exception as error:
            raise InvalidDestinationId("Invalid id") from error

    async def list_public(
        self,
        *,
        category: str | None,
        search: str | None,
        featured: bool | None,
        limit: int,
    ) -> list[DestinationDocument]:
        query: dict[str, Any] = dict(PUBLIC_FILTER)
        if category:
            query["category"] = category
        if featured is not None:
            query["featured"] = featured
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"location": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]
        return await self.destinations.find(query).sort("created_at", -1).to_list(limit)

    async def search_public(
        self,
        *,
        search: str,
        category: str | None,
        location: str,
        sort: str,
        skip: int,
        limit: int,
    ) -> tuple[list[DestinationDocument], int]:
        query: dict[str, Any] = dict(PUBLIC_FILTER)
        if search:
            pattern = re.escape(search)
            query["$or"] = [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"name_en": {"$regex": pattern, "$options": "i"}},
                {"location": {"$regex": pattern, "$options": "i"}},
                {"description": {"$regex": pattern, "$options": "i"}},
                {"description_en": {"$regex": pattern, "$options": "i"}},
                {"tags": {"$regex": pattern, "$options": "i"}},
            ]
        if category:
            query["category"] = category
        if location:
            query["location"] = {
                "$regex": f"^{re.escape(location)}$",
                "$options": "i",
            }

        total = await self.destinations.count_documents(query)
        documents = await (
            self.destinations.find(query)
            .sort(SEARCH_SORTS[sort])
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )
        return documents, total

    async def suggestions(
        self, *, search: str, limit: int
    ) -> list[DestinationDocument]:
        pattern = re.escape(search)
        query = {
            **PUBLIC_FILTER,
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"name_en": {"$regex": pattern, "$options": "i"}},
                {"location": {"$regex": pattern, "$options": "i"}},
                {"tags": {"$regex": pattern, "$options": "i"}},
            ],
        }
        return await (
            self.destinations.find(query)
            .sort([("featured", -1), ("name", 1)])
            .limit(limit)
            .to_list(10)
        )

    async def locations(self) -> list[str]:
        return await self.destinations.distinct(
            "location",
            {
                **PUBLIC_FILTER,
                "location": {"$type": "string", "$ne": ""},
            },
        )

    async def batch_public(
        self, destination_ids: Sequence[str]
    ) -> list[DestinationDocument]:
        try:
            object_ids = [ObjectId(value) for value in destination_ids]
        except Exception as error:
            raise InvalidDestinationId("Invalid destination id") from error
        return await self.destinations.find(
            {"_id": {"$in": object_ids}, **PUBLIC_FILTER}
        ).to_list(len(object_ids))

    async def trending_public(
        self, *, since: datetime, limit: int
    ) -> list[DestinationDocument]:
        pipeline = [
            {"$match": {"created_at": {"$gte": since.isoformat()}}},
            {"$group": {"_id": "$destination_id", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
            {"$limit": limit},
        ]
        rows = await self.wishlist_events.aggregate(pipeline).to_list(limit)
        if not rows:
            return []

        order = {row["_id"]: index for index, row in enumerate(rows)}
        object_ids = []
        for row in rows:
            try:
                object_ids.append(ObjectId(row["_id"]))
            except Exception:
                continue
        documents = await self.destinations.find(
            {"_id": {"$in": object_ids}, **PUBLIC_FILTER}
        ).to_list(len(object_ids))
        documents.sort(key=lambda document: order.get(str(document["_id"]), 999))
        return documents

    async def get_public(self, destination_id: str) -> DestinationDocument | None:
        object_id = self._object_id(destination_id)
        return await self.destinations.find_one({"_id": object_id, **PUBLIC_FILTER})

    async def list_admin(self, *, limit: int) -> list[DestinationDocument]:
        return await self.destinations.find({}).sort("created_at", -1).to_list(limit)

    async def search_admin(
        self,
        *,
        query: dict[str, Any],
        sort_field: str,
        sort_direction: int,
        skip: int,
        limit: int,
    ) -> tuple[list[DestinationDocument], int]:
        total = await self.destinations.count_documents(query)
        documents = await (
            self.destinations.find(query)
            .sort(sort_field, sort_direction)
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )
        return documents, total

    async def get_admin(self, destination_id: str) -> DestinationDocument | None:
        return await self.destinations.find_one(
            {"_id": self._object_id(destination_id)}
        )

    async def create(self, document: DestinationDocument) -> DestinationDocument:
        result = await self.destinations.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def replace_fields(
        self, destination_id: str, changes: DestinationDocument
    ) -> DestinationDocument | None:
        return await self.destinations.find_one_and_update(
            {"_id": self._object_id(destination_id)},
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )

    async def toggle_active(
        self, destination_id: str, *, updated_at: str
    ) -> DestinationDocument | None:
        return await self.destinations.find_one_and_update(
            {"_id": self._object_id(destination_id)},
            [
                {
                    "$set": {
                        "is_active": {
                            "$eq": [{"$ifNull": ["$is_active", True]}, False]
                        },
                        "updated_at": updated_at,
                    }
                }
            ],
            return_document=ReturnDocument.AFTER,
        )

    async def delete(self, destination_id: str) -> DestinationDocument | None:
        return await self.destinations.find_one_and_delete(
            {"_id": self._object_id(destination_id)}
        )

    async def record_audit(
        self,
        actor: dict[str, Any],
        *,
        action: str,
        destination_id: str,
        details: dict[str, Any],
        created_at: str,
    ) -> None:
        await self.audit_logs.insert_one(
            {
                "admin_id": actor["id"],
                "admin_email": actor.get("email", ""),
                "action": action,
                "entity_type": "destination",
                "entity_id": destination_id,
                "details": details,
                "created_at": created_at,
            }
        )
