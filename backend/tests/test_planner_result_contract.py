import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from planner_result_contract import (
    PLANNER_ERROR_CODES,
    PLANNER_RESULT_VERSION,
    PlannerResultV2,
    planner_destination_card_from_doc,
    planner_error_message,
    planner_partner_match_from_doc,
    planner_partner_public_from_doc,
)


def valid_result_payload():
    return {
        "version": PLANNER_RESULT_VERSION,
        "result_format": "structured",
        "request_snapshot": {
            "days": 2,
            "budget_style": "mid_range",
            "interests": ["nature"],
            "lang": "id",
        },
        "summary": "Perjalanan alam yang santai.",
        "days": [{
            "day": 1,
            "title": "Menikmati kawasan Toba",
            "area_label": "Toba",
            "description": "Hari pertama dengan ritme ringan.",
            "stops": [{
                "period": "morning",
                "time_label": "Pagi",
                "destination_id": "dest-1",
                "activity": "Menikmati panorama dari destinasi terpilih.",
                "practical_tip": "Bawa air minum.",
            }],
        }],
        "destination_ids": ["dest-1"],
        "destinations": [{
            "id": "dest-1",
            "name": "Danau Toba",
            "name_en": "Lake Toba",
            "location": "Sumatera Utara",
            "category": "lake",
            "images": [],
            "description": "Destinasi editorial.",
            "description_en": "Editorial destination.",
        }],
        "partner_matches": [],
        "travel_notes": [],
        "travel_tips": ["Konfirmasi kondisi terbaru sebelum berangkat."],
        "generated_at": "2026-08-29T10:00:00+00:00",
    }


def test_planner_result_v2_accepts_a_valid_provider_agnostic_contract():
    result = PlannerResultV2.model_validate(valid_result_payload())
    assert result.version == 2
    assert result.days[0].stops[0].destination_id == "dest-1"


@pytest.mark.parametrize("mutation", ["unknown_stop", "duplicate_day", "too_many_days", "extra_field"])
def test_planner_result_v2_rejects_invalid_relationships_and_unknown_fields(mutation):
    payload = valid_result_payload()
    if mutation == "unknown_stop":
        payload["days"][0]["stops"][0]["destination_id"] = "not-allowed"
    elif mutation == "duplicate_day":
        payload["days"].append(dict(payload["days"][0]))
    elif mutation == "too_many_days":
        payload["days"][0]["day"] = 3
    else:
        payload["provider_secret"] = "must-not-pass"
    with pytest.raises(ValidationError):
        PlannerResultV2.model_validate(payload)


def test_destination_serializer_exposes_only_card_fields_and_rejects_inactive_rows():
    doc = {
        "_id": "dest-1",
        "name": "Danau Toba",
        "name_en": "Lake Toba",
        "location": "Sumatera Utara",
        "category": "lake",
        "images": ["data:image/png;base64,private", "/image.webp"],
        "description": "Deskripsi publik.",
        "description_en": "Public description.",
        "price": 500000,
        "admin_note": "private",
        "is_active": True,
        "latitude": 2.61,
        "longitude": 98.88,
    }
    dumped = planner_destination_card_from_doc(doc).model_dump()
    assert dumped["id"] == "dest-1"
    assert dumped["images"] == ["/image.webp"]
    assert dumped["latitude"] == 2.61
    assert "price" not in dumped
    assert "admin_note" not in dumped

    doc["is_active"] = False
    with pytest.raises(ValueError):
        planner_destination_card_from_doc(doc)


def test_partner_serializer_redacts_private_fields_and_contact_when_unavailable():
    doc = {
        "_id": "partner-1",
        "business_name": "Homestay Lokal",
        "type": "homestay",
        "whatsapp": "+62 812-3456-7890",
        "city": "Toba",
        "description": "Usaha lokal yang melayani wisatawan.",
        "service_tags": ["keluarga"],
        "status": "approved",
        "is_active": True,
        "accepting_contacts": False,
        "owner_user_id": "private-owner",
        "email": "private@example.com",
        "address": "private street",
        "verification_documents": [{"id": "private"}],
        "image": "data:image/png;base64,private",
    }
    dumped = planner_partner_public_from_doc(doc, is_premium=True).model_dump()
    assert dumped["whatsapp"] is None
    assert dumped["promotional_disclosure"] == "unggulan_berbayar"
    assert dumped["image"] == ""
    for private_field in ("owner_user_id", "email", "address", "verification_documents"):
        assert private_field not in dumped


def test_partner_match_serializer_hydrates_identity_from_the_database_document():
    doc = {
        "_id": "partner-1",
        "business_name": "Pemandu Lokal",
        "type": "guide",
        "whatsapp": "628123456789",
        "city": "Toba",
        "description": "Pemandu wisata lokal.",
        "status": "approved",
        "is_active": True,
        "accepting_contacts": True,
    }
    match = planner_partner_match_from_doc(
        doc,
        destination_ids=["dest-1"],
        match_reasons=["Melayani destinasi ini"],
    )
    assert match.partner_id == "partner-1"
    assert match.partner.business_name == "Pemandu Lokal"
    assert match.destination_ids == ["dest-1"]


def test_planner_error_contract_has_safe_bilingual_copy_for_every_code():
    for code in PLANNER_ERROR_CODES:
        assert planner_error_message(code, "id")
        assert planner_error_message(code, "en")
        assert "api key" not in planner_error_message(code, "en").lower()
