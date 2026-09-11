"""Wishlist dependency composition."""

from fastapi import Depends

from app.api.dependencies import get_database
from app.modules.wishlist.repository import MongoWishlistRepository
from app.modules.wishlist.service import WishlistService


def get_wishlist_repository(database=Depends(get_database)) -> MongoWishlistRepository:
    return MongoWishlistRepository(database)


def get_wishlist_service(
    repository: MongoWishlistRepository = Depends(get_wishlist_repository),
) -> WishlistService:
    return WishlistService(repository)
