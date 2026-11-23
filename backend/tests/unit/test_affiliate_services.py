"""Unit tests for affiliate domain policies, crypto, and orchestration service."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import load_settings
from app.modules.affiliates.domain import (
    build_miniapp_launch_url,
    build_sub_id,
    build_tiket_public_product_url,
    resolve_primary_zone,
    validate_redirect_url,
)
from app.modules.affiliates.exceptions import AffiliateError
from app.modules.affiliates.gateways import AffiliateCryptoGateway
from app.modules.affiliates.schemas import (
    MiniAppSessionIn,
    TiketAffiliateConfigIn,
    TiketAffiliatePreviewIn,
)
from app.modules.affiliates.service import AffiliateService


class FakeConfigRepo:
    def __init__(self, doc: dict[str, Any] | None = None):
        self.doc = doc

    async def get_tiket(self) -> dict[str, Any] | None:
        return dict(self.doc) if self.doc is not None else None

    async def upsert_tiket(self, document: dict[str, Any]) -> dict[str, Any]:
        self.doc = dict(document)
        return dict(self.doc)


class FakeAnalyticsRepo:
    def __init__(self):
        self.clicks: list[dict[str, Any]] = []

    async def record_click(self, document: dict[str, Any]) -> None:
        self.clicks.append(dict(document))

    async def summarize(self, days: int) -> dict[str, Any]:
        by_product: dict[str, int] = {}
        for item in self.clicks:
            key = item["product"]
            by_product[key] = by_product.get(key, 0) + 1
        return {
            "days": days,
            "total_clicks": len(self.clicks),
            "by_product": [{"key": k, "count": v} for k, v in by_product.items()],
            "by_zone": [],
            "by_source": [],
            "by_mode": [],
        }


class FakeDestinationRepo:
    def __init__(self, docs: list[dict[str, Any]] | None = None):
        self.docs = docs or []

    async def find_locations_by_ids(self, _ids: list[str]) -> list[dict[str, Any]]:
        return list(self.docs)


class FakeSettingsReader:
    def __init__(self, stored: dict[str, Any] | None = None):
        self.stored = stored or {}

    async def read_general_settings(self) -> dict[str, Any]:
        return dict(self.stored)


class FakeTiketGateway:
    def __init__(self, token: str = "jwt-sandbox-token-123"):
        self.token = token
        self.calls: list[dict[str, Any]] = []

    async def request_miniapp_token(self, **kwargs: Any) -> str:
        self.calls.append(kwargs)
        return self.token


class FakeAudit:
    def __init__(self):
        self.events: list[dict[str, Any]] = []

    async def audit(self, actor, action, entity_type, entity_id, details=None):
        self.events.append(
            {
                "actor": actor,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "details": details or {},
            }
        )


def _service(
    *,
    stored_settings: dict[str, Any] | None = None,
    config_doc: dict[str, Any] | None = None,
    destination_docs: list[dict[str, Any]] | None = None,
):
    settings = load_settings()
    crypto = AffiliateCryptoGateway(settings)
    config_repo = FakeConfigRepo(config_doc)
    analytics_repo = FakeAnalyticsRepo()
    destination_repo = FakeDestinationRepo(destination_docs)
    settings_reader = FakeSettingsReader(stored_settings)
    tiket_gateway = FakeTiketGateway()
    audit = FakeAudit()
    svc = AffiliateService(
        config_repo=config_repo,
        analytics_repo=analytics_repo,
        destination_repo=destination_repo,
        settings_reader=settings_reader,
        crypto_gateway=crypto,
        tiket_gateway=tiket_gateway,
        audit=audit,
    )
    return svc, config_repo, analytics_repo, tiket_gateway, audit


def test_sumut_zone_mapping_and_sub_id_are_deterministic_and_pii_free():
    assert (
        resolve_primary_zone(
            destination_docs=[{"location": "Pulau Samosir, Danau Toba"}]
        )
        == "toba_samosir"
    )
    assert (
        resolve_primary_zone(destination_docs=[{"location": "Gunungsitoli, Nias"}])
        == "nias"
    )
    assert resolve_primary_zone(starting_point="silangit") == "toba_samosir"
    assert build_sub_id("planner", "toba_samosir", "flight") == (
        "ews_planner_toba_samosir_flight"
    )


def test_redirect_url_validator_blocks_open_redirects():
    url = build_tiket_public_product_url(
        product="flight",
        zone="nias",
        sub_id="ews_planner_nias_flight",
    )
    assert "a=GNS" in url
    assert url.startswith("https://www.tiket.com/pesawat/cari")

    with pytest.raises(AffiliateError) as exc_info:
        validate_redirect_url("https://evil.example.com/phish", ["tiket.com"])
    assert exc_info.value.status_code == 400

    with pytest.raises(AffiliateError):
        validate_redirect_url("http://www.tiket.com/hotel", ["tiket.com"])


def test_miniapp_launch_url_builder_validates_slug_and_host():
    launch_url = build_miniapp_launch_url(
        base_url="https://aff.tiketsandbox.net",
        partner_slug="explore-sumut",
        product="hotel",
        token="abc.def.ghi",
        lang="id",
    )
    assert launch_url == (
        "https://aff.tiketsandbox.net/id-ID/miniapps/explore-sumut/hotel"
        "?token=abc.def.ghi"
    )
    with pytest.raises(AffiliateError):
        build_miniapp_launch_url(
            base_url="https://aff.tiketsandbox.net",
            partner_slug="../bad",
            product="hotel",
            token="abc",
        )


def test_crypto_gateway_roundtrip_aes_gcm_and_rsa():
    crypto = AffiliateCryptoGateway(load_settings())
    envelope = crypto.encrypt_secret("secret-aff-key-123")
    assert envelope["ciphertext"] != "secret-aff-key-123"
    assert crypto.decrypt_secret(envelope) == "secret-aff-key-123"

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    encrypted_phone = crypto.encrypt_rsa_field(pem.decode("utf-8"), "+628123456789")
    assert encrypted_phone
    assert "+628123456789" not in encrypted_phone


def test_recommendations_disabled_by_default_and_enabled_for_admin_qa():
    svc, _, _, _, _ = _service(
        stored_settings={
            "affiliate_tiket_enabled": False,
            "affiliate_tiket_rollout_percentage": 0,
        },
        config_doc={"enabled": True, "mode": "campaign_link"},
    )
    off_result = asyncio.run(
        svc.recommendations(user={"id": "u1", "role": "user"}, zones=["toba_samosir"])
    )
    assert off_result["enabled"] is False
    assert off_result["items"] == []

    svc_qa, _, _, _, _ = _service(
        stored_settings={
            "affiliate_tiket_enabled": True,
            "affiliate_tiket_rollout_percentage": 0,
        },
        config_doc={
            "enabled": True,
            "mode": "campaign_link",
            "products_enabled": {"hotel": True, "flight": True},
        },
    )
    # Regular user at 0% rollout sees nothing
    guest_res = asyncio.run(
        svc_qa.recommendations(user=None, zones=["toba_samosir"], lang="id")
    )
    assert guest_res["enabled"] is False
    # Admin override at 0% rollout sees contextual Silangit (DTB) + Danau Toba hotel cards
    admin_res = asyncio.run(
        svc_qa.recommendations(
            user={"id": "a1", "role": "admin"}, zones=["toba_samosir"], lang="id"
        )
    )
    assert admin_res["enabled"] is True
    assert len(admin_res["items"]) == 2
    products = {item["product"]: item for item in admin_res["items"]}
    assert products["flight"]["airport_code"] == "DTB"
    assert "Danau Toba" in (products["hotel"]["accommodation_area"] or "")


def test_admin_config_encrypts_secrets_never_leaks_and_creates_miniapp_session():
    svc, config_repo, analytics_repo, tiket_gateway, audit = _service(
        stored_settings={
            "affiliate_tiket_enabled": True,
            "affiliate_tiket_rollout_percentage": 100,
        }
    )
    actor = {"id": "admin-1", "email": "admin@example.com", "role": "admin"}
    saved = asyncio.run(
        svc.update_admin_config(
            TiketAffiliateConfigIn(
                enabled=True,
                environment="sandbox",
                mode="miniapp",
                partner_identifier="ews-partner-id",
                partner_slug="explore-sumut",
                miniapp_api_key_action="replace",
                miniapp_api_key="super-secret-b2b2c-key",
            ),
            actor,
        )
    )
    assert saved["has_miniapp_api_key"] is True
    assert saved["ready_for_launch"] is True
    assert "super-secret-b2b2c-key" not in str(saved)
    assert "super-secret-b2b2c-key" not in str(config_repo.doc)
    assert audit.events[0]["action"] == "update"

    session = asyncio.run(
        svc.create_miniapp_session(
            MiniAppSessionIn(product="flight", zone="nias", source="planner"),
            user={"id": "u1", "role": "user"},
            anonymous_id="anon-1",
            analytics_consent=True,
        )
    )
    assert session["launch_url"].startswith(
        "https://aff.tiketsandbox.net/id-ID/miniapps/explore-sumut/flight?token="
    )
    assert tiket_gateway.calls[0]["api_key"] == "super-secret-b2b2c-key"
    assert len(analytics_repo.clicks) == 1
    assert analytics_repo.clicks[0]["anonymous_id_hash"] != "anon-1"
    assert analytics_repo.clicks[0]["anonymous_id_hash"] != ""

    preview = asyncio.run(
        svc.preview_admin_config(
            TiketAffiliatePreviewIn(
                zone="toba_samosir", product="hotel", live_token_test=True
            )
        )
    )
    assert preview["live_test_status"] == "ok"
    assert "jwt-sandbox-token-123" in preview["preview_url"]
