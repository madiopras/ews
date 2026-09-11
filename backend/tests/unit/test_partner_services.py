"""Unit coverage for Partner lifecycle, ownership, and public privacy policies."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId

from app.modules.partners.domain import (
    partner_completeness,
    validate_admin_transition,
)
from app.modules.partners.exceptions import PartnerError
from app.modules.partners.gateways import PartnerStorageGateway
from app.modules.partners.mapper import partner_to_public_response
from app.modules.partners.schemas import PartnerStatusIn
from app.modules.partners.service import PartnerService


def partner_document(**overrides):
    document = {
        "_id": ObjectId(),
        "business_name": "Pemandu Toba",
        "type": "guide",
        "whatsapp": "628123456789",
        "description": "Pemandu lokal untuk perjalanan aman di kawasan Danau Toba.",
        "city": "Samosir",
        "email": "private@example.com",
        "address": "Alamat privat",
        "destination_ids": ["destination-1"],
        "service_tags": ["alam", "budaya"],
        "verification_documents": [],
        "gallery": [],
        "status": "pending",
        "is_active": False,
        "owner_user_id": "owner",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    document.update(overrides)
    return document


class AccessRepository:
    def __init__(self, document=None, memberships=None):
        self.document = document or partner_document()
        self.memberships = memberships or {}
        self.membership_updates = []
        self.audit_entries = []

    async def get(self, _partner_id, *_args):
        return self.document

    async def membership(self, _partner_id, user_id):
        role = self.memberships.get(user_id)
        return {"role": role} if role else None

    async def upsert_membership(self, partner_id, user_id, role, _now):
        self.membership_updates.append((partner_id, user_id, role))
        self.memberships[user_id] = role

    async def update(self, _partner_id, changes, push=None):
        self.document.update(changes)
        if push:
            for field, value in push.items():
                self.document.setdefault(field, []).append(value)
        return self.document

    async def set_user_partner_role(self, *_args):
        return None

    async def users_by_ids(self, _values):
        return {}

    async def audit(self, actor, action, partner_id, details, _now):
        self.audit_entries.append((actor, action, partner_id, details))


def test_admin_transition_policy_rejects_invalid_approval_and_short_revision_note():
    validate_admin_transition("pending", "approved", "")

    with pytest.raises(PartnerError) as approval_error:
        validate_admin_transition("draft", "approved", "")
    assert approval_error.value.status_code == 409

    with pytest.raises(PartnerError) as note_error:
        validate_admin_transition("pending", "needs_revision", "no")
    assert note_error.value.status_code == 400


def test_owner_and_staff_matrix_is_enforced_in_the_service_boundary():
    repository = AccessRepository(memberships={"staff": "staff"})
    service = PartnerService(repository, analytics_secret="secret")

    with pytest.raises(PartnerError) as error:
        asyncio.run(service.submit("partner-1", {"id": "staff"}, False))
    assert (error.value.status_code, error.value.detail) == (
        403,
        "Partner access denied",
    )

    partner, role = asyncio.run(service._access("partner-1", {"id": "owner"}))
    assert partner is repository.document
    assert role == "owner"
    assert repository.membership_updates == [("partner-1", "owner", "owner")]


def test_status_change_uses_transition_policy_and_activates_only_approved_partner():
    repository = AccessRepository()
    service = PartnerService(repository, analytics_secret="secret")
    admin = {"id": "admin", "email": "admin@example.com"}

    approved = asyncio.run(
        service.status("partner-1", PartnerStatusIn(status="approved"), admin)
    )
    assert approved.status == "approved"
    assert approved.is_active is True
    assert repository.audit_entries[-1][1] == "status_change"

    with pytest.raises(PartnerError) as error:
        asyncio.run(
            service.status("partner-1", PartnerStatusIn(status="approved"), admin)
        )
    assert error.value.status_code == 409


def test_public_projection_excludes_private_workspace_and_document_fields():
    document = partner_document(
        status="approved",
        is_active=True,
        accepting_contacts=False,
        premium_until=(datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        verification_documents=[{"id": "private-document"}],
    )
    result = partner_to_public_response(document).model_dump()
    assert result["whatsapp"] is None
    assert result["promotional_disclosure"] == "unggulan_berbayar"
    assert {
        "email",
        "address",
        "owner_user_id",
        "verification_documents",
        "approval_history",
        "members",
    }.isdisjoint(result)


def test_profile_completeness_is_a_pure_deterministic_policy():
    complete = partner_document(
        description="x" * 80,
        gallery=[{"id": "image"}],
        guide_languages=["Indonesia"],
    )
    assert partner_completeness(complete, offerings_count=1) == (100, [])
    score, missing = partner_completeness(partner_document(), offerings_count=0)
    assert score < 100
    assert {"gallery", "offerings"}.issubset(missing)


def test_local_storage_gateway_rejects_path_traversal(tmp_path):
    settings = type(
        "StorageSettings",
        (),
        {
            "storage_app_name": "test",
            "integration_proxy_url": "",
            "emergent_llm_key": type(
                "Secret", (), {"get_secret_value": lambda self: ""}
            )(),
            "storage_dir": tmp_path,
        },
    )()
    gateway = PartnerStorageGateway(settings)

    asyncio.run(gateway.put("partners/proof.pdf", b"%PDF-test", "application/pdf"))
    assert asyncio.run(gateway.get("partners/proof.pdf")) == (
        b"%PDF-test",
        "application/pdf",
    )
    asyncio.run(gateway.delete("partners/proof.pdf"))
    assert not (tmp_path / "partners" / "proof.pdf").exists()

    for unsafe in ("../secret", "/absolute/path", "folder\\secret", "a?query"):
        with pytest.raises(ValueError, match="Invalid storage path"):
            asyncio.run(gateway.get(unsafe))
