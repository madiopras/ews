"""Saved itinerary dependency composition."""

from fastapi import Depends

from app.api.dependencies import get_database
from app.modules.itineraries.repository import MongoItineraryRepository
from app.modules.itineraries.service import ItineraryService


def get_itinerary_repository(
    database=Depends(get_database),
) -> MongoItineraryRepository:
    return MongoItineraryRepository(database)


def get_itinerary_service(
    repository: MongoItineraryRepository = Depends(get_itinerary_repository),
) -> ItineraryService:
    return ItineraryService(repository)
