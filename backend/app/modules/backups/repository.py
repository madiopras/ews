import re
from typing import Any

from bson import ObjectId

from app.modules.backups.exceptions import BackupError


class BackupRepository:
    def __init__(self, database: Any):
        self.jobs, self.settings = database.backup_jobs, database.system_settings

    @staticmethod
    def object_id(value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception as error:
            raise BackupError(400, "Invalid backup id") from error

    async def latest(self) -> dict | None:
        return await self.jobs.find_one({}, sort=[("created_at", -1)])

    async def page(
        self, q: str, status: str | None, page: int, page_size: int, sort: str
    ):
        query: dict[str, Any] = {}
        if q.strip():
            pattern = re.escape(q.strip())
            query["$or"] = [
                {"filename": {"$regex": pattern, "$options": "i"}},
                {"created_by_email": {"$regex": pattern, "$options": "i"}},
            ]
        if status:
            query["status"] = status
        allowed = {"created_at", "filename", "size_bytes", "status"}
        descending, field = sort.startswith("-"), sort.lstrip("-")
        if field not in allowed:
            field, descending = "created_at", True
        total = await self.jobs.count_documents(query)
        rows = (
            await self.jobs.find(query)
            .sort(field, -1 if descending else 1)
            .skip((page - 1) * page_size)
            .limit(page_size)
            .to_list(page_size)
        )
        return rows, total

    async def insert(self, document: dict) -> dict:
        result = await self.jobs.insert_one(document)
        return {**document, "_id": result.inserted_id}

    async def get(self, backup_id: str, completed: bool = False) -> dict | None:
        query: dict[str, Any] = {"_id": self.object_id(backup_id)}
        if completed:
            query["status"] = "completed"
        return await self.jobs.find_one(query)

    async def get_by_oid(self, job_id: ObjectId) -> dict | None:
        return await self.jobs.find_one({"_id": job_id})

    async def set(self, job_id: ObjectId, changes: dict) -> None:
        await self.jobs.update_one({"_id": job_id}, {"$set": changes})

    async def delete(self, backup_id: str) -> None:
        await self.jobs.delete_one({"_id": self.object_id(backup_id)})

    async def expired(self, cutoff: str) -> list[dict]:
        return await self.jobs.find(
            {"status": "completed", "created_at": {"$lt": cutoff}}
        ).to_list(1000)

    async def delete_oid(self, oid: ObjectId) -> None:
        await self.jobs.delete_one({"_id": oid})

    async def retention_days(self) -> int:
        row = await self.settings.find_one({"_id": "general"}) or {}
        return int(row.get("backup_retention_days", 30))
