"""Affiliate orchestration use cases (framework & persistence independent)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Sequence

from app.modules.administration.domain import feature_decision
from app.modules.affiliates.domain import (
    DEFAULT_ALLOWED_REDIRECT_HOSTS,
    SUPPORTED_PRODUCTS,
    api_base_url,
    assess_config_readiness,
    build_miniapp_launch_url,
    build_recommendation_cards,
    build_sub_id,
    build_tiket_public_product_url,
    disclosure_copy,
    miniapp_base_url,
    normalize_allowed_hosts,
    normalize_zone,
    resolve_primary_zone,
)
from app.modules.affiliates.exceptions import AffiliateError
from app.modules.affiliates.schemas import (
    MiniAppSessionIn,
    TiketAffiliateConfigIn,
    TiketAffiliatePreviewIn,
)

_SECRET_SLOTS = (
    ("miniapp_api_key", "miniapp_api_key_secret", "has_miniapp_api_key"),
    (
        "miniapp_rsa_public_key",
        "miniapp_rsa_public_key_secret",
        "has_miniapp_rsa_public_key",
    ),
    ("hotel_v2_auth", "hotel_v2_auth_secret", "has_hotel_v2_auth"),
    ("flight_v2_api_key", "flight_v2_api_key_secret", "has_flight_v2_api_key"),
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_config_document() -> dict[str, Any]:
    return {
        "provider": "tiket",
        "enabled": False,
        "environment": "sandbox",
        "mode": "miniapp",
        "partner_identifier": "",
        "partner_slug": "",
        "affiliate_id": "",
        "campaign_url_template": "",
        "miniapp_production_base_url": "",
        "products_enabled": {"hotel": True, "flight": True},
        "allowed_redirect_hosts": list(DEFAULT_ALLOWED_REDIRECT_HOSTS),
        "updated_at": "",
    }


def _present_admin_config(doc: dict[str, Any]) -> dict[str, Any]:
    merged = {**_default_config_document(), **(doc or {})}
    environment = merged.get("environment", "sandbox")
    products = merged.get("products_enabled") or {}
    payload: dict[str, Any] = {
        "provider": "tiket",
        "enabled": bool(merged.get("enabled", False)),
        "environment": environment,
        "mode": merged.get("mode", "miniapp"),
        "partner_identifier": str(merged.get("partner_identifier") or ""),
        "partner_slug": str(merged.get("partner_slug") or ""),
        "affiliate_id": str(merged.get("affiliate_id") or ""),
        "campaign_url_template": str(merged.get("campaign_url_template") or ""),
        "miniapp_production_base_url": str(
            merged.get("miniapp_production_base_url") or ""
        ),
        "products_enabled": {
            "hotel": bool(products.get("hotel", True)),
            "flight": bool(products.get("flight", True)),
        },
        "allowed_redirect_hosts": normalize_allowed_hosts(
            merged.get("allowed_redirect_hosts")
        ),
        "has_miniapp_api_key": bool(merged.get("miniapp_api_key_secret")),
        "has_miniapp_rsa_public_key": bool(merged.get("miniapp_rsa_public_key_secret")),
        "has_hotel_v2_auth": bool(merged.get("hotel_v2_auth_secret")),
        "has_flight_v2_api_key": bool(merged.get("flight_v2_api_key_secret")),
        "api_base_url": api_base_url(environment),
        "miniapp_base_url": miniapp_base_url(
            environment, str(merged.get("miniapp_production_base_url") or "")
        ),
        "updated_at": str(merged.get("updated_at") or ""),
    }
    ready, notes = assess_config_readiness(payload)
    payload["ready_for_launch"] = ready
    payload["readiness_notes"] = notes
    return payload


class AffiliateService:
    def __init__(
        self,
        config_repo: Any,
        analytics_repo: Any,
        destination_repo: Any,
        settings_reader: Any,
        crypto_gateway: Any,
        tiket_gateway: Any,
        audit: Any,
    ):
        self.config_repo = config_repo
        self.analytics_repo = analytics_repo
        self.destination_repo = destination_repo
        self.settings_reader = settings_reader
        self.crypto_gateway = crypto_gateway
        self.tiket_gateway = tiket_gateway
        self.audit = audit

    async def _raw_config(self) -> dict[str, Any]:
        stored = await self.config_repo.get_tiket()
        return {**_default_config_document(), **(stored or {})}

    async def is_feature_enabled(self, user: dict | None) -> bool:
        stored_settings = await self.settings_reader.read_general_settings()
        decision = feature_decision("affiliate_tiket", stored_settings, user)
        return bool(decision.get("enabled"))

    async def recommendations(
        self,
        *,
        user: dict | None,
        zones: Sequence[str] = (),
        destination_ids: Sequence[str] = (),
        starting_point: str | None = None,
        source: str = "planner",
        lang: Literal["id", "en"] = "id",
    ) -> dict[str, Any]:
        if not await self.is_feature_enabled(user):
            return {
                "enabled": False,
                "provider": "tiket",
                "environment": "sandbox",
                "mode": "miniapp",
                "disclosure": "",
                "items": [],
            }

        raw = await self._raw_config()
        presented = _present_admin_config(raw)
        if not presented["enabled"]:
            return {
                "enabled": False,
                "provider": "tiket",
                "environment": presented["environment"],
                "mode": presented["mode"],
                "disclosure": "",
                "items": [],
            }
        if presented["mode"] == "miniapp" and not presented["ready_for_launch"]:
            return {
                "enabled": False,
                "provider": "tiket",
                "environment": presented["environment"],
                "mode": presented["mode"],
                "disclosure": "",
                "items": [],
            }

        dest_docs = (
            await self.destination_repo.find_locations_by_ids(list(destination_ids))
            if destination_ids
            else []
        )
        zone = resolve_primary_zone(
            zones=zones,
            destination_docs=dest_docs,
            starting_point=starting_point,
        )
        cards = build_recommendation_cards(
            config=presented,
            zone=zone,
            source=source,
            lang=lang,
        )
        return {
            "enabled": bool(cards),
            "provider": "tiket",
            "environment": presented["environment"],
            "mode": presented["mode"],
            "disclosure": disclosure_copy(lang) if cards else "",
            "items": cards,
        }

    async def _record_click(
        self,
        *,
        product: str,
        zone: str,
        source: str,
        mode: str,
        environment: str,
        sub_id: str,
        anonymous_id: str,
        analytics_consent: bool,
    ) -> None:
        anon_hash = (
            self.crypto_gateway.hash_anonymous_id(anonymous_id)
            if analytics_consent and anonymous_id
            else ""
        )
        await self.analytics_repo.record_click(
            {
                "provider": "tiket",
                "product": product,
                "zone": normalize_zone(zone),
                "source": source,
                "mode": mode,
                "environment": environment,
                "sub_id": sub_id,
                "anonymous_id_hash": anon_hash,
            }
        )

    async def create_miniapp_session(
        self,
        payload: MiniAppSessionIn,
        *,
        user: dict | None,
        anonymous_id: str = "",
        analytics_consent: bool = False,
    ) -> dict[str, Any]:
        if not await self.is_feature_enabled(user):
            raise AffiliateError(404, "Tiket affiliate integration is disabled")
        raw = await self._raw_config()
        presented = _present_admin_config(raw)
        if not presented["enabled"] or presented["mode"] != "miniapp":
            raise AffiliateError(400, "Tiket MiniApp mode is not active")
        if not presented["products_enabled"].get(payload.product, False):
            raise AffiliateError(400, "Requested Tiket product is disabled")

        api_key = self.crypto_gateway.decrypt_secret(raw.get("miniapp_api_key_secret"))
        rsa_key = self.crypto_gateway.decrypt_secret(
            raw.get("miniapp_rsa_public_key_secret")
        )
        phone_number = (
            (payload.phone_number or "").strip() if payload.use_autologin else None
        )
        email = (user or {}).get("email") if payload.use_autologin and user else None
        full_name = (user or {}).get("name") if payload.use_autologin and user else None

        token = await self.tiket_gateway.request_miniapp_token(
            environment=presented["environment"],
            partner_identifier=presented["partner_identifier"],
            api_key=api_key,
            language=payload.lang,
            phone_number=phone_number,
            email=email,
            full_name=full_name,
            rsa_public_key_pem=rsa_key,
        )
        launch_url = build_miniapp_launch_url(
            base_url=presented["miniapp_base_url"],
            partner_slug=presented["partner_slug"],
            product=payload.product,
            token=token,
            lang=payload.lang,
            allowed_hosts=presented["allowed_redirect_hosts"],
        )
        zone = normalize_zone(payload.zone)
        sub_id = build_sub_id(payload.source, zone, payload.product)
        await self._record_click(
            product=payload.product,
            zone=zone,
            source=payload.source,
            mode="miniapp",
            environment=presented["environment"],
            sub_id=sub_id,
            anonymous_id=anonymous_id,
            analytics_consent=analytics_consent,
        )
        return {
            "provider": "tiket",
            "product": payload.product,
            "environment": presented["environment"],
            "launch_url": launch_url,
            "sub_id": sub_id,
            "expires_hint_seconds": 300,
        }

    async def resolve_redirect(
        self,
        *,
        user: dict | None,
        provider: str,
        product: str,
        zone: str,
        source: str,
        anonymous_id: str = "",
        analytics_consent: bool = False,
    ) -> str:
        if provider != "tiket":
            raise AffiliateError(400, "Unsupported affiliate provider")
        if product not in SUPPORTED_PRODUCTS:
            raise AffiliateError(400, "Unsupported affiliate product")
        if not await self.is_feature_enabled(user):
            raise AffiliateError(404, "Tiket affiliate integration is disabled")

        raw = await self._raw_config()
        presented = _present_admin_config(raw)
        if not presented["enabled"]:
            raise AffiliateError(404, "Tiket affiliate integration is disabled")
        if not presented["products_enabled"].get(product, False):
            raise AffiliateError(400, "Requested Tiket product is disabled")

        normalized_zone = normalize_zone(zone)
        sub_id = build_sub_id(source, normalized_zone, product)
        url = build_tiket_public_product_url(
            product=product,
            zone=normalized_zone,
            sub_id=sub_id,
            campaign_url_template=presented["campaign_url_template"],
            affiliate_id=presented["affiliate_id"],
            allowed_hosts=presented["allowed_redirect_hosts"],
        )
        await self._record_click(
            product=product,
            zone=normalized_zone,
            source=source,
            mode=presented["mode"],
            environment=presented["environment"],
            sub_id=sub_id,
            anonymous_id=anonymous_id,
            analytics_consent=analytics_consent,
        )
        return url

    async def get_admin_config(self) -> dict[str, Any]:
        return _present_admin_config(await self._raw_config())

    async def update_admin_config(
        self, payload: TiketAffiliateConfigIn, actor: dict
    ) -> dict[str, Any]:
        current = await self._raw_config()
        allowed_hosts = normalize_allowed_hosts(payload.allowed_redirect_hosts)

        # Validate template safely before saving if supplied
        if payload.campaign_url_template.strip():
            build_tiket_public_product_url(
                product="hotel",
                zone="toba_samosir",
                sub_id="ews_admin_toba_samosir_hotel",
                campaign_url_template=payload.campaign_url_template,
                affiliate_id=payload.affiliate_id,
                allowed_hosts=allowed_hosts,
            )

        updated: dict[str, Any] = {
            "provider": "tiket",
            "enabled": payload.enabled,
            "environment": payload.environment,
            "mode": payload.mode,
            "partner_identifier": payload.partner_identifier.strip(),
            "partner_slug": payload.partner_slug.strip(),
            "affiliate_id": payload.affiliate_id.strip(),
            "campaign_url_template": payload.campaign_url_template.strip(),
            "miniapp_production_base_url": payload.miniapp_production_base_url.strip().rstrip(
                "/"
            ),
            "products_enabled": {
                "hotel": payload.products_enabled.hotel,
                "flight": payload.products_enabled.flight,
            },
            "allowed_redirect_hosts": allowed_hosts,
            "updated_at": _now_iso(),
        }

        rotated_secrets: list[str] = []
        for field_name, storage_key, _ in _SECRET_SLOTS:
            action = getattr(payload, f"{field_name}_action")
            incoming = (getattr(payload, field_name) or "").strip()
            if action == "preserve":
                if current.get(storage_key):
                    updated[storage_key] = current[storage_key]
            elif action == "remove":
                updated[storage_key] = None
                rotated_secrets.append(f"{field_name}:removed")
            elif action == "replace":
                if not incoming:
                    raise AffiliateError(
                        400, f"Value is required when replacing {field_name}"
                    )
                updated[storage_key] = self.crypto_gateway.encrypt_secret(incoming)
                rotated_secrets.append(f"{field_name}:replaced")

        saved = await self.config_repo.upsert_tiket(updated)
        await self.audit.audit(
            actor,
            "update",
            "affiliate_config",
            "tiket",
            {
                "enabled": updated["enabled"],
                "environment": updated["environment"],
                "mode": updated["mode"],
                "products_enabled": updated["products_enabled"],
                "secrets_changed": rotated_secrets,
            },
        )
        return _present_admin_config(saved)

    async def preview_admin_config(
        self, payload: TiketAffiliatePreviewIn
    ) -> dict[str, Any]:
        raw = await self._raw_config()
        presented = _present_admin_config(raw)
        zone = normalize_zone(payload.zone)
        sub_id = build_sub_id("planner", zone, payload.product)
        cards = build_recommendation_cards(
            config={
                **presented,
                "products_enabled": {
                    "hotel": payload.product == "hotel",
                    "flight": payload.product == "flight",
                },
            },
            zone=zone,
            source="planner",
            lang=payload.lang,
        )
        card = cards[0]

        live_status: Literal["skipped", "ok", "error"] = "skipped"
        live_message = ""
        if presented["mode"] == "miniapp":
            slug = presented["partner_slug"] or "your-partner-slug"
            locale = "en-US" if payload.lang == "en" else "id-ID"
            preview_url = (
                f"{presented['miniapp_base_url']}/{locale}/miniapps/"
                f"{slug}/{payload.product}?token=<miniapp_jwt_token>"
            )
            if payload.live_token_test:
                api_key = self.crypto_gateway.decrypt_secret(
                    raw.get("miniapp_api_key_secret")
                )
                try:
                    token = await self.tiket_gateway.request_miniapp_token(
                        environment=presented["environment"],
                        partner_identifier=presented["partner_identifier"],
                        api_key=api_key,
                        language=payload.lang,
                    )
                    preview_url = build_miniapp_launch_url(
                        base_url=presented["miniapp_base_url"],
                        partner_slug=presented["partner_slug"],
                        product=payload.product,
                        token=token,
                        lang=payload.lang,
                        allowed_hosts=presented["allowed_redirect_hosts"],
                    )
                    live_status = "ok"
                    live_message = "MiniApp JWT token issued successfully."
                except AffiliateError as error:
                    live_status = "error"
                    live_message = error.detail
        else:
            preview_url = build_tiket_public_product_url(
                product=payload.product,
                zone=zone,
                sub_id=sub_id,
                campaign_url_template=presented["campaign_url_template"],
                affiliate_id=presented["affiliate_id"],
                allowed_hosts=presented["allowed_redirect_hosts"],
            )

        return {
            "mode": presented["mode"],
            "environment": presented["environment"],
            "product": payload.product,
            "zone": zone,
            "api_base_url": presented["api_base_url"],
            "preview_url": preview_url,
            "sub_id": sub_id,
            "ready": presented["ready_for_launch"],
            "readiness_notes": presented["readiness_notes"],
            "live_test_status": live_status,
            "live_test_message": live_message,
            "card": card,
        }

    async def analytics_summary(self, days: int = 30) -> dict[str, Any]:
        bounded = max(1, min(int(days), 90))
        return await self.analytics_repo.summarize(bounded)
