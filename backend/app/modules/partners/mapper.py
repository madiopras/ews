"""Explicit Partner/Mitra public, admin, and workspace serializers."""

from datetime import datetime, timedelta, timezone

from app.modules.partners.domain import partner_completeness, premium_active
from app.modules.partners.schemas import (
    PartnerAdminListItem,
    PartnerAdminOut,
    PartnerGalleryOut,
    PartnerMemberOut,
    PartnerOfferingOut,
    PartnerOut,
    PartnerPublicOut,
    PartnerWorkspaceOut,
)
from app.shared.urls import safe_public_media_url


def parse_profile_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def gallery_to_response(items: list[dict]) -> list[PartnerGalleryOut]:
    return [
        PartnerGalleryOut(
            id=item.get("id", ""),
            filename=item.get("filename", "image"),
            content_type=item.get("content_type", "image/jpeg"),
            size=item.get("size", 0),
            uploaded_at=item.get("uploaded_at", ""),
            uploaded_by=item.get("uploaded_by", ""),
            url=f"/api/files/{item.get('storage_path', '')}",
        )
        for item in items
        if item.get("storage_path")
    ]


def offering_to_response(document: dict) -> PartnerOfferingOut:
    return PartnerOfferingOut(
        id=str(document["_id"]),
        partner_id=document["partner_id"],
        kind=document.get("kind", "service"),
        name=document.get("name", ""),
        description=document.get("description", ""),
        ai_tags=document.get("ai_tags", []),
        service_areas=document.get("service_areas", []),
        destination_ids=document.get("destination_ids", []),
        availability_note=document.get("availability_note", ""),
        is_active=document.get("is_active", True),
        created_at=document.get("created_at", ""),
        updated_at=document.get("updated_at", ""),
    )


def partner_to_response(document: dict) -> PartnerOut:
    return PartnerOut(
        id=str(document["_id"]),
        business_name=document["business_name"],
        type=document["type"],
        whatsapp=document["whatsapp"],
        description=document["description"],
        city=document["city"],
        email=document.get("email"),
        address=document.get("address", ""),
        destination_ids=document.get("destination_ids", []),
        service_tags=document.get("service_tags", []),
        image=safe_public_media_url(document.get("image", "")),
        status=document.get("status", "pending"),
        created_at=document.get("created_at", ""),
        updated_at=document.get("updated_at", document.get("created_at", "")),
        is_premium=premium_active(document),
        premium_until=document.get("premium_until"),
        is_active=document.get("is_active", True),
        accepting_contacts=document.get("accepting_contacts", True),
    )


def partner_to_public_response(document: dict) -> PartnerPublicOut:
    accepts = document.get("accepting_contacts", True)
    return PartnerPublicOut(
        id=str(document["_id"]),
        business_name=document.get("business_name", ""),
        type=document.get("type", "guide"),
        whatsapp=document.get("whatsapp") if accepts else None,
        description=document.get("description", ""),
        city=document.get("city", ""),
        destination_ids=document.get("destination_ids", []),
        service_tags=document.get("service_tags", []),
        image=safe_public_media_url(document.get("image", "")),
        is_premium=premium_active(document),
        promotional_disclosure=(
            "unggulan_berbayar" if premium_active(document) else None
        ),
        accepting_contacts=accepts,
    )


def public_type_details(document: dict) -> dict:
    fields = {
        "guide": ["guide_languages", "guide_experience_years"],
        "rental": [
            "rental_vehicle_types",
            "rental_driver_available",
            "rental_fleet_size",
        ],
        "homestay": [
            "homestay_room_count",
            "homestay_facilities",
            "homestay_checkin_info",
        ],
        "culinary": [
            "culinary_categories",
            "culinary_specialties",
            "culinary_service_modes",
            "culinary_dietary_tags",
            "culinary_opening_info",
            "culinary_reservation_note",
        ],
        "souvenir": [
            "souvenir_products",
            "souvenir_delivery_available",
            "souvenir_shop_hours",
        ],
    }.get(document.get("type"), [])
    return {field: document.get(field) for field in fields}


def partner_to_admin_response(
    document: dict, offerings_count: int = 0
) -> PartnerAdminOut:
    public = partner_to_response(document).model_dump()
    completeness, missing = partner_completeness(document, offerings_count)
    reviewed_at = document.get("last_profile_reviewed_at") or document.get("updated_at")
    reviewed_dt = parse_profile_datetime(reviewed_at)
    extra_fields = {
        name: document.get(name, default)
        for name, default in {
            "approval_history": [],
            "owner_user_id": "",
            "revision_note": "",
            "current_step": 1,
            "guide_languages": [],
            "guide_license_number": "",
            "guide_experience_years": 0,
            "rental_vehicle_types": [],
            "rental_driver_available": False,
            "rental_fleet_size": 0,
            "homestay_room_count": 0,
            "homestay_facilities": [],
            "homestay_checkin_info": "",
            "souvenir_products": [],
            "souvenir_delivery_available": False,
            "souvenir_shop_hours": "",
            "culinary_categories": [],
            "culinary_specialties": [],
            "culinary_service_modes": [],
            "culinary_dietary_tags": [],
            "culinary_opening_info": "",
            "culinary_reservation_note": "",
            "contact_status_note": "",
        }.items()
    }
    return PartnerAdminOut(
        **public,
        **extra_fields,
        verification_documents=document.get("verification_documents", []),
        reviewed_by=document.get("reviewed_by"),
        reviewed_at=document.get("reviewed_at"),
        ownership_status=document.get(
            "ownership_status",
            "claimed" if document.get("owner_user_id") else "unclaimed",
        ),
        gallery=gallery_to_response(document.get("gallery", [])),
        submitted_at=document.get("submitted_at"),
        review_due_at=document.get("review_due_at"),
        profile_completeness=completeness,
        completeness_missing=missing,
        last_profile_reviewed_at=reviewed_at,
        freshness_due_at=(
            (reviewed_dt + timedelta(days=90)).isoformat() if reviewed_dt else None
        ),
    )


def partner_to_admin_list_response(document: dict) -> PartnerAdminListItem:
    return PartnerAdminListItem(
        **partner_to_response(document).model_dump(),
        documents_count=len(document.get("verification_documents", [])),
        reviewed_by=document.get("reviewed_by"),
        reviewed_at=document.get("reviewed_at"),
    )


def member_to_response(membership: dict, user: dict) -> PartnerMemberOut:
    return PartnerMemberOut(
        user_id=membership["user_id"],
        name=user.get("name", ""),
        email=user.get("email", ""),
        role=membership.get("role", "staff"),
        status=membership.get("status", "active"),
        created_at=membership.get("created_at", ""),
    )


def workspace_response(
    document: dict,
    membership_role: str,
    members: list[PartnerMemberOut],
    offerings_count: int,
) -> PartnerWorkspaceOut:
    return PartnerWorkspaceOut(
        **partner_to_admin_response(document, offerings_count).model_dump(),
        membership_role=membership_role,
        members=members,
    )
