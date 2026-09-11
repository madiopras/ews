"""MongoDB lifecycle and index management."""

from app.infrastructure.database.mongo import create_mongo_lifespan

__all__ = ["create_mongo_lifespan"]
