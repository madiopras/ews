import uuid
from datetime import datetime, timezone
from typing import Any

from app.modules.media.domain import image_type, safe_object_key
from app.modules.media.exceptions import MediaError


class MediaService:
    MAX_SIZE = 8 * 1024 * 1024

    def __init__(self, repository: Any, storage: Any, audit: Any, app_name: str):
        self.repository, self.storage, self.audit, self.app_name = (
            repository,
            storage,
            audit,
            app_name,
        )

    async def upload(self, filename: str | None, data: bytes, admin: dict) -> dict:
        if len(data) > self.MAX_SIZE:
            raise MediaError(400, "Max file size 8MB")
        ext, content_type = image_type(filename, data)
        key = safe_object_key(
            f"{self.app_name}/uploads/{admin['id']}/{uuid.uuid4()}.{ext}"
        )
        result = await self.storage.put(key, data, content_type)
        stored_path = safe_object_key(result["path"])
        await self.repository.record(
            {
                "storage_path": stored_path,
                "original_filename": filename,
                "content_type": content_type,
                "size": result.get("size", len(data)),
                "uploaded_by": admin["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        await self.audit.audit(
            admin,
            "upload",
            "file",
            stored_path,
            {"filename": filename, "size": len(data)},
        )
        return {"path": stored_path, "url": f"/api/files/{stored_path}"}

    async def read_public(self, key: str) -> tuple[bytes, str]:
        key = safe_object_key(key)
        if key.startswith(f"{self.app_name}/verification/"):
            raise MediaError(404, "File not found")
        return await self.storage.get(key)
