"""Encryption and Tiket.com Partner API V2 / MiniApp HTTP gateways."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
from typing import Any

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import Settings
from app.modules.affiliates.domain import api_base_url
from app.modules.affiliates.exceptions import AffiliateError

# Verified Tiket.com API V2 endpoints (https://affiliate.tiket.com/)
MINIAPP_TOKEN_PATH = "/affiliate-gateway/b2b2c/partner/token/{partner_identifier}"
HOTEL_V2_CONTENT_DELTA_PATH = (
    "/affiliate-gateway/accommodation/content/property/changes"
)
HOTEL_V2_CONTENT_PULL_PATH = "/affiliate-gateway/accommodation/content/property"
HOTEL_V2_AVAILABILITY_PATH = "/affiliate-gateway/accommodation/v2/availability"
HOTEL_V2_PREBOOK_PATH = "/affiliate-gateway/accommodation/check"
HOTEL_V2_BOOK_PATH = "/affiliate-gateway/accommodation/book"
FLIGHT_V2_BASE_PREFIX = "/affiliate-gateway/tix-affiliate-flight"


class AffiliateCryptoGateway:
    """AES-GCM storage encryption, RSA MiniApp autologin encryption, and HMAC hashing."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def _secret_key(self) -> bytes:
        configured = self.settings.llm_profile_encryption_key
        material = (
            configured.get_secret_value()
            if configured
            else self.settings.jwt_secret.get_secret_value()
        )
        return hashlib.sha256(material.encode("utf-8")).digest()

    def encrypt_secret(self, plaintext: str) -> dict[str, str]:
        nonce = os.urandom(12)
        ciphertext = AESGCM(self._secret_key()).encrypt(
            nonce, plaintext.encode("utf-8"), b"ews-affiliate-secret-v1"
        )
        return {
            "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("ascii"),
            "nonce": base64.urlsafe_b64encode(nonce).decode("ascii"),
        }

    def decrypt_secret(self, envelope: dict[str, Any] | None) -> str:
        if not envelope:
            return ""
        ciphertext = envelope.get("ciphertext")
        nonce = envelope.get("nonce")
        if not ciphertext or not nonce:
            return ""
        return (
            AESGCM(self._secret_key())
            .decrypt(
                base64.urlsafe_b64decode(nonce),
                base64.urlsafe_b64decode(ciphertext),
                b"ews-affiliate-secret-v1",
            )
            .decode("utf-8")
        )

    def hash_anonymous_id(self, anonymous_id: str) -> str:
        if not anonymous_id:
            return ""
        key = self.settings.jwt_secret.get_secret_value().encode("utf-8")
        return hmac.new(
            key,
            f"ews-affiliate-click-v1:{anonymous_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def encrypt_rsa_field(public_key_pem: str, plaintext: str) -> str:
        if not public_key_pem.strip() or not plaintext.strip():
            return ""
        try:
            loaded = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        except Exception as error:
            raise AffiliateError(
                400, "Invalid Tiket MiniApp RSA public key format"
            ) from error
        if not isinstance(loaded, rsa.RSAPublicKey):
            raise AffiliateError(400, "Tiket MiniApp public key must be an RSA key")
        encrypted = loaded.encrypt(plaintext.encode("utf-8"), padding.PKCS1v15())
        return base64.b64encode(encrypted).decode("ascii")


class TiketPartnerApiGateway:
    """Thin HTTP gateway for Tiket.com Partner API V2 & MiniApp Token API."""

    def __init__(self, crypto: AffiliateCryptoGateway):
        self.crypto = crypto

    async def request_miniapp_token(
        self,
        *,
        environment: str,
        partner_identifier: str,
        api_key: str,
        language: str = "id",
        phone_number: str | None = None,
        email: str | None = None,
        full_name: str | None = None,
        rsa_public_key_pem: str = "",
    ) -> str:
        identifier = partner_identifier.strip()
        if not identifier:
            raise AffiliateError(400, "Tiket partner identifier is not configured")
        if not api_key.strip():
            raise AffiliateError(400, "Tiket MiniApp API key is not configured")

        url = (
            f"{api_base_url(environment)}"
            f"{MINIAPP_TOKEN_PATH.format(partner_identifier=identifier)}"
        )
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "aff-b2b2c-key": api_key.strip(),
        }
        payload: dict[str, Any] = {
            "channelLanguage": "en" if language == "en" else "id"
        }
        if phone_number and rsa_public_key_pem.strip():
            payload["phoneNumber"] = self.crypto.encrypt_rsa_field(
                rsa_public_key_pem, phone_number.strip()
            )
            if email:
                payload["email"] = self.crypto.encrypt_rsa_field(
                    rsa_public_key_pem, email.strip()
                )
            if full_name:
                payload["fullName"] = self.crypto.encrypt_rsa_field(
                    rsa_public_key_pem, full_name.strip()
                )

        timeout = httpx.Timeout(15.0, connect=8.0)
        try:
            async with httpx.AsyncClient(
                timeout=timeout, follow_redirects=False
            ) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()
        except httpx.HTTPStatusError as error:
            raise AffiliateError(
                502,
                f"Tiket MiniApp token API returned HTTP {error.response.status_code}",
            ) from error
        except httpx.TimeoutException as error:
            raise AffiliateError(504, "Tiket MiniApp token API timed out") from error
        except AffiliateError:
            raise
        except Exception as error:
            raise AffiliateError(
                502, f"Tiket MiniApp token API failed ({type(error).__name__})"
            ) from error

        token = str(body.get("token") or (body.get("data") or {}).get("token") or "")
        if not token:
            raise AffiliateError(502, "Tiket MiniApp token API did not return a token")
        return token
