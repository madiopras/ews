import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.modules.backups.exceptions import BackupError
from app.modules.backups.mapper import backup_to_out


class BackupService:
    def __init__(self, repository: Any, files: Any, audit: Any):
        self.repository, self.files, self.audit = repository, files, audit

    async def status(self) -> dict:
        ready, latest = await asyncio.gather(
            asyncio.to_thread(self.files.ready), self.repository.latest()
        )
        return {
            "directory_ready": ready,
            "format": "mongodb-extended-json-lines-v1",
            "latest": backup_to_out(latest) if latest else None,
        }

    async def page(
        self, page: int, page_size: int, q: str, status: str | None, sort: str
    ) -> dict:
        page, page_size = max(1, page), max(1, min(page_size, 100))
        rows, total = await self.repository.page(q, status, page, page_size, sort)
        return {
            "items": [backup_to_out(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size,
        }

    async def create(self, admin: dict) -> tuple[dict, Any]:
        now = datetime.now(timezone.utc)
        filename = f"ews-backup-{now.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}.jsonl.gz"
        row = await self.repository.insert(
            {
                "status": "pending",
                "filename": filename,
                "created_at": now.isoformat(),
                "created_by": admin["id"],
                "created_by_email": admin.get("email", ""),
            }
        )
        await self.audit.audit(admin, "create", "backup", str(row["_id"]), {})
        return backup_to_out(row), row["_id"]

    async def run(self, job_id: Any) -> None:
        row = await self.repository.get_by_oid(job_id)
        if not row:
            return
        filename = row["filename"]
        await self.repository.set(job_id, {"status": "processing"})
        await self.audit.system(
            "info", "backup", "Database backup started", {"job_id": str(job_id)}
        )
        try:
            result = await asyncio.to_thread(self.files.write, filename)
            completed = datetime.now(timezone.utc).isoformat()
            await self.repository.set(
                job_id, {"status": "completed", "completed_at": completed, **result}
            )
            await self.purge(await self.repository.retention_days())
            await self.audit.system(
                "info",
                "backup",
                "Database backup completed",
                {
                    "job_id": str(job_id),
                    "size_bytes": result["size_bytes"],
                    "document_count": result["document_count"],
                },
            )
        except Exception as error:
            await asyncio.to_thread(self.files.delete, filename)
            message = str(error)[:500]
            await self.repository.set(
                job_id,
                {
                    "status": "error",
                    "error": message,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            await self.audit.system(
                "error",
                "backup",
                "Database backup failed",
                {"job_id": str(job_id), "error": message},
            )

    async def purge(self, retention_days: int) -> None:
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=retention_days)
        ).isoformat()
        for row in await self.repository.expired(cutoff):
            await asyncio.to_thread(self.files.delete, row.get("filename", ""))
            await self.repository.delete_oid(row["_id"])

    async def download(self, backup_id: str):
        row = await self.repository.get(backup_id, completed=True)
        if not row:
            raise BackupError(404, "Completed backup not found")
        if not await asyncio.to_thread(self.files.exists, row.get("filename", "")):
            raise BackupError(404, "Backup file not found")
        return self.files.path(row["filename"]), row["filename"]

    async def delete(self, backup_id: str, admin: dict) -> dict:
        row = await self.repository.get(backup_id)
        if not row:
            raise BackupError(404, "Backup not found")
        if row.get("status") in {"pending", "processing"}:
            raise BackupError(409, "Backup is still processing")
        await asyncio.to_thread(self.files.delete, row.get("filename", ""))
        await self.repository.delete(backup_id)
        await self.audit.audit(
            admin, "delete", "backup", backup_id, {"filename": row.get("filename", "")}
        )
        return {"ok": True}
