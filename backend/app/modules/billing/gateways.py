"""Async Midtrans adapter and public configuration."""

from dataclasses import dataclass

import httpx

from app.core.config import Settings
from app.modules.billing.exceptions import BillingError


@dataclass(frozen=True)
class MidtransConfig:
    client_key: str
    server_key: str
    snap_url: str
    snap_js: str
    api_host: str
    is_production: bool


class MidtransGateway:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        production = settings.midtrans_env == "production"
        _, client_key, server_key = settings.midtrans_credentials()
        self.config = MidtransConfig(
            client_key,
            server_key,
            (
                "https://app.midtrans.com/snap/v1/transactions"
                if production
                else "https://app.sandbox.midtrans.com/snap/v1/transactions"
            ),
            (
                "https://app.midtrans.com/snap/snap.js"
                if production
                else "https://app.sandbox.midtrans.com/snap/snap.js"
            ),
            (
                "https://api.midtrans.com"
                if production
                else "https://api.sandbox.midtrans.com"
            ),
            production,
        )
        self.client = client

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            if self.client is not None:
                return await self.client.request(method, url, **kwargs)
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(20.0, connect=5.0)
            ) as client:
                return await client.request(method, url, **kwargs)
        except httpx.HTTPError as error:
            raise BillingError(502, "Midtrans request failed") from error

    async def create_transaction(self, body: dict) -> str:
        response = await self._request(
            "POST", self.config.snap_url, auth=(self.config.server_key, ""), json=body
        )
        if response.status_code not in (200, 201):
            raise BillingError(502, "Midtrans token creation failed")
        try:
            return str(response.json()["token"])
        except (KeyError, ValueError, TypeError) as error:
            raise BillingError(502, "Invalid Midtrans response") from error

    async def transaction_status(self, order_id: str) -> dict | None:
        response = await self._request(
            "GET",
            f"{self.config.api_host}/v2/{order_id}/status",
            auth=(self.config.server_key, ""),
        )
        if response.status_code >= 400:
            return None
        try:
            return response.json()
        except ValueError as error:
            raise BillingError(502, "Invalid Midtrans response") from error
