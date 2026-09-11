from typing import Any


class MediaRepository:
    def __init__(self, database: Any):
        self.files = database.files

    async def record(self, document: dict) -> None:
        await self.files.insert_one(document)
