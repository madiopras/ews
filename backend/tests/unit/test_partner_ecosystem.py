"""Unit tests for the expanded 7-type Partner ecosystem (Phases M1-M2)."""

from __future__ import annotations

import pytest

from app.modules.partners.domain import (
    partner_completeness,
    partner_draft_changes,
    validate_submission,
)
from app.modules.partners.exceptions import PartnerError
from app.modules.partners.mapper import offering_to_response, public_type_details
from app.modules.partners.schemas import PartnerDraftIn, PartnerOfferingIn
from app.modules.planner.domain import (
    build_planner_partner_recommendations,
    group_matchable_partners,
)


def test_rental_and_homestay_rich_details_normalize_and_serialize_cleanly():
    rental_draft = PartnerDraftIn(
        business_name="Toba Trans Rental",
        type="rental",
        whatsapp="+62 812-3456-7890",
        description="Sewa Hiace dan Innova Reborn dengan supir lokal berpengalaman lintas Danau Toba.",
        city="Medan",
        destination_ids=["dest-1"],
        service_tags=["hiace", "kualanamu"],
        instagram_url="https://instagram.com/tobatrans",
        google_maps_url="https://maps.google.com/?q=Medan",
        rental_vehicle_types=["Hiace 14 Seat", "Innova Reborn", "Hiace 14 Seat"],
        rental_service_options=[
            "Dengan Supir",
            "Antar-Jemput KNO",
            "Antar-Jemput Silangit",
        ],
        rental_pickup_areas=["Bandara KNO", "Kota Medan", "Parapat"],
        rental_driver_available=True,
        rental_fleet_size=8,
    )
    normalized = partner_draft_changes(rental_draft, "2026-11-23T00:00:00+00:00")
    assert normalized["rental_vehicle_types"] == ["Hiace 14 Seat", "Innova Reborn"]
    assert normalized["rental_service_options"] == [
        "Dengan Supir",
        "Antar-Jemput KNO",
        "Antar-Jemput Silangit",
    ]
    assert normalized["instagram_url"] == "https://instagram.com/tobatrans"
    details = public_type_details(normalized)
    assert details["rental_pickup_areas"] == ["Bandara KNO", "Kota Medan", "Parapat"]
    assert details["rental_fleet_size"] == 8

    homestay_doc = {
        "type": "homestay",
        "accommodation_subtype": "villa",
        "homestay_room_types": ["Deluxe Lake View", "Family Room", "Cottage"],
        "homestay_room_count": 6,
        "homestay_max_guests": 18,
        "homestay_facilities": ["WiFi", "Sarapan", "View Danau Toba"],
        "homestay_checkin_info": "Check-in 14:00, Check-out 12:00",
    }
    homestay_details = public_type_details(homestay_doc)
    assert homestay_details["accommodation_subtype"] == "villa"
    assert homestay_details["homestay_room_types"] == [
        "Deluxe Lake View",
        "Family Room",
        "Cottage",
    ]
    assert homestay_details["homestay_max_guests"] == 18


def test_private_license_numbers_never_leak_to_public_type_details():
    guide_details = public_type_details(
        {
            "type": "guide",
            "guide_languages": ["Indonesia", "English"],
            "guide_specialties": ["Budaya Batak", "Fotografi"],
            "guide_license_number": "HPI-SUMUT-9991",
            "guide_experience_years": 7,
            "guide_max_group_size": 12,
        }
    )
    assert guide_details["has_license"] is True
    assert "guide_license_number" not in guide_details
    assert "HPI-SUMUT-9991" not in str(guide_details)

    tour_details = public_type_details(
        {
            "type": "tour_operator",
            "tour_trip_types": ["Private Tour", "Open Trip"],
            "tour_inclusions": ["Transport", "Penginapan", "Ferry"],
            "tour_departure_hubs": ["Medan", "KNO", "Silangit"],
            "tour_min_pax": 2,
            "tour_max_pax": 24,
            "tour_license_number": "ASITA-SUMUT-882",
        }
    )
    assert tour_details["has_license"] is True
    assert "tour_license_number" not in tour_details
    assert "ASITA-SUMUT-882" not in str(tour_details)


def test_unsafe_social_or_maps_urls_are_rejected():
    bad = PartnerDraftIn(
        type="homestay",
        instagram_url="javascript:alert(1)",
    )
    with pytest.raises(PartnerError) as exc_info:
        partner_draft_changes(bad, "2026-11-23T00:00:00+00:00")
    assert exc_info.value.status_code == 400


