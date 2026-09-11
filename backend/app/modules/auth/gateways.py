"""Google identity and authentication email gateway implementations."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from google.auth.transport import requests as google_auth_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import Settings
from app.modules.auth.exceptions import GoogleCredentialInvalid

logger = logging.getLogger(__name__)


def verify_google_credential(credential: str, client_id: str) -> dict[str, str]:
    """Verify and normalize one Google Identity Services ID token."""

    claims = google_id_token.verify_oauth2_token(
        credential,
        google_auth_requests.Request(),
        client_id,
    )
    google_id = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    email_verified = (
        claims.get("email_verified") is True
        or str(claims.get("email_verified", "")).lower() == "true"
    )
    if not google_id or not email or not email_verified:
        raise GoogleCredentialInvalid(
            "Google account identity is incomplete or unverified"
        )
    return {
        "id": google_id[:255],
        "email": email[:320],
        "name": str(claims.get("name") or "").strip()[:120],
        "picture": str(claims.get("picture") or "").strip()[:2000],
    }


class GoogleTokenGateway:
    def __init__(self, client_id: str):
        self.client_id = client_id

    async def verify(self, credential: str) -> dict[str, str]:
        try:
            return await asyncio.to_thread(
                verify_google_credential, credential, self.client_id
            )
        except GoogleCredentialInvalid:
            raise
        except ValueError as error:
            raise GoogleCredentialInvalid(str(error)) from error


class MongoAuthEmailGateway:
    """Persist delivery status and optionally deliver through SMTP."""

    def __init__(self, database: Any, settings: Settings):
        self.outbox = database.email_outbox
        self.settings = settings

    def _frontend_url(self, path: str) -> str:
        base = (self.settings.public_app_url or "http://localhost:3000").rstrip("/")
        return f"{base}{path}"

    def _smtp_send(self, recipient: str, subject: str, body: str) -> None:
        if not self.settings.smtp_host:
            raise RuntimeError("SMTP is not configured")
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = self.settings.smtp_from
        message["To"] = recipient
        message.set_content(body)
        with smtplib.SMTP(
            self.settings.smtp_host, self.settings.smtp_port, timeout=20
        ) as smtp:
            if self.settings.smtp_starttls:
                smtp.starttls()
            if self.settings.smtp_username:
                smtp.login(
                    self.settings.smtp_username,
                    self.settings.smtp_password.get_secret_value(),
                )
            smtp.send_message(message)

    async def deliver(
        self, recipient: str, kind: str, subject: str, body: str
    ) -> dict[str, str]:
        now = datetime.now(timezone.utc)
        row = {
            "recipient": recipient,
            "kind": kind,
            "subject": subject,
            "body": body,
            "status": "pending",
            "created_at": now,
            "expires_at": now + timedelta(days=7),
        }
        inserted = await self.outbox.insert_one(row)
        if not self.settings.smtp_host:
            await self.outbox.update_one(
                {"_id": inserted.inserted_id},
                {
                    "$set": {
                        "status": "configuration_required",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            return {
                "id": str(inserted.inserted_id),
                "channel": "email",
                "status": "configuration_required",
            }
        try:
            await asyncio.to_thread(self._smtp_send, recipient, subject, body)
            status, error = "sent", ""
        except Exception as exception:
            logger.error(
                "Authentication email delivery failed: %s",
                type(exception).__name__,
            )
            status, error = "failed", type(exception).__name__
        await self.outbox.update_one(
            {"_id": inserted.inserted_id},
            {
                "$set": {
                    "status": status,
                    "error": error,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return {
            "id": str(inserted.inserted_id),
            "channel": "email",
            "status": status,
        }

    async def send_verification(self, user: Mapping[str, Any], token: str) -> None:
        link = self._frontend_url(f"/verify-email?token={token}")
        await self.deliver(
            user["email"],
            "email_verification",
            "Verifikasi email Explore Wisata Sumut",
            (
                f"Halo {user.get('name', '')},\n\n"
                "Verifikasi email Anda melalui tautan berikut "
                f"(berlaku 24 jam):\n{link}"
            ),
        )

    async def send_password_reset(self, user: Mapping[str, Any], token: str) -> None:
        link = self._frontend_url(f"/reset-password?token={token}")
        await self.deliver(
            user["email"],
            "password_reset",
            "Reset kata sandi Explore Wisata Sumut",
            (
                f"Halo {user.get('name', '')},\n\n"
                "Atur ulang kata sandi melalui tautan berikut "
                f"(berlaku 30 menit):\n{link}"
            ),
        )
