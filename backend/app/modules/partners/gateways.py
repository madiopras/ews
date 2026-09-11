"""Partner-owned adapters for storage and lifecycle notifications."""

from typing import Any

from app.core.config import Settings
from app.modules.auth.gateways import MongoAuthEmailGateway
from app.modules.media.domain import safe_object_key
from app.modules.media.exceptions import MediaError
from app.modules.media.gateways import ObjectStorageGateway


class PartnerStorageGateway:
    """Partner-specific facade over the shared asynchronous object store."""

    def __init__(self, settings: Settings):
        self.app_name = settings.storage_app_name
        self.storage = ObjectStorageGateway(settings)

    @staticmethod
    def _validated_path(path: str) -> str:
        try:
            return safe_object_key(path)
        except MediaError as error:
            raise ValueError("Invalid storage path") from error

    async def put(self, path: str, data: bytes, content_type: str) -> None:
        await self.storage.put(self._validated_path(path), data, content_type)

    async def get(self, path: str) -> tuple[bytes, str]:
        try:
            return await self.storage.get(self._validated_path(path))
        except MediaError as error:
            if error.status_code == 404:
                raise FileNotFoundError(path) from error
            raise

    async def delete(self, path: str) -> None:
        if path:
            await self.storage.delete(self._validated_path(path))


class PartnerNotificationGateway:
    def __init__(self, database: Any, settings: Settings):
        self.database = database
        self.email = MongoAuthEmailGateway(database, settings)
        self.frontend_url = (settings.public_app_url or "http://localhost:3000").rstrip(
            "/"
        )

    async def status_changed(
        self, partner: dict, owner: dict | None, status: str, note: str
    ) -> None:
        recipient = (owner or {}).get("email") or partner.get("email")
        if not recipient:
            return
        subjects = {
            "approved": "Pendaftaran Mitra disetujui",
            "needs_revision": "Perbaikan diperlukan untuk pendaftaran Mitra",
            "rejected": "Pembaruan pendaftaran Mitra",
            "pending": "Pendaftaran Mitra kembali ditinjau",
        }
        lines = [
            f"Halo {partner.get('business_name') or (owner or {}).get('name', '')},",
            "",
            f"Status pendaftaran Mitra Anda: {status}.",
        ]
        if note:
            lines.extend(["", f"Catatan tim: {note}"])
        target = f"/mitra/onboarding/{partner['_id']}"
        lines.extend(["", f"Buka workspace Mitra: {self.frontend_url}{target}"])
        body = "\n".join(lines)
        await self.email.deliver(recipient, f"partner_{status}", subjects[status], body)
        owner_id = partner.get("owner_user_id")
        if owner_id:
            from datetime import datetime, timezone

            now = datetime.now(timezone.utc).isoformat()
            await self.database.in_app_notifications.insert_one(
                {
                    "user_id": owner_id,
                    "kind": f"partner_{status}",
                    "title": subjects[status],
                    "body": body,
                    "action_url": target,
                    "status": "sent",
                    "read_at": None,
                    "created_at": now,
                    "updated_at": now,
                }
            )
