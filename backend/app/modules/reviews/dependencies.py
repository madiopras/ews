"""Review dependency composition."""

from fastapi import Depends

from app.api.dependencies import get_database
from app.modules.reviews.repository import MongoReviewRepository
from app.modules.reviews.service import ReviewService


def get_review_repository(database=Depends(get_database)) -> MongoReviewRepository:
    return MongoReviewRepository(database)


def get_review_service(
    repository: MongoReviewRepository = Depends(get_review_repository),
) -> ReviewService:
    return ReviewService(repository)