def test_new_partner_types_submission_validation_and_completeness():
    base = {
        "business_name": "Sumut Explorer",
        "whatsapp": "6281234567890",
        "description": "Operator paket wisata dan petualangan resmi Sumatera Utara dengan jadwal fleksibel dan ramah keluarga.",
        "city": "Parapat",
        "destination_ids": ["dest-1"],
        "service_tags": ["danau toba", "open trip"],
        "gallery": [{"id": "g1"}],
        "verification_documents": [{"id": "d1"}],
    }

    # tour_operator requires tour_trip_types and tour_inclusions
    with pytest.raises(PartnerError) as exc_tour:
        validate_submission({**base, "type": "tour_operator"})
    assert "tour_trip_types" in exc_tour.value.detail["fields"]
    assert "tour_inclusions" in exc_tour.value.detail["fields"]

    valid_tour = {
        **base,
        "type": "tour_operator",
        "tour_trip_types": ["Open Trip"],
        "tour_inclusions": ["Transport", "Penginapan"],
    }
    validate_submission(valid_tour)
    score, missing = partner_completeness(valid_tour, offerings_count=1)
    assert score == 100
    assert missing == []

    # activity requires activity_categories
    with pytest.raises(PartnerError) as exc_act:
        validate_submission({**base, "type": "activity"})
    assert "activity_categories" in exc_act.value.detail["fields"]

    validate_submission(
        {
            **base,
            "type": "activity",
            "activity_categories": ["Jungle Trekking Orangutan"],
        }
    )


def test_offering_rich_metadata_roundtrip():
    offering_in = PartnerOfferingIn(
        kind="service",
        name="Deluxe Lake View Room",
        description="Kamar menghadap langsung ke Danau Toba.",
        capacity_info="2-3 orang",
        duration_info="Per malam",
        highlights=["Sarapan", "AC", "View Danau"],
    )
    out = offering_to_response(
        {
            **offering_in.model_dump(),
            "_id": "off-1",
            "partner_id": "p-1",
            "created_at": "2026-11-23T00:00:00+00:00",
            "updated_at": "2026-11-23T00:00:00+00:00",
        }
    )
    assert out.capacity_info == "2-3 orang"
    assert out.duration_info == "Per malam"
    assert out.highlights == ["Sarapan", "AC", "View Danau"]


def test_ai_planner_indexes_rental_homestay_tour_and_activity_attributes():
    destinations = [
        {"_id": "dest-toba", "name": "Danau Toba", "name_en": "Lake Toba"},
        {"_id": "dest-bl", "name": "Bukit Lawang", "name_en": "Bukit Lawang"},
    ]
    partners = [
        {
            "_id": "p-rental",
            "business_name": "Toba Hiace Trans",
            "type": "rental",
            "status": "approved",
            "is_active": True,
            "whatsapp": "628111111111",
            "city": "Medan",
            "description": "Sewa kendaraan keluarga & rombongan.",
            "destination_ids": ["dest-toba"],
            "service_tags": [],
            "rental_vehicle_types": ["Hiace 14 Seat"],
            "rental_service_options": ["Antar-Jemput KNO"],
            "rental_pickup_areas": ["Kualanamu"],
            "rental_driver_available": True,
        },
        {
            "_id": "p-home",
            "business_name": "Samosir Villa",
            "type": "homestay",
            "status": "approved",
            "is_active": True,
            "whatsapp": "628222222222",
            "city": "Samosir",
            "description": "Penginapan tepi danau.",
            "destination_ids": ["dest-toba"],
            "service_tags": [],
            "accommodation_subtype": "villa",
            "homestay_room_types": ["Family Room"],
            "homestay_facilities": ["Sarapan"],
        },
        {
            "_id": "p-act",
            "business_name": "Eco Jungle Trek",
            "type": "activity",
            "status": "approved",
            "is_active": True,
            "whatsapp": "628333333333",
            "city": "Bukit Lawang",
            "description": "Trekking orangutan ramah lingkungan.",
            "destination_ids": ["dest-bl"],
            "service_tags": [],
            "activity_categories": ["Jungle Trekking Orangutan"],
        },
    ]
    grouped = group_matchable_partners(partners, [])
    _, recs = build_planner_partner_recommendations(
        output="Hari 1 Danau Toba, Hari 2 Bukit Lawang",
        destinations=destinations,
        partners_by_destination=grouped,
        preferred_ids=["dest-toba", "dest-bl"],
        extra_context="Butuh Hiace dari Kualanamu, family room villa, dan trekking orangutan",
        lang="id",
    )
    by_id = {row["partner_id"]: row for row in recs}
    assert "p-rental" in by_id
    assert "service_tag_match" in by_id["p-rental"]["match_factor_codes"]
    assert "p-home" in by_id
    assert "service_tag_match" in by_id["p-home"]["match_factor_codes"]
    assert "p-act" in by_id
    assert by_id["p-act"]["type"] == "activity"
