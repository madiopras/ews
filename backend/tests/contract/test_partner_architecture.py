"""Static architecture and privacy gates for the Phase 6 Partner slice."""

from pathlib import Path

from app.modules.partners.schemas import PartnerPublicDetailOut, PartnerPublicOut

BACKEND_DIR = Path(__file__).resolve().parents[2]
PARTNER_DIR = BACKEND_DIR / "app" / "modules" / "partners"


def test_partner_router_contains_no_database_storage_or_bson_operations():
    source = (PARTNER_DIR / "router.py").read_text(encoding="utf-8")
    forbidden = (
        "ObjectId",
        ".find(",
        ".find_one(",
        ".insert_one(",
        ".update_one(",
        ".delete_one(",
        "requests.",
        "Path(",
    )
    assert all(value not in source for value in forbidden)


def test_partner_service_is_framework_bson_and_transport_independent():
    source = (PARTNER_DIR / "service.py").read_text(encoding="utf-8")
    assert "fastapi" not in source.lower()
    assert "HTTPException" not in source
    assert "ObjectId" not in source
    assert "requests." not in source
    assert "await self.storage" in source


def test_legacy_module_no_longer_defines_phase6_routes():
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    decorators = (
        '@api_router.post("/partners")',
        '@api_router.post("/mitra/onboarding")',
        '@api_router.get("/mitra/partners")',
        '@api_router.get("/mitra/partners/{partner_id}")',
        '@api_router.put("/mitra/partners/{partner_id}/draft")',
        '@api_router.post("/mitra/partners/{partner_id}/submit")',
        '"/mitra/partners/{partner_id}/resubmit"',
        '"/mitra/partners/{partner_id}/members"',
        '"/mitra/partners/{partner_id}/profile"',
        '"/mitra/partners/{partner_id}/availability"',
        '"/mitra/partners/{partner_id}/offerings"',
        '@api_router.get("/partners/{partner_id}/public")',
        '@api_router.get("/partners", response_model=List[PartnerPublicOut])',
        '@api_router.post("/analytics/partner-events")',
        '@api_router.post("/partners/admin")',
        '@api_router.get("/admin/partners")',
        '"/admin/partners/{partner_id}/owner"',
        '"/partners/{partner_id}/toggle-active"',
        '"/partners/{partner_id}/status"',
        '"/partners/{partner_id}/upload-docs"',
        '"/mitra/partners/{partner_id}/gallery"',
        '@api_router.delete("/partners/{partner_id}")',
    )
    assert all(decorator not in source for decorator in decorators)
    assert "class PartnerIn(" not in source
    assert "class PartnerDraftIn(" not in source
    assert "class PartnerPublicOut(" not in source
    assert "class PartnerAdminOut(" not in source
    assert "class PartnerAnalyticsEventIn(" not in source


def test_public_partner_contract_has_an_explicit_private_field_denylist():
    private_fields = {
        "email",
        "address",
        "owner_user_id",
        "ownership_status",
        "verification_documents",
        "approval_history",
        "reviewed_by",
        "reviewed_at",
        "revision_note",
        "members",
        "membership_role",
    }
    assert private_fields.isdisjoint(PartnerPublicOut.model_fields)
    assert private_fields.isdisjoint(PartnerPublicDetailOut.model_fields)
