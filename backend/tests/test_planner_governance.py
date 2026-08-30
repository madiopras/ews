import sys
from pathlib import Path

from bson import ObjectId
from pydantic import ValidationError
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server


def test_recommendation_exposes_auditable_relevance_without_premium_ranking_boost():
    destination_id = str(ObjectId())
    destination = {"_id": ObjectId(destination_id), "name": "Danau Toba", "name_en": "Lake Toba"}
    common = {
        "business_name": "Pemandu Toba", "type": "guide", "whatsapp": "628123456789",
        "city": "Samosir", "description": "Pemandu lokal", "image": "", "service_tags": ["keluarga"],
        "status": "approved", "is_active": True, "accepting_contacts": True,
    }
    candidates = [
        {**common, "id": "regular-partner", "is_premium": False},
        {**common, "id": "featured-partner", "is_premium": True},
    ]

    _, recommendations = server.build_planner_partner_recommendations(
        "Danau Toba", [destination], {destination_id: candidates}, [], "butuh pemandu keluarga", "id",
    )

    assert len(recommendations) == 2
    assert {row["relevance_score"] for row in recommendations} == {80}
    assert all(row["relevance_score"] >= server.PLANNER_PARTNER_RELEVANCE_THRESHOLD for row in recommendations)
    assert all(set(row["match_factor_codes"]) == {"destination_coverage", "requested_service_type", "service_tag_match"} for row in recommendations)
    assert len([row for row in recommendations if row["placement"] == "featured"]) == 1


def test_partner_analytics_contract_forbids_story_and_accepts_audit_fields():
    event = server.PartnerAnalyticsEventIn(
        event_id="event1234567890123456",
        event_type="profile_click",
        partner_id=str(ObjectId()),
        source="planner",
        destination_id=str(ObjectId()),
        anonymous_session_id="session12345678901234",
        placement="organic",
        relevance_score=70,
        match_factor_codes=["destination_coverage"],
    )
    assert event.event_type == "profile_click"
    with pytest.raises(ValidationError):
        server.PartnerAnalyticsEventIn(**{
            **event.model_dump(),
            "extra_context": "cerita perjalanan pribadi",
        })


def test_health_monitoring_raises_alert_only_after_minimum_sample():
    logs = [
        {
            "result_format_requested": "structured",
            "parse_status": "fallback" if index < 2 else "success",
            "fallback_reason": "schema_validation_failed" if index < 2 else "",
            "status": "error" if index == 0 else "completed",
            "unknown_destination_count": 1 if index == 1 else 0,
            "duration_ms": 130_000 if index == 9 else 1_000 + index,
            "response_payload_bytes": 2_000 + index,
        }
        for index in range(10)
    ]
    health = server.planner_health_summary(logs)
    assert health["structured_requests"] == 10
    assert health["invalid_rate"] == 20.0
    assert health["alert"]["active"] is True
    assert health["fallback_reasons"] == {"schema_validation_failed": 2}
    assert health["generation_error_rate"] == 10.0
    assert health["unknown_destination_rate"] == 10.0
    assert health["performance"]["p50_duration_ms"] > 0
    assert health["performance"]["p95_duration_ms"] == 130_000
    assert health["performance"]["average_payload_bytes"] > 0
    assert health["rollback"]["recommended"] is True
    assert set(health["rollback"]["reasons"]) == {
        "parse_success_below_90_percent",
        "generation_error_rate_at_or_above_10_percent",
        "unknown_destination_rate_at_or_above_10_percent",
        "p95_generation_duration_above_120_seconds",
    }
    assert server.planner_health_summary(logs[:5])["alert"]["active"] is False


def test_fairness_summary_audits_segments_equal_scores_images_and_gaps():
    first_id, second_id = str(ObjectId()), str(ObjectId())
    partners = [
        {"_id": ObjectId(first_id), "image": "/photo.webp", "gallery": []},
        {"_id": ObjectId(second_id), "image": "", "gallery": []},
    ]
    exposure = [
        {"partner_id": first_id, "business_name": "A", "type": "guide", "tier": "regular", "directory_impression": 0, "ai_impression": 4, "profile_click": 1, "profile_view": 1, "whatsapp_click": 1},
        {"partner_id": second_id, "business_name": "B", "type": "guide", "tier": "regular", "directory_impression": 0, "ai_impression": 2, "profile_click": 0, "profile_view": 0, "whatsapp_click": 0},
    ]
    analytics = [
        {"event_type": "ai_impression", "partner_id": first_id if index < 4 else second_id, "partner_type": "guide", "tier": "regular", "relevance_score": 70}
        for index in range(6)
    ]
    logs = [{"status": "completed", "partner_gap_keys": ["Toba|homestay", "Toba|homestay", "Samosir|rental"]}]

    fairness = server.governance_fairness_summary(analytics, exposure, partners, logs)
    assert fairness["by_type_tier"][0]["ai_impressions"] == 6
    assert fairness["equal_score_concentration"][0]["flagged"] is True
    assert fairness["image_exposure"]["with_image_ai_impressions"] == 4
    assert fairness["image_exposure"]["without_image_ai_impressions"] == 2
    assert fairness["empty_results_by_area_type"][0] == {"area": "Toba", "type": "homestay", "empty_results": 2}
    assert fairness["ranking_policy"]["sensitive_attributes_used"] is False
    assert fairness["ranking_policy"]["premium_is_ranking_signal"] is False
