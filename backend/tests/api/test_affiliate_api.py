"""HTTP boundary tests for the affiliates router."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.affiliates.dependencies import get_affiliate_service
from app.modules.affiliates.router import EXCEPTION_HANDLERS, router
from app.modules.auth.dependencies import get_optional_user, require_admin


class FakeAffiliateService:
    async def recommendations(self, **_kwargs):
        return {
            "enabled": True,
            "provider": "tiket",
            "environment": "sandbox",
            "mode": "campaign_link",
            "disclosure": "Tautan partner · Pemesanan & harga diproses langsung di tiket.com",
            "items": [
                {
                    "provider": "tiket",
                    "product": "flight",
                    "zone": "toba_samosir",
                    "mode": "campaign_link",
                    "title": "Tiket Pesawat ke DTB",
                    "subtitle": "Bandara Silangit (DTB)",
                    "badge": "Tiket.com · Flight",
                    "cta_label": "Cari pesawat di tiket.com",
                    "destination_label": "Bandara Silangit (DTB)",
                    "airport_code": "DTB",
                    "airport_name": "Bandara Silangit (DTB)",
                    "accommodation_area": None,
                    "launch_type": "redirect",
                    "go_url": "/api/affiliates/go?provider=tiket&product=flight&zone=toba_samosir&source=planner",
                    "sub_id": "ews_planner_toba_samosir_flight",
                    "disclosure": "Tautan partner",
                }
            ],
        }

    async def create_miniapp_session(self, payload, **_kwargs):
        return {
            "provider": "tiket",
            "product": payload.product,
            "environment": "sandbox",
            "launch_url": f"https://aff.tiketsandbox.net/id-ID/miniapps/ews/{payload.product}?token=tok123",
            "sub_id": f"ews_{payload.source}_{payload.zone}_{payload.product}",
            "expires_hint_seconds": 300,
        }

    async def resolve_redirect(self, **_kwargs):
        return "https://www.tiket.com/hotel/indonesia/area-danau-toba?utm_source=explorewisatasumut"

    async def get_admin_config(self):
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
            "allowed_redirect_hosts": ["tiket.com"],
            "has_miniapp_api_key": False,
            "has_miniapp_rsa_public_key": False,
            "has_hotel_v2_auth": False,
            "has_flight_v2_api_key": False,
            "api_base_url": "https://api.tiketsandbox.net",
            "miniapp_base_url": "https://aff.tiketsandbox.net",
            "ready_for_launch": False,
            "readiness_notes": [],
            "updated_at": "",
        }

    async def update_admin_config(self, payload, _actor):
        base = await self.get_admin_config()
        return {
            **base,
            "enabled": payload.enabled,
            "environment": payload.environment,
            "mode": payload.mode,
            "partner_identifier": payload.partner_identifier,
            "partner_slug": payload.partner_slug,
        }

    async def preview_admin_config(self, payload):
        return {
            "mode": "miniapp",
            "environment": "sandbox",
            "product": payload.product,
            "zone": payload.zone,
            "api_base_url": "https://api.tiketsandbox.net",
            "preview_url": "https://aff.tiketsandbox.net/id-ID/miniapps/ews/hotel?token=tok",
            "sub_id": f"ews_planner_{payload.zone}_{payload.product}",
            "ready": True,
            "readiness_notes": [],
            "live_test_status": "skipped",
            "live_test_message": "",
            "card": (await self.recommendations())["items"][0],
        }

    async def analytics_summary(self, days: int):
        return {
            "days": days,
            "total_clicks": 5,
            "by_product": [{"key": "hotel", "count": 3}, {"key": "flight", "count": 2}],
            "by_zone": [{"key": "toba_samosir", "count": 5}],
            "by_source": [{"key": "planner", "count": 5}],
            "by_mode": [{"key": "miniapp", "count": 5}],
        }


def _client():
    app = create_app(api_routers=(router,), exception_handlers=EXCEPTION_HANDLERS)
    service = FakeAffiliateService()
    app.dependency_overrides[get_affiliate_service] = lambda: service
    app.dependency_overrides[get_optional_user] = lambda: None
    app.dependency_overrides[require_admin] = lambda: {
        "id": "admin-1",
        "email": "admin@example.com",
        "role": "admin",
    }
    return TestClient(app)


def test_public_affiliate_endpoints():
    with _client() as client:
        rec = client.get(
            "/api/affiliates/recommendations?zones=toba_samosir&source=planner&lang=id"
        )
        assert rec.status_code == 200
        assert rec.json()["items"][0]["airport_code"] == "DTB"

        session = client.post(
            "/api/affiliates/tiket/miniapp-session",
            json={"product": "hotel", "zone": "toba_samosir", "source": "planner"},
        )
        assert session.status_code == 200
        assert "aff.tiketsandbox.net" in session.json()["launch_url"]

        redirect = client.get(
            "/api/affiliates/go?provider=tiket&product=hotel&zone=toba_samosir&source=planner",
            follow_redirects=False,
        )
        assert redirect.status_code == 302
        assert redirect.headers["location"].startswith("https://www.tiket.com/hotel/")


def test_admin_affiliate_endpoints():
    with _client() as client:
        get_res = client.get("/api/admin/affiliates/tiket")
        assert get_res.status_code == 200
        assert get_res.json()["api_base_url"] == "https://api.tiketsandbox.net"

        put_res = client.put(
            "/api/admin/affiliates/tiket",
            json={
                "enabled": True,
                "environment": "sandbox",
                "mode": "miniapp",
                "partner_identifier": "ews-id",
                "partner_slug": "ews-slug",
            },
        )
        assert put_res.status_code == 200
        assert put_res.json()["partner_slug"] == "ews-slug"

        preview_res = client.post(
            "/api/admin/affiliates/tiket/preview",
            json={"zone": "toba_samosir", "product": "hotel"},
        )
        assert preview_res.status_code == 200
        assert preview_res.json()["ready"] is True

        analytics_res = client.get("/api/admin/affiliates/analytics?days=30")
        assert analytics_res.status_code == 200
        assert analytics_res.json()["total_clicks"] == 5
