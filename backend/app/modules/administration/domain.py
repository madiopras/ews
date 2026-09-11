"""Pure policies for pagination, rollout, governance, and log redaction."""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from app.modules.administration.exceptions import AdministrationError
from app.shared.urls import safe_public_http_url

EXPERIENCE_FEATURE_CONFIG = {
    "mitra_onboarding": (
        "mitra_onboarding_enabled",
        "mitra_onboarding_rollout_percentage",
        True,
        100,
    ),
    "mitra_dashboard": (
        "mitra_dashboard_enabled",
        "mitra_dashboard_rollout_percentage",
        True,
        100,
    ),
    "planner_result_cards": (
        "planner_result_cards_enabled",
        "planner_result_cards_rollout_percentage",
        False,
        0,
    ),
    "planner_structured_results": (
        "planner_structured_results_enabled",
        "planner_structured_rollout_percentage",
        False,
        0,
    ),
    "planner_culinary": (
        "planner_culinary_enabled",
        "planner_culinary_rollout_percentage",
        False,
        0,
    ),
    "planner_partner_matches": (
        "planner_partner_matches_enabled",
        "planner_partner_matches_rollout_percentage",
        False,
        0,
    ),
}

PLANNER_PARTNER_RELEVANCE_THRESHOLD = 45
PLANNER_PARTNER_RANKING_SIGNALS = (
    "destination_coverage",
    "requested_service_type",
    "service_tag_match",
    "multi_destination_coverage",
)


