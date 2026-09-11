"""MongoDB persistence adapters for authentication and account data."""

from __future__ import annotations

import asyncio
import hashlib
import re
from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.modules.auth.exceptions import DuplicateEmailError
from app.modules.auth.ports import UserDocument


def _object_id(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except Exception:
        return None


class MongoUserRepository:
    def __init__(self, database: Any):
        self.database = database

    async def find_by_id(
        self, user_id: str, *, active_only: bool = False
    ) -> UserDocument | None:
        object_id = _object_id(user_id)
        if object_id is None:
            return None
        query: dict[str, Any] = {"_id": object_id}
        if active_only:
            query["account_active"] = {"$ne": False}
        return await self.database.users.find_one(query)

    async def find_by_email(
        self, email: str, *, active_only: bool = False
    ) -> UserDocument | None:
        query: dict[str, Any] = {"email": email}
        if active_only:
            query["account_active"] = {"$ne": False}
        return await self.database.users.find_one(query)

    async def find_by_google_id(self, google_id: str) -> UserDocument | None:
        return await self.database.users.find_one({"google_id": google_id})

    async def insert(self, document: UserDocument) -> UserDocument:
        try:
            result = await self.database.users.insert_one(document)
        except DuplicateKeyError as error:
            raise DuplicateEmailError from error
        document["_id"] = result.inserted_id
        return document

    async def update_google_identity(
        self, user_id: str, changes: Mapping[str, Any]
    ) -> UserDocument:
        object_id = _object_id(user_id)
        if object_id is None:
            raise RuntimeError("Persisted user has an invalid identifier")
        await self.database.users.update_one(
            {"_id": object_id}, {"$set": dict(changes)}
        )
        return await self.database.users.find_one({"_id": object_id})

    async def update_password_if_version(
        self,
        user_id: str,
        current_version: int,
        password_hash: str,
        session_version: int,
        updated_at: str,
    ) -> bool:
        object_id = _object_id(user_id)
        if object_id is None:
            return False
        updated = await self.database.users.update_one(
            {
                "_id": object_id,
                "password_reset_version": {"$in": [current_version, None]},
            },
            {
                "$set": {
                    "password_hash": password_hash,
                    "password_reset_version": current_version + 1,
                    "auth_session_version": session_version,
                    "updated_at": updated_at,
                }
            },
        )
        return updated.modified_count == 1

    async def delete_sessions(self, user_id: str) -> None:
        await self.database.user_sessions.delete_many({"user_id": user_id})

    async def mark_email_verified(self, user_id: str, verified_at: str) -> None:
        object_id = _object_id(user_id)
        if object_id is None:
            return
        await self.database.users.update_one(
            {"_id": object_id},
            {
                "$set": {
                    "email_verified": True,
                    "email_verified_at": verified_at,
                }
            },
        )

    async def increment_verification_version(self, user_id: str) -> UserDocument:
        object_id = _object_id(user_id)
        if object_id is None:
            raise RuntimeError("Authenticated user has an invalid identifier")
        return await self.database.users.find_one_and_update(
            {"_id": object_id},
            {"$inc": {"email_verification_version": 1}},
            return_document=ReturnDocument.AFTER,
        )

    async def update_profile(
        self,
        user_id: str,
        *,
        name: str,
        preferred_language: str,
        interests: Sequence[str],
        home_city: str,
        updated_at: str,
    ) -> UserDocument:
        object_id = _object_id(user_id)
        if object_id is None:
            raise RuntimeError("Authenticated user has an invalid identifier")
        await asyncio.gather(
            self.database.users.update_one(
                {"_id": object_id},
                {
                    "$set": {
                        "name": name,
                        "preferred_language": preferred_language,
                        "interests": list(interests),
                        "home_city": home_city,
                        "updated_at": updated_at,
                    }
                },
            ),
            self.database.reviews.update_many(
                {"user_id": user_id}, {"$set": {"user_name": name}}
            ),
            self.database.itineraries.update_many(
                {"user_id": user_id}, {"$set": {"author_name": name}}
            ),
        )
        return await self.database.users.find_one({"_id": object_id})

    async def export_account(self, user_id: str) -> dict[str, Any]:
        object_id = _object_id(user_id)
        if object_id is None:
            raise RuntimeError("Authenticated user has an invalid identifier")
        account = await self.database.users.find_one({"_id": object_id})
        reviews, itineraries, partners, payments = await asyncio.gather(
            self.database.reviews.find({"user_id": user_id}).to_list(1000),
            self.database.itineraries.find({"user_id": user_id}).to_list(1000),
            self.database.partners.find({"owner_user_id": user_id}).to_list(1000),
            self.database.payment_orders.find({"created_by_user_id": user_id}).to_list(
                1000
            ),
        )
        return {
            "account": account,
            "reviews": reviews,
            "itineraries": itineraries,
            "partners": partners,
            "payment_orders": payments,
        }

    async def delete_account_graph(
        self, user_id: str, email: str, deleted_at: str
    ) -> None:
        await asyncio.gather(
            self.database.reviews.delete_many({"user_id": user_id}),
            self.database.itineraries.delete_many({"user_id": user_id}),
            self.database.wishlist_events.delete_many({"user_id": user_id}),
            self.database.user_sessions.delete_many({"user_id": user_id}),
            self.database.email_outbox.delete_many({"recipient": email}),
            self.database.ai_planner_logs.update_many(
                {"user_id": user_id},
                {"$set": {"user_id": None, "account_deleted": True}},
            ),
            self.database.payment_orders.update_many(
                {"created_by_user_id": user_id},
                {
                    "$set": {
                        "created_by_user_id": None,
                        "account_deleted": True,
                    }
                },
            ),
            self.database.planner_usage.delete_many(
                {"_id": {"$regex": f"^planner-user:{re.escape(user_id)}:"}}
            ),
            self.database.partner_memberships.delete_many({"user_id": user_id}),
            self.database.in_app_notifications.delete_many({"user_id": user_id}),
            self.database.content_reports.update_many(
                {"reporter_user_id": user_id},
                {
                    "$set": {
                        "reporter_user_id": None,
                        "account_deleted": True,
                    }
                },
            ),
            self.database.partners.update_many(
                {"owner_user_id": user_id},
                {
                    "$set": {
                        "owner_user_id": "",
                        "ownership_status": "unclaimed",
                        "is_active": False,
                        "status": "pending",
                        "account_deleted_at": deleted_at,
                    }
                },
            ),
        )
        object_id = _object_id(user_id)
        if object_id is not None:
            await self.database.users.delete_one({"_id": object_id})


class MongoRateLimitRepository:
    def __init__(self, database: Any):
        self.collection = database.auth_rate_limits

    async def increment(
        self,
        *,
        action: str,
        identifier: str,
        bucket: int,
        now: datetime,
        window_seconds: int,
    ) -> int:
        digest = hashlib.sha256(
            f"{action}:{identifier.lower()}:{bucket}".encode()
        ).hexdigest()
        row = await self.collection.find_one_and_update(
            {"_id": digest},
            {
                "$inc": {"count": 1},
                "$setOnInsert": {
                    "action": action,
                    "created_at": now,
                    "expires_at": now + timedelta(seconds=window_seconds * 2),
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return int(row.get("count", 0)) if row else 0
