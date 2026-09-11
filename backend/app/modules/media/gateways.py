"""Non-blocking object-storage gateway."""

import asyncio
from pathlib import Path
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.modules.media.domain import MIME_MAP, safe_object_key
from app.modules.media.exceptions import MediaError

DOCUMENT_MIME_MAP = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
_KEY_LOCK = asyncio.Lock()


class ObjectStorageGateway:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        base = (
            settings.integration_proxy_url.strip()
            or "https://integrations.emergentagent.com"
        )
        self.url = base.rstrip("/") + "/objstore/api/v1/storage"
        self.secret = settings.emergent_llm_key.get_secret_value()
        self.local_dir = settings.storage_dir.resolve()
        self.client, self._key = client, None

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            if self.client is not None:
                return await self.client.request(method, url, **kwargs)
            timeout = httpx.Timeout(120.0, connect=5.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                return await client.request(method, url, **kwargs)
        except httpx.HTTPError as error:
            raise MediaError(502, "File error") from error

    async def initialize(self, force: bool = False) -> str:
        if not self.secret:
            await asyncio.to_thread(self.local_dir.mkdir, parents=True, exist_ok=True)
            self._key = "local"
            return self._key
        async with _KEY_LOCK:
            if self._key and not force:
                return self._key
            response = await self._request(
                "POST", f"{self.url}/init", json={"emergent_key": self.secret}
            )
            if response.status_code >= 400:
                raise MediaError(502, "File error")
            try:
                self._key = str(response.json()["storage_key"])
            except (KeyError, ValueError, TypeError) as error:
                raise MediaError(502, "File error") from error
            return self._key

    def _local_path(self, key: str) -> Path:
        target = (self.local_dir / safe_object_key(key)).resolve()
        try:
            target.relative_to(self.local_dir)
        except ValueError as error:
            raise MediaError(404, "File not found") from error
        return target

    @staticmethod
    def _write(target: Path, data: bytes) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    async def put(self, key: str, data: bytes, content_type: str) -> dict:
        key = safe_object_key(key)
        storage_key = await self.initialize()
        if storage_key == "local":
            await asyncio.to_thread(self._write, self._local_path(key), data)
            return {"path": key, "size": len(data)}
        endpoint = f"{self.url}/objects/{quote(key, safe='/')}"
        response = await self._request(
            "PUT",
            endpoint,
            headers={"X-Storage-Key": storage_key, "Content-Type": content_type},
            content=data,
        )
        if response.status_code == 404:
            storage_key = await self.initialize(force=True)
            response = await self._request(
                "PUT",
                endpoint,
                headers={"X-Storage-Key": storage_key, "Content-Type": content_type},
                content=data,
            )
        if response.status_code >= 400:
            raise MediaError(502, "File error")
        try:
            return response.json()
        except ValueError as error:
            raise MediaError(502, "File error") from error

    async def get(self, key: str) -> tuple[bytes, str]:
        key = safe_object_key(key)
        storage_key = await self.initialize()
        if storage_key == "local":
            target = self._local_path(key)
            if not await asyncio.to_thread(target.is_file):
                raise MediaError(404, "File not found")
            data = await asyncio.to_thread(target.read_bytes)
            mime = {**MIME_MAP, **DOCUMENT_MIME_MAP}.get(
                target.suffix.lower().lstrip("."), "application/octet-stream"
            )
            return data, mime
        endpoint = f"{self.url}/objects/{quote(key, safe='/')}"
        response = await self._request(
            "GET", endpoint, headers={"X-Storage-Key": storage_key}
        )
        if response.status_code == 404:
            storage_key = await self.initialize(force=True)
            response = await self._request(
                "GET", endpoint, headers={"X-Storage-Key": storage_key}
            )
        if response.status_code == 404:
            raise MediaError(404, "File not found")
        if response.status_code >= 400:
            raise MediaError(502, "File error")
        return response.content, response.headers.get(
            "Content-Type", "application/octet-stream"
        )

    async def delete(self, key: str) -> None:
        if not key:
            return
        key = safe_object_key(key)
        storage_key = await self.initialize()
        if storage_key == "local":
            target = self._local_path(key)
            if await asyncio.to_thread(target.is_file):
                await asyncio.to_thread(target.unlink)
            return
        endpoint = f"{self.url}/objects/{quote(key, safe='/')}"
        response = await self._request(
            "DELETE", endpoint, headers={"X-Storage-Key": storage_key}
        )
        if response.status_code not in (200, 204, 404):
            raise MediaError(502, "File error")
