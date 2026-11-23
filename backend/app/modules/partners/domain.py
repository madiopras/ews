"""Pure partner policies shared by workspace and administration use cases."""

import re
from datetime import datetime, timezone

from app.modules.partners.exceptions import PartnerError
from app.shared.urls import safe_public_http_url

EDITABLE_APPLICATION_STATUSES = {"draft", "needs_revision", "rejected"}
GALLERY_EDITABLE_STATUSES = {*EDITABLE_APPLICATION_STATUSES, "approved"}
ADMIN_TRANSITIONS = {
    "pending": {"approved", "rejected", "needs_revision", "pending"},
    "draft": {"rejected", "needs_revision", "pending"},
    "needs_revision": {"rejected", "needs_revision", "pending"},
    "rejected": {"rejected", "needs_revision", "pending"},
    "approved": {"rejected", "needs_revision", "pending"},
}

LIST_FIELD_LIMITS: tuple[tuple[str, int], ...] = (
    ("guide_languages", 50),
    ("guide_specialties", 80),
    ("rental_vehicle_types", 80),
    ("rental_service_options", 60),
    ("rental_pickup_areas", 80),
    ("homestay_room_types", 80),
    ("homestay_facilities", 80),
    ("souvenir_categories", 80),
    ("souvenir_products", 100),
    ("culinary_categories", 80),
    ("culinary_specialties", 120),
    ("culinary_service_modes", 50),
    ("culinary_dietary_tags", 50),
    ("tour_trip_types", 80),
    ("tour_inclusions", 80),
    ("tour_departure_hubs", 80),
    ("activity_categories", 80),
)

TEXT_DETAIL_FIELDS: tuple[str, ...] = (
    "guide_license_number",
    "homestay_checkin_info",
    "souvenir_packaging_note",
    "souvenir_shop_hours",
    "culinary_opening_info",
    "culinary_reservation_note",
    "tour_license_number",
    "activity_duration_info",
    "activity_safety_note",
)


def premium_active(document: dict, now: datetime | None = None) -> bool:
    until = document.get("premium_until")
    if not until:
        return False
    try:
        return datetime.fromisoformat(until) > (now or datetime.now(timezone.utc))
    except Exception:
        return False


def normalize_whatsapp(value: str) -> str:
    normalized = "".join(character for character in value if character.isdigit())
    if len(normalized) < 8 or len(normalized) > 20:
        raise PartnerError(400, "Invalid whatsapp number")
    return normalized


def normalize_service_tags(values: list[str]) -> list[str]:
    return list(
        dict.fromkeys(tag.strip().lower()[:40] for tag in values if tag.strip())
    )


def normalize_partner_list(values: list[str], max_length: int = 80) -> list[str]:
    return list(
        dict.fromkeys(value.strip()[:max_length] for value in values if value.strip())
    )


def normalize_optional_public_url(value: str, field_label: str) -> str:
    trimmed = (value or "").strip()
    if not trimmed:
        return ""
    validated = safe_public_http_url(trimmed)
    if not validated:
        raise PartnerError(400, f"Invalid {field_label}: must be a public HTTP(S) URL")
    return validated


def normalize_partner_type_fields(payload) -> dict:
    """Normalize shared social links and all 7 partner type detail fields."""
    changes = payload.model_dump(mode="json")
    for field, length in LIST_FIELD_LIMITS:
        changes[field] = normalize_partner_list(getattr(payload, field, []), length)
    for field in TEXT_DETAIL_FIELDS:
        changes[field] = (getattr(payload, field, "") or "").strip()
    changes["instagram_url"] = normalize_optional_public_url(
        getattr(payload, "instagram_url", ""), "Instagram URL"
    )
    changes["google_maps_url"] = normalize_optional_public_url(
        getattr(payload, "google_maps_url", ""), "Google Maps URL"
    )
    return changes


def partner_draft_changes(payload, updated_at: str) -> dict:
    """Normalize an onboarding draft without transport or persistence concerns."""
    changes = normalize_partner_type_fields(payload)
    for field in ("business_name", "description", "city", "address"):
        changes[field] = (getattr(payload, field) or "").strip()
    changes["service_tags"] = normalize_service_tags(payload.service_tags)
    changes["whatsapp"] = (
        normalize_whatsapp(payload.whatsapp) if payload.whatsapp.strip() else ""
    )
    changes["updated_at"] = updated_at
    return changes


