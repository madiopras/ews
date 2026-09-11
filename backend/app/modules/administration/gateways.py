"""External delivery, encryption, and LLM connectivity adapters."""

import asyncio
import base64
import hashlib
import ipaddress
import json
import os
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import Settings, load_settings
from app.modules.administration.exceptions import AdministrationError
from app.modules.administration.repositories import NotificationRepository
from app.modules.auth.gateways import MongoAuthEmailGateway
from app.shared.urls import safe_public_http_url


class LocalLLMClient:
    """Small OpenAI-compatible client shared with the Phase 8 planner."""

    def __init__(
        self, base_url: str, api_key: str, model_name: str, enabled: bool = True
    ):
        self.url = f"{base_url}/chat/completions"
        self.api_key = api_key
        self.model_name = model_name
        self.enabled = enabled

    async def stream(self, messages: list[dict]):
        if not self.enabled:
            raise RuntimeError("LLM is disabled")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = {"model": self.model_name, "messages": messages, "stream": True}
        timeout = httpx.Timeout(120.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as http:
            async with http.stream(
                "POST", self.url, headers=headers, json=body
            ) as response:
                response.raise_for_status()
                async for raw_line in response.aiter_lines():
                    line = raw_line.strip()
                    if not line:
                        continue
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if line == "[DONE]":
                        break
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    choices = event.get("choices") or []
                    if not choices:
                        continue
                    choice = choices[0]
                    content = (choice.get("delta") or {}).get("content")
                    if content is None:
                        content = (choice.get("message") or {}).get("content")
                    if content:
                        yield content

    async def test_connection(self) -> None:
        if not self.enabled:
            raise RuntimeError("LLM is disabled")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": "Reply with OK."}],
            "stream": False,
            "max_tokens": 8,
        }
        timeout = httpx.Timeout(20.0, connect=8.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as http:
            response = await http.post(self.url, headers=headers, json=body)
            response.raise_for_status()


class LlmProfileGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _secret_key(self) -> bytes:
        configured = self.settings.llm_profile_encryption_key
        material = (
            configured.get_secret_value()
            if configured
            else self.settings.jwt_secret.get_secret_value()
        )
        return hashlib.sha256(material.encode()).digest()

    def encrypt(self, value: str) -> tuple[str, str]:
        nonce = os.urandom(12)
        ciphertext = AESGCM(self._secret_key()).encrypt(
            nonce, value.encode(), b"ews-llm-profile-v1"
        )
        return (
            base64.urlsafe_b64encode(ciphertext).decode("ascii"),
            base64.urlsafe_b64encode(nonce).decode("ascii"),
        )

    def decrypt(self, document: dict) -> str:
        ciphertext = document.get("api_key_ciphertext")
        nonce = document.get("api_key_nonce")
        if not ciphertext or not nonce:
            return ""
        return (
            AESGCM(self._secret_key())
            .decrypt(
                base64.urlsafe_b64decode(nonce),
                base64.urlsafe_b64decode(ciphertext),
                b"ews-llm-profile-v1",
            )
            .decode()
        )

    async def validate_base_url(self, value: str) -> str:
        normalized = value.strip().rstrip("/")
        parsed = urlparse(normalized)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise AdministrationError(
                400,
                "Base URL must be a plain HTTP(S) origin/path without credentials, "
                "query, or fragment",
            )
        runtime = load_settings()
        if (
            not runtime.allow_private_llm_urls
            and parsed.hostname.lower() not in runtime.llm_allowed_host_set
        ):
            try:
                addresses = await asyncio.to_thread(
                    socket.getaddrinfo,
                    parsed.hostname,
                    parsed.port or (443 if parsed.scheme == "https" else 80),
                )
            except socket.gaierror as error:
                raise AdministrationError(
                    400, "Base URL hostname cannot be resolved"
                ) from error
            for address in {entry[4][0] for entry in addresses}:
                if not ipaddress.ip_address(address).is_global:
                    raise AdministrationError(
                        400,
                        "Private or local LLM URLs are not allowed in production",
                    )
        return normalized

    def client(self, document: dict) -> LocalLLMClient:
        return LocalLLMClient(
            document["base_url"],
            self.decrypt(document),
            document["model_name"],
            enabled=True,
        )

    async def probe(self, document: dict) -> tuple[bool, str]:
        try:
            await self.client(document).test_connection()
            return True, ""
        except httpx.HTTPStatusError as error:
            return False, f"Provider returned HTTP {error.response.status_code}"
        except httpx.TimeoutException:
            return False, "Connection timed out"
        except Exception as error:
            return False, f"Connection failed ({type(error).__name__})"

    def environment_client(self) -> LocalLLMClient:
        return LocalLLMClient(
            self.settings.llm_base_url.rstrip("/"),
            self.settings.llm_api_key.get_secret_value(),
            self.settings.llm_model_name,
            self.settings.use_llm,
        )

    def environment_metadata(self) -> dict:
        return {
            "source": "environment",
            "profile_id": None,
            "profile_name": "Environment fallback",
            "base_url": self.settings.llm_base_url.rstrip("/"),
            "model_name": self.settings.llm_model_name,
            "enabled": self.settings.use_llm,
            "configured": bool(
                self.settings.llm_base_url and self.settings.llm_model_name
            ),
            "health_status": "unknown",
            "latency_ms": None,
        }


class NotificationGateway:
    def __init__(
        self,
        repository: NotificationRepository,
        email: MongoAuthEmailGateway,
        settings: Settings,
    ):
        self.repository = repository
        self.email = email
        self.settings = settings

    async def in_app(
        self, user_id: str, kind: str, title: str, body: str, action_url: str = ""
    ) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        identifier = await self.repository.insert_in_app(
            {
                "user_id": user_id,
                "kind": kind,
                "title": title,
                "body": body,
                "action_url": action_url,
                "status": "sent",
                "read_at": None,
                "created_at": now,
                "updated_at": now,
            }
        )
        return {"id": identifier, "channel": "in_app", "status": "sent"}

    async def sms(self, recipient: str, kind: str, body: str) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        identifier = await self.repository.insert_sms(
            {
                "recipient": recipient,
                "kind": kind,
                "body": body,
                "status": "pending",
                "created_at": now,
                "updated_at": now,
            }
        )
        webhook = self.settings.sms_webhook_url.strip()
        if not webhook:
            await self.repository.update_sms(
                identifier, {"status": "configuration_required"}
            )
            return {
                "id": identifier,
                "channel": "sms",
                "status": "configuration_required",
            }
        if not safe_public_http_url(webhook):
            await self.repository.update_sms(
                identifier, {"status": "failed", "error": "invalid_webhook"}
            )
            return {"id": identifier, "channel": "sms", "status": "failed"}
        headers = {"Content-Type": "application/json"}
        token = self.settings.sms_webhook_token.get_secret_value()
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=False) as http:
                response = await http.post(
                    webhook,
                    headers=headers,
                    json={"to": recipient, "message": body, "kind": kind},
                )
                response.raise_for_status()
            status, error = "sent", ""
        except Exception as exc:
            status, error = "failed", type(exc).__name__
        await self.repository.update_sms(
            identifier,
            {
                "status": status,
                "error": error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return {"id": identifier, "channel": "sms", "status": status}

    async def partner_attention(
        self, partner: dict, owner: dict, partner_id: str
    ) -> list[dict]:
        kind = (
            "partner_revision_reminder"
            if partner.get("status") == "needs_revision"
            else "partner_sla_update"
        )
        title = "Pembaruan profil Mitra Explore Sumut"
        body = partner.get("revision_note") or (
            "Pendaftaran usaha Anda membutuhkan perhatian. "
            "Buka workspace Mitra untuk melihat status terbaru."
        )
        return [
            await self.email.deliver(owner["email"], kind, title, body),
            await self.in_app(
                str(owner["_id"]),
                kind,
                title,
                body,
                f"/mitra/onboarding/{partner_id}",
            ),
            await self.sms(partner.get("whatsapp", ""), kind, body),
        ]
