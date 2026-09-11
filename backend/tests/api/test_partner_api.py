"""HTTP boundary coverage for the modular Partner and Mitra router."""

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
    require_admin,
)
from app.modules.partners.dependencies import get_partner_service
from app.modules.partners.router import EXCEPTION_HANDLERS, router
from app.modules.partners.service import PartnerFile


def partner_payload(**overrides):
    payload = {
        "id": "partner-1",
        "business_name": "Pemandu Toba",
        "type": "guide",
        "whatsapp": "628123456789",
        "description": "Pemandu lokal untuk perjalanan di kawasan Danau Toba.",
        "city": "Samosir",
        "destination_ids": [],
        "service_tags": [],
        "status": "draft",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "membership_role": "owner",
    }
    payload.update(overrides)
    return payload


class FakePartnerService:
    events = []

    async def start_onboarding(self, payload, _user):
        return partner_payload(type=payload.type)

    async def list_mine(self, _user):
        return [partner_payload()]

    async def list_public(self, _destination_id, _partner_type):
        public = partner_payload(status="approved", is_active=True)
        public.pop("membership_role")
        return [public]

    async def public_detail(self, _partner_id):
        public = partner_payload(status="approved", is_active=True)
        public.pop("membership_role")
        public.update(
            {
                "gallery": [],
                "offerings": [],
                "destinations": [],
                "type_details": {},
            }
        )
        return public

    async def track_event(self, payload, consent, user):
        self.events.append((payload.event_id, consent, user))
        return (
            {"accepted": consent, "duplicate": False}
            if consent
            else {
                "accepted": False,
                "reason": "consent_required",
            }
        )

    async def status(self, _partner_id, payload, _admin):
        result = partner_payload(
            status=payload.status,
            is_active=payload.status == "approved",
        )
        result.pop("membership_role")
        return result

    async def upload_document(
        self, _partner_id, _kind, _filename, _content_type, _data, _user
    ):
        result = partner_payload()
        result.pop("membership_role")
        return result

    async def download_document(self, _partner_id, _document_id, _user):
        return PartnerFile(b"%PDF-test", "application/pdf", "proof.pdf")

    async def upload_gallery(self, _partner_id, _filename, _content_type, _data, _user):
        return partner_payload()


def make_client():
    application = create_app(
        api_routers=(router,), exception_handlers=EXCEPTION_HANDLERS
    )
    identity = {
        "id": "owner",
        "name": "Owner",
        "email": "owner@example.com",
        "role": "admin",
    }
    application.dependency_overrides.update(
        {
            get_current_user: lambda: identity,
            get_optional_user: lambda: identity,
            require_admin: lambda: identity,
            get_partner_service: FakePartnerService,
        }
    )
    return TestClient(application)


def test_workspace_public_and_admin_routes_use_the_partner_service_boundary():
    with make_client() as client:
        onboarding = client.post("/api/mitra/onboarding", json={"type": "guide"})
        assert onboarding.status_code == 201
        assert onboarding.json()["membership_role"] == "owner"
        assert client.get("/api/mitra/partners").status_code == 200

        listing = client.get("/api/partners")
        assert listing.status_code == 200
        assert "verification_documents" not in listing.json()[0]
        detail = client.get("/api/partners/partner-1/public")
        assert detail.status_code == 200
        assert "owner_user_id" not in detail.json()

        status = client.patch(
            "/api/partners/partner-1/status", json={"status": "approved"}
        )
        assert status.status_code == 200
        assert status.json()["is_active"] is True


def test_private_media_and_consent_headers_keep_the_existing_http_contract():
    with make_client() as client:
        event = {
            "event_id": "event_identifier_1234",
            "event_type": "profile_view",
            "partner_id": "partner-1",
            "source": "partner_detail",
            "anonymous_session_id": "anonymous_identifier_1234",
        }
        declined = client.post("/api/analytics/partner-events", json=event)
        assert declined.json() == {"accepted": False, "reason": "consent_required"}
        accepted = client.post(
            "/api/analytics/partner-events",
            json=event,
            headers={"X-Analytics-Consent": "granted"},
        )
        assert accepted.json() == {"accepted": True, "duplicate": False}

        upload = client.post(
            "/api/partners/partner-1/upload-docs",
            data={"document_type": "ktp"},
            files={"file": ("proof.pdf", b"%PDF-test", "application/pdf")},
        )
        assert upload.status_code == 200
        download = client.get("/api/mitra/partners/partner-1/documents/document-1")
        assert download.content == b"%PDF-test"
        assert download.headers["cache-control"] == "private, no-store"
        assert download.headers["x-content-type-options"] == "nosniff"

        gallery = client.post(
            "/api/mitra/partners/partner-1/gallery",
            files={"file": ("view.png", b"\x89PNG\r\n\x1a\n", "image/png")},
        )
        assert gallery.status_code == 200
