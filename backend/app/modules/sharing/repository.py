from typing import Any


class SharingRepository:
    def __init__(self, database: Any):
        self.itineraries = database.itineraries

    async def public_itinerary(self, slug: str) -> dict | None:
        return await self.itineraries.find_one({"share_slug": slug, "is_public": True})
