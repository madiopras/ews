from pathlib import Path
import sys

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from audit_culinary_partners import matched_terms


def culinary_draft(**overrides):
    values = {
        "business_name": "Dapur Toba",
        "type": "culinary",
        "whatsapp": "628123456789",
        "description": "Usaha kuliner lokal dengan makanan khas Sumatera Utara.",
        "city": "Samosir",
        "destination_ids": [str(ObjectId())],
        "service_tags": ["Keluarga", "kopi"],
        "current_step": 4,
        "culinary_categories": ["Rumah makan", "Kedai kopi"],
        "culinary_specialties": ["Arsik", "Kopi lintong"],
        "culinary_service_modes": ["Dine-in", "Takeaway"],
        "culinary_dietary_tags": ["Informasi halal tersedia langsung"],
        "culinary_opening_info": "Buka setiap hari; konfirmasi jam melalui WhatsApp.",
        "culinary_reservation_note": "Hubungi langsung untuk rombongan.",
    }
    values.update(overrides)
    return server.PartnerDraftIn.model_validate(values)


def submission_doc(**overrides):
    payload = culinary_draft().model_dump()
    payload.update({"verification_documents": [{"id": "doc-1"}]})
    payload.update(overrides)
    return payload


def test_partner_contract_accepts_culinary_and_rejects_unknown_type():
    assert culinary_draft().type == "culinary"
    with pytest.raises(ValidationError):
        culinary_draft(type="restaurant")


def test_culinary_fields_are_normalized_without_price_fields():
    payload = culinary_draft(
        culinary_specialties=[" Arsik ", "Arsik", "Kopi Lintong"],
        culinary_opening_info="  Buka pagi sampai sore  ",
    )
    changes = server.partner_draft_changes(payload)

    assert changes["culinary_specialties"] == ["Arsik", "Kopi Lintong"]
    assert changes["culinary_opening_info"] == "Buka pagi sampai sore"
    assert "price" not in changes
    assert "menu_prices" not in changes


def test_culinary_submission_requires_signature_food_or_drinks():
    with pytest.raises(HTTPException) as error:
        server.validate_partner_submission(submission_doc(culinary_specialties=[]))
    assert "culinary_specialties" in error.value.detail["fields"]

    server.validate_partner_submission(submission_doc())


def test_culinary_completeness_and_public_type_details_are_safe():
    complete = submission_doc(
        gallery=[{"id": "image-1"}],
        service_tags=["keluarga", "kopi"],
        description="Usaha kuliner lokal yang menyajikan makanan khas Sumatera Utara dengan informasi layanan yang diperbarui secara berkala.",
    )
    score, missing = server.partner_completeness(complete, offerings_count=1)
    assert score == 100
    assert missing == []

    complete["owner_user_id"] = "private-owner"
    complete["verification_documents"] = [{"filename": "private.pdf"}]
    details = server.partner_public_type_details(complete)
    assert details["culinary_specialties"] == ["Arsik", "Kopi lintong"]
    assert "owner_user_id" not in details
    assert "verification_documents" not in details


def test_planner_matches_culinary_keywords_and_real_profile_tags():
    target = {"_id": ObjectId(), "name": "Danau Toba", "name_en": "Lake Toba"}
    target_id = str(target["_id"])
    partner = {
        "id": "culinary-1",
        "business_name": "Dapur Toba",
        "type": "culinary",
        "whatsapp": "628123456789",
        "city": "Samosir",
        "description": "Makanan khas lokal.",
        "image": "",
        "service_tags": ["kopi lintong", "keluarga"],
        "is_premium": False,
        "status": "approved",
        "is_active": True,
        "accepting_contacts": True,
    }

    _, recommendations = server.build_planner_partner_recommendations(
        "Mengunjungi Danau Toba",
        [target],
        {target_id: [partner]},
        [],
        "ingin wisata kuliner dan minum kopi lintong",
        "id",
    )

    assert recommendations[0]["type"] == "culinary"
    assert recommendations[0]["partner"]["type"] == "culinary"
    assert "Sesuai kebutuhan perjalanan" in recommendations[0]["match_reasons"]
    assert any("kopi lintong" in reason for reason in recommendations[0]["match_reasons"])


@pytest.mark.parametrize("keyword", ["kuliner", "makanan", "kopi", "restaurant", "food"])
def test_planner_recognizes_bilingual_culinary_matching_keywords(keyword):
    target = {"_id": ObjectId(), "name": "Danau Toba", "name_en": "Lake Toba"}
    target_id = str(target["_id"])
    partner = {
        "id": "culinary-keyword",
        "business_name": "Dapur Toba",
        "type": "culinary",
        "whatsapp": "628123456789",
        "city": "Samosir",
        "description": "Local culinary business.",
        "image": "",
        "service_tags": [],
        "is_premium": False,
        "status": "approved",
        "is_active": True,
        "accepting_contacts": True,
    }
    _, recommendations = server.build_planner_partner_recommendations(
        "Lake Toba", [target], {target_id: [partner]}, [], f"looking for {keyword}", "en"
    )
    assert "Matches trip needs" in recommendations[0]["match_reasons"]


def test_legacy_audit_detects_candidates_without_using_private_fields():
    document = {
        "business_name": "Kedai Kopi Toba",
        "description": "Menyediakan kopi dan makanan lokal.",
        "owner_user_id": "private-owner",
        "whatsapp": "628123456789",
        "verification_documents": [{"filename": "private.pdf"}],
    }
    assert set(matched_terms(document)) >= {"makanan", "kedai", "kopi"}
