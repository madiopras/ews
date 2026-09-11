"""Real MongoDB integration coverage for Phase 5 persistence adapters."""

import asyncio
import uuid

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.infrastructure.database.indexes import ensure_indexes
from app.modules.destinations.repository import MongoDestinationRepository
from app.modules.destinations.schemas import DestinationIn
from app.modules.destinations.service import DestinationAdminService
from app.modules.itineraries.repository import MongoItineraryRepository
from app.modules.itineraries.schemas import ItineraryIn
from app.modules.itineraries.service import ItineraryService
from app.modules.reviews.repository import MongoReviewRepository
from app.modules.reviews.schemas import ReviewIn
from app.modules.reviews.service import ReviewService
from app.modules.wishlist.repository import MongoWishlistRepository
from app.modules.wishlist.service import WishlistService


def test_phase5_repositories_execute_atomic_and_owned_operations():
    async def scenario():
        settings = get_settings()
        database_name = f"ews_phase5_test_{uuid.uuid4().hex}"
        client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1000)
        try:
            try:
                await client.admin.command("ping")
            except Exception as error:
                pytest.skip(f"MongoDB test service unavailable: {error}")

            database = client[database_name]
            await ensure_indexes(database)
            user_result = await database.users.insert_one(
                {
                    "email": "owner@example.com",
                    "name": "Owner",
                    "role": "user",
                    "wishlist": [],
                }
            )
            user = {
                "id": str(user_result.inserted_id),
                "name": "Owner",
                "role": "user",
                "wishlist": [],
            }
            admin = {"id": user["id"], "email": "owner@example.com"}

            destinations = DestinationAdminService(MongoDestinationRepository(database))
            created = await destinations.create(
                DestinationIn(
                    name="Danau Toba",
                    location="Samosir",
                    category="lake",
                    description="Danau vulkanik terbesar di Sumatera Utara.",
                    latitude=2.68,
                    longitude=98.87,
                ),
                admin,
            )
            toggled = await destinations.toggle(created.id, admin)
            assert toggled.is_active is False
            restored = await destinations.toggle(created.id, admin)
            assert restored.is_active is True

            wishlist = WishlistService(MongoWishlistRepository(database))
            assert await wishlist.add(created.id, user) == {"ok": True}
            assert await wishlist.add(created.id, user) == {"ok": True}
            stored_user = await database.users.find_one(
                {"_id": user_result.inserted_id}
            )
            assert stored_user["wishlist"] == [created.id]
            await wishlist.remove(created.id, user)
            stored_user = await database.users.find_one(
                {"_id": user_result.inserted_id}
            )
            assert stored_user["wishlist"] == []

            reviews = ReviewService(MongoReviewRepository(database))
            review = await reviews.create(
                created.id, ReviewIn(rating=4, comment="Bagus"), user
            )
            updated_review = await reviews.update(
                review.id, ReviewIn(rating=5, comment="Sangat bagus"), user
            )
            assert updated_review.rating == 5

            itineraries = ItineraryService(MongoItineraryRepository(database))
            trip = await itineraries.create(
                ItineraryIn(
                    title="Trip",
                    days=2,
                    budget=500000,
                    content="## Hari 1",
                    destination_ids=[created.id],
                ),
                user,
            )
            shared = await itineraries.share(trip.id, True, user)
            public = await itineraries.public(shared.share_slug)
            assert public.destination_ids == [created.id]
            assert "user_id" not in public.model_dump()
            assert await itineraries.delete(trip.id, user) == {"ok": True}
            assert await reviews.delete(review.id, user) == {"ok": True}
        finally:
            await client.drop_database(database_name)
            client.close()

    asyncio.run(scenario())
