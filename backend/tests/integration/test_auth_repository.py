"""MongoDB integration coverage for user, session, profile, and rate-limit data."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.auth.repository import MongoRateLimitRepository, MongoUserRepository


def test_auth_repositories_use_isolated_database_and_atomic_versions():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase4_test_{uuid.uuid4().hex}"
        client = AsyncIOMotorClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=1000,
        )
        try:
            try:
                await client.admin.command("ping")
            except Exception as error:
                pytest.skip(f"MongoDB test service unavailable: {error}")

            database = client[database_name]
            await ensure_indexes(database)
            users = MongoUserRepository(database)
            user = await users.insert(
                {
                    "email": "phase4@example.com",
                    "name": "Phase Four",
                    "role": "user",
                    "password_hash": "old-hash",
                    "account_active": True,
                    "auth_session_version": 2,
                    "password_reset_version": 0,
                    "email_verification_version": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            user_id = str(user["_id"])

            assert (await users.find_by_email("phase4@example.com"))["_id"] == user[
                "_id"
            ]
            assert (await users.find_by_id(user_id, active_only=True))["email"] == (
                "phase4@example.com"
            )

            changed = await users.update_password_if_version(
                user_id,
                0,
                "new-hash",
                3,
                datetime.now(timezone.utc).isoformat(),
            )
            stale_change = await users.update_password_if_version(
                user_id,
                0,
                "stale-hash",
                4,
                datetime.now(timezone.utc).isoformat(),
            )
            assert changed is True
            assert stale_change is False

            await database.reviews.insert_one(
                {"user_id": user_id, "user_name": "Phase Four"}
            )
            await database.itineraries.insert_one(
                {"user_id": user_id, "author_name": "Phase Four"}
            )
            updated = await users.update_profile(
                user_id,
                name="Updated User",
                preferred_language="en",
                interests=["lake"],
                home_city="Medan",
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            assert updated["name"] == "Updated User"
            assert (await database.reviews.find_one({"user_id": user_id}))[
                "user_name"
            ] == "Updated User"

            limits = MongoRateLimitRepository(database)
            now = datetime.now(timezone.utc)
            first = await limits.increment(
                action="login_failure",
                identifier="USER@example.com",
                bucket=123,
                now=now,
                window_seconds=900,
            )
            second = await limits.increment(
                action="login_failure",
                identifier="user@example.com",
                bucket=123,
                now=now,
                window_seconds=900,
            )
            assert (first, second) == (1, 2)

            user_indexes = await database.users.index_information()
            assert any(
                metadata.get("unique") and metadata.get("key") == [("email", 1)]
                for metadata in user_indexes.values()
            )
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