def partner_completeness(
    document: dict, offerings_count: int = 0
) -> tuple[int, list[str]]:
    checks = {
        "business_name": len((document.get("business_name") or "").strip()) >= 2,
        "description": len((document.get("description") or "").strip()) >= 80,
        "whatsapp": bool(re.fullmatch(r"\d{8,20}", document.get("whatsapp") or "")),
        "city": len((document.get("city") or "").strip()) >= 2,
        "destination_ids": bool(document.get("destination_ids")),
        "service_tags": len(document.get("service_tags", [])) >= 2,
        "gallery": bool(document.get("gallery")),
        "offerings": offerings_count > 0,
    }
    partner_type = document.get("type")
    if partner_type == "guide":
        checks["guide_languages"] = bool(document.get("guide_languages"))
    elif partner_type == "rental":
        checks["rental_vehicle_types"] = bool(document.get("rental_vehicle_types"))
        checks["rental_service_options"] = bool(
            document.get("rental_service_options")
            or document.get("rental_driver_available")
        )
    elif partner_type == "homestay":
        checks["homestay_room_types"] = bool(
            document.get("homestay_room_types")
            or int(document.get("homestay_room_count") or 0) > 0
        )
        checks["homestay_facilities"] = bool(document.get("homestay_facilities"))
    elif partner_type == "souvenir":
        checks["souvenir_products"] = bool(document.get("souvenir_products"))
    elif partner_type == "culinary":
        checks.update(
            {
                "culinary_specialties": bool(document.get("culinary_specialties")),
                "culinary_service_modes": bool(document.get("culinary_service_modes")),
            }
        )
    elif partner_type == "tour_operator":
        checks.update(
            {
                "tour_trip_types": bool(document.get("tour_trip_types")),
                "tour_inclusions": bool(document.get("tour_inclusions")),
            }
        )
    elif partner_type == "activity":
        checks["activity_categories"] = bool(document.get("activity_categories"))
    missing = [key for key, complete in checks.items() if not complete]
    return round(100 * (len(checks) - len(missing)) / len(checks)), missing


def validate_submission(document: dict) -> None:
    missing = []
    if len(document.get("business_name", "").strip()) < 2:
        missing.append("business_name")
    try:
        normalize_whatsapp(document.get("whatsapp", ""))
    except PartnerError:
        missing.append("whatsapp")
    if len(document.get("description", "").strip()) < 10:
        missing.append("description")
    if len(document.get("city", "").strip()) < 2:
        missing.append("city")
    if not document.get("destination_ids"):
        missing.append("destination_ids")
    if not document.get("verification_documents"):
        missing.append("verification_documents")
    partner_type = document.get("type")
    if partner_type == "guide" and not document.get("guide_languages"):
        missing.append("guide_languages")
    if partner_type == "rental":
        if not document.get("rental_vehicle_types"):
            missing.append("rental_vehicle_types")
        if int(document.get("rental_fleet_size", 0)) < 1:
            missing.append("rental_fleet_size")
    if partner_type == "homestay" and int(document.get("homestay_room_count", 0)) < 1:
        missing.append("homestay_room_count")
    if partner_type == "souvenir" and not document.get("souvenir_products"):
        missing.append("souvenir_products")
    if partner_type == "culinary" and not document.get("culinary_specialties"):
        missing.append("culinary_specialties")
    if partner_type == "tour_operator":
        if not document.get("tour_trip_types"):
            missing.append("tour_trip_types")
        if not document.get("tour_inclusions"):
            missing.append("tour_inclusions")
    if partner_type == "activity" and not document.get("activity_categories"):
        missing.append("activity_categories")
    if missing:
        raise PartnerError(
            400,
            {
                "code": "partner_profile_incomplete",
                "message": "Complete all required partner onboarding fields",
                "fields": missing,
            },
        )


def validate_admin_transition(current: str, target: str, revision_note: str) -> None:
    if target not in ADMIN_TRANSITIONS.get(current, set()):
        raise PartnerError(409, "Invalid partner status transition")
    if target == "approved" and current != "pending":
        raise PartnerError(409, "Only submitted applications can be approved")
    if target == "needs_revision" and len(revision_note.strip()) < 5:
        raise PartnerError(400, "A revision note of at least 5 characters is required")


def validate_member_role(actual: str | None, allowed: tuple[str, ...]) -> None:
    if actual not in allowed:
        raise PartnerError(403, "Partner access denied")