def pagination(
    page: int,
    page_size: int,
    *,
    limit: int | None = None,
    skip: int | None = None,
    maximum: int = 200,
) -> tuple[int, int, int]:
    size = max(1, min(limit or page_size, maximum))
    normalized_page = max(1, (max(0, skip) // size + 1) if skip is not None else page)
    return normalized_page, size, (normalized_page - 1) * size


def paged(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


def date_range(date_from: str | None, date_to: str | None) -> dict | None:
    if not date_from and not date_to:
        return None
    result = {}
    if date_from:
        result["$gte"] = date_from
    if date_to:
        result["$lte"] = (
            f"{date_to}T23:59:59.999999+00:00" if len(date_to) == 10 else date_to
        )
    return result


def feature_decision(
    feature: str,
    stored_settings: dict,
    user: dict | None,
    *,
    existing_partner: bool = False,
) -> dict:
    config = EXPERIENCE_FEATURE_CONFIG.get(feature)
    if config is None:
        raise AdministrationError(404, "Unknown experience feature")
    enabled_key, percentage_key, default_enabled, default_percentage = config
    globally_enabled = bool(stored_settings.get(enabled_key, default_enabled))
    percentage = max(
        0, min(100, int(stored_settings.get(percentage_key, default_percentage)))
    )
    if feature == "mitra_dashboard" and user and existing_partner:
        return {
            "enabled": globally_enabled,
            "rollout_percentage": percentage,
            "reason": "existing_partner",
        }
    if not globally_enabled:
        return {
            "enabled": False,
            "rollout_percentage": percentage,
            "reason": "disabled",
        }
    if user and user.get("role") == "admin":
        return {
            "enabled": True,
            "rollout_percentage": percentage,
            "reason": "admin_override",
        }
    if percentage >= 100:
        return {"enabled": True, "rollout_percentage": 100, "reason": "full_rollout"}
    if percentage <= 0 or not user:
        return {
            "enabled": False,
            "rollout_percentage": percentage,
            "reason": "outside_rollout",
        }
    digest = hashlib.sha256(f"ews-rollout-v1:{feature}:{user['id']}".encode()).digest()
    bucket = int.from_bytes(digest[:4], "big") % 100
    return {
        "enabled": bucket < percentage,
        "rollout_percentage": percentage,
        "reason": "in_rollout" if bucket < percentage else "outside_rollout",
    }


def redact(value: Any, secrets: list[str]) -> Any:
    if isinstance(value, str):
        for secret in secrets:
            if len(secret) >= 4:
                value = value.replace(secret, "[redacted]")
        return value
    if isinstance(value, dict):
        return {key: redact(item, secrets) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item, secrets) for item in value]
    return value


def destination_quality(document: dict) -> tuple[int, list[str], bool]:
    checks = {
        "name": len((document.get("name") or "").strip()) >= 2,
        "name_en": len((document.get("name_en") or "").strip()) >= 2,
        "description": len((document.get("description") or "").strip()) >= 100,
        "description_en": len((document.get("description_en") or "").strip()) >= 100,
        "tags": len(document.get("tags", [])) >= 2,
        "images": bool(document.get("images")),
        "source": bool(
            (document.get("source_label") or "").strip()
            and safe_public_http_url(document.get("source_url", ""))
        ),
        "editorial_review": bool(document.get("editorial_reviewed_at")),
    }
    missing = [key for key, complete in checks.items() if not complete]
    reviewed = parse_datetime(document.get("editorial_reviewed_at"))
    stale = reviewed is None or reviewed < datetime.now(timezone.utc) - timedelta(
        days=180
    )
    return round(100 * (len(checks) - len(missing)) / len(checks)), missing, stale


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def governance_item(
    entity_type: str,
    document: dict,
    completeness: int,
    missing: list[str],
    stale: bool,
) -> dict:
    entity_id = str(document["_id"])
    public_path = (
        f"/destination/{entity_id}"
        if entity_type == "destination"
        else f"/partners/{entity_id}"
    )
    return {
        "entity_type": entity_type,
        "id": entity_id,
        "name": (
            document.get("name")
            if entity_type == "destination"
            else document.get("business_name", "")
        ),
        "status": (
            document.get(
                "editorial_status",
                "published" if document.get("is_active", True) else "draft",
            )
            if entity_type == "destination"
            else document.get("status", "")
        ),
        "completeness": completeness,
        "missing": missing,
        "stale": stale,
        "updated_at": document.get("updated_at", document.get("created_at", "")),
        "source_label": (
            document.get("source_label", "") if entity_type == "destination" else ""
        ),
        "source_url": (
            safe_public_http_url(document.get("source_url", ""))
            if entity_type == "destination"
            else ""
        ),
        "public_urls": {"id": f"{public_path}?lang=id", "en": f"{public_path}?lang=en"},
        "preview_urls": {
            "id": f"{public_path}?lang=id&preview=admin",
            "en": f"{public_path}?lang=en&preview=admin",
        },
    }


def role_preview(role: str) -> dict:
    previews = {
        "guest": {
            "routes": ["/", "/explore", "/planner", "/partners"],
            "capabilities": ["discover", "one_guest_plan", "public_partner_contact"],
            "restrictions": ["no_saved_workspace", "no_private_data"],
        },
        "user": {
            "routes": ["/", "/explore", "/planner", "/wishlist", "/profile"],
            "capabilities": ["discover", "planner", "saved_workspace", "reviews"],
            "restrictions": ["no_admin", "no_other_user_data"],
        },
        "partner": {
            "routes": ["/mitra", "/mitra/onboarding", "/mitra/business/:id"],
            "capabilities": [
                "own_profile",
                "offerings",
                "own_insights",
                "owner_only_checkout",
            ],
            "restrictions": ["membership_scoped", "no_admin", "staff_no_checkout"],
        },
        "admin": {
            "routes": [
                "/admin/dashboard",
                "/admin/governance",
                "/admin/destinations",
                "/admin/partners",
            ],
            "capabilities": [
                "content_governance",
                "moderation",
                "audit",
                "configuration",
            ],
            "restrictions": ["preview_is_read_only", "audited_mutations"],
        },
    }
    return {
        "role": role,
        "read_only": True,
        "session_unchanged": True,
        **previews[role],
    }


def planner_health_summary(
    logs: list[dict], *, alert_threshold: float = 10.0, minimum_samples: int = 10
) -> dict:
    structured = [
        row for row in logs if row.get("result_format_requested") == "structured"
    ]
    successful = [
        row
        for row in structured
        if str(row.get("parse_status", "")).startswith("success")
    ]
    fallbacks = [row for row in structured if row.get("parse_status") == "fallback"]
    parse_attempts = len(successful) + len(fallbacks)
    invalid_rate = (
        round(100 * len(fallbacks) / parse_attempts, 2) if parse_attempts else 0.0
    )
    parse_success_rate = (
        round(100 * len(successful) / parse_attempts, 2) if parse_attempts else 0.0
    )
    generation_errors = len([row for row in structured if row.get("status") == "error"])
    generation_error_rate = (
        round(100 * generation_errors / len(structured), 2) if structured else 0.0
    )
    unknown_destination_requests = len(
        [row for row in structured if (row.get("unknown_destination_count") or 0) > 0]
    )
    unknown_destination_rate = (
        round(100 * unknown_destination_requests / len(structured), 2)
        if structured
        else 0.0
    )

    def percentile(values: list[int], percentage: int) -> int:
        ordered = sorted(
            int(value)
            for value in values
            if isinstance(value, (int, float)) and value >= 0
        )
        if not ordered:
            return 0
        index = round((percentage / 100) * (len(ordered) - 1))
        return ordered[index]

    durations = [row.get("duration_ms") for row in structured]
    payload_sizes = [row.get("response_payload_bytes") for row in structured]
    p95_duration_ms = percentile(durations, 95)
    p95_payload_bytes = percentile(payload_sizes, 95)
    rollback_reasons = []
    if parse_attempts >= minimum_samples and parse_success_rate < 90:
        rollback_reasons.append("parse_success_below_90_percent")
    if len(structured) >= minimum_samples and generation_error_rate >= 10:
        rollback_reasons.append("generation_error_rate_at_or_above_10_percent")
    if len(structured) >= minimum_samples and unknown_destination_rate >= 10:
        rollback_reasons.append("unknown_destination_rate_at_or_above_10_percent")
    if (
        len([value for value in durations if isinstance(value, (int, float))])
        >= minimum_samples
        and p95_duration_ms > 120000
    ):
        rollback_reasons.append("p95_generation_duration_above_120_seconds")
    fallback_reasons: dict = {}
    for row in fallbacks:
        reason = row.get("fallback_reason") or "unknown"
        fallback_reasons[reason] = fallback_reasons.get(reason, 0) + 1
    return {
        "structured_requests": len(structured),
        "structured_parse_attempts": parse_attempts,
        "structured_success": len(successful),
        "parse_success_rate": parse_success_rate,
        "fallbacks": len(fallbacks),
        "invalid_rate": invalid_rate,
        "generation_errors": generation_errors,
        "generation_error_rate": generation_error_rate,
        "unknown_destination_rate": unknown_destination_rate,
        "performance": {
            "p50_duration_ms": percentile(durations, 50),
            "p95_duration_ms": p95_duration_ms,
            "average_payload_bytes": round(
                sum(value for value in payload_sizes if isinstance(value, (int, float)))
                / max(
                    1,
                    len(
                        [
                            value
                            for value in payload_sizes
                            if isinstance(value, (int, float))
                        ]
                    ),
                )
            ),
            "p95_payload_bytes": p95_payload_bytes,
        },
        "fallback_reasons": fallback_reasons,
        "alert": {
            "active": parse_attempts >= minimum_samples
            and invalid_rate >= alert_threshold,
            "threshold_percentage": alert_threshold,
            "minimum_samples": minimum_samples,
        },
        "rollback": {
            "recommended": bool(rollback_reasons),
            "reasons": rollback_reasons,
            "action": "disable_planner_structured_results_enabled",
        },
    }


def governance_fairness_summary(
    analytics: list[dict],
    exposure_rows: list[dict],
    partner_catalog: list[dict],
    planner_logs: list[dict],
) -> dict:
    segment_map: dict = {}
    for row in exposure_rows:
        key = (row.get("type") or "unknown", row.get("tier") or "regular")
        segment = segment_map.setdefault(
            key,
            {
                "type": key[0],
                "tier": key[1],
                "partners_exposed": 0,
                "impressions": 0,
                "ai_impressions": 0,
                "contacts": 0,
            },
        )
        segment["partners_exposed"] += 1
        segment["impressions"] += row.get("directory_impression", 0) + row.get(
            "ai_impression", 0
        )
        segment["ai_impressions"] += row.get("ai_impression", 0)
        segment["contacts"] += row.get("whatsapp_click", 0)
    segments = []
    for segment in segment_map.values():
        segment["contact_rate"] = (
            round(100 * segment["contacts"] / segment["impressions"], 2)
            if segment["impressions"]
            else 0
        )
        segments.append(segment)
    segments.sort(key=lambda row: (row["type"], row["tier"]))

    exposure_by_id = {row["partner_id"]: row for row in exposure_rows}
    image_catalog = {
        "with_image": len(
            [row for row in partner_catalog if row.get("image") or row.get("gallery")]
        ),
        "without_image": len(
            [
                row
                for row in partner_catalog
                if not row.get("image") and not row.get("gallery")
            ]
        ),
        "with_image_exposed": 0,
        "without_image_exposed": 0,
        "with_image_ai_impressions": 0,
        "without_image_ai_impressions": 0,
    }
    for partner in partner_catalog:
        exposure = exposure_by_id.get(str(partner.get("_id")))
        if not exposure or exposure.get("ai_impression", 0) <= 0:
            continue
        prefix = (
            "with_image"
            if partner.get("image") or partner.get("gallery")
            else "without_image"
        )
        image_catalog[f"{prefix}_exposed"] += 1
        image_catalog[f"{prefix}_ai_impressions"] += exposure["ai_impression"]

    equal_score_groups: dict = {}
    for event in analytics:
        if event.get("event_type") != "ai_impression" or not isinstance(
            event.get("relevance_score"), int
        ):
            continue
        key = (
            event.get("partner_type")
            or exposure_by_id.get(event.get("partner_id"), {}).get("type")
            or "unknown",
            event.get("tier")
            or exposure_by_id.get(event.get("partner_id"), {}).get("tier")
            or "regular",
            event["relevance_score"],
        )
        group = equal_score_groups.setdefault(key, {})
        partner_id = event.get("partner_id", "")
        group[partner_id] = group.get(partner_id, 0) + 1
    equal_score_concentration = []
    for (partner_type, tier, score), counts in equal_score_groups.items():
        total = sum(counts.values())
        top_partner_id, top_count = max(counts.items(), key=lambda item: item[1])
        share = round(100 * top_count / total, 2) if total else 0
        equal_score_concentration.append(
            {
                "type": partner_type,
                "tier": tier,
                "relevance_score": score,
                "impressions": total,
                "top_partner_id": top_partner_id,
                "top_business_name": exposure_by_id.get(top_partner_id, {}).get(
                    "business_name", "Deleted partner"
                ),
                "top_share_percentage": share,
                "flagged": total >= 5 and share >= 50,
            }
        )
    equal_score_concentration.sort(
        key=lambda row: (
            not row["flagged"],
            -row["top_share_percentage"],
            -row["impressions"],
        )
    )

    overexposed = []
    for segment_key in {(row.get("type"), row.get("tier")) for row in exposure_rows}:
        group = [
            row
            for row in exposure_rows
            if (row.get("type"), row.get("tier")) == segment_key
        ]
        counts = sorted(row.get("ai_impression", 0) for row in group)
        if not counts:
            continue
        middle = len(counts) // 2
        median = (
            counts[middle]
            if len(counts) % 2
            else (counts[middle - 1] + counts[middle]) / 2
        )
        for row in group:
            if row.get("ai_impression", 0) >= 5 and row.get("ai_impression", 0) > max(
                1, median * 2
            ):
                overexposed.append(
                    {
                        "partner_id": row["partner_id"],
                        "business_name": row["business_name"],
                        "type": row.get("type", ""),
                        "tier": row.get("tier", "regular"),
                        "ai_impressions": row.get("ai_impression", 0),
                        "segment_median": median,
                    }
                )

    gap_counts: dict = {}
    for log in planner_logs:
        if log.get("status") != "completed":
            continue
        for key in log.get("partner_gap_keys") or []:
            if not isinstance(key, str) or "|" not in key:
                continue
            area, partner_type = key.rsplit("|", 1)
            if partner_type not in {
                "guide",
                "rental",
                "homestay",
                "culinary",
                "souvenir",
            }:
                continue
            gap_counts[(area[:120], partner_type)] = (
                gap_counts.get((area[:120], partner_type), 0) + 1
            )
    gaps = [
        {"area": area, "type": partner_type, "empty_results": count}
        for (area, partner_type), count in gap_counts.items()
    ]
    gaps.sort(key=lambda row: (-row["empty_results"], row["area"], row["type"]))

    return {
        "by_type_tier": segments,
        "equal_score_concentration": equal_score_concentration[:100],
        "overexposed_partners": sorted(
            overexposed, key=lambda row: -row["ai_impressions"]
        )[:100],
        "image_exposure": image_catalog,
        "empty_results_by_area_type": gaps[:100],
        "ranking_policy": {
            "relevance_threshold": PLANNER_PARTNER_RELEVANCE_THRESHOLD,
            "signals": list(PLANNER_PARTNER_RANKING_SIGNALS),
            "sensitive_attributes_used": False,
            "premium_is_ranking_signal": False,
            "featured_cap_per_type": 1,
        },
    }
