"""MongoDB integration coverage for destination read queries and indexes."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.destinations.repository import MongoDestinationRepository
from app.modules.destinations.service import DestinationService


def test_destination_repository_queries_real_test_database_and_indexes():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase3_test_{uuid.uuid4().hex}"
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
            now = datetime.now(timezone.utc).isoformat()
            active = {
                "name": "Danau Toba",
                "location": "Samosir",
                "category": "lake",
                "description": "Danau vulkanik terbesar di Sumatera Utara.",
                "latitude": 2.6845,
                "longitude": 98.8756,
                "featured": True,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            inactive = {
                **active,
                "name": "Hidden Lake",
                "featured": False,
                "is_active": False,
            }
            inserted = await database.destinations.insert_many([active, inactive])
            await ensure_indexes(database)

            repository = MongoDestinationRepository(database)
            service = DestinationService(repository)

            listed = await service.list_destinations(
                category="lake", search=None, featured=None
            )
            assert [item.name for item in listed] == ["Danau Toba"]

            searched = await service.search_destinations(
                query="Toba",
                category="lake",
                location="samosir",
                sort="updated",
                page=1,
                page_size=12,
            )
            assert searched.total == 1
            assert searched.items[0].id == str(inserted.inserted_ids[0])

            index_information = await database.destinations.index_information()
            indexed_fields = {
                keys[0][0]
                for metadata in index_information.values()
                if (keys := metadata.get("key"))
            }
            assert {
                "name",
                "location",
                "category",
                "is_active",
                "featured",
                "created_at",
                "updated_at",
            } <= indexed_fields
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
