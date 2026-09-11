"""Explicit serializers for administration read models."""

from datetime import datetime

from app.modules.administration.domain import paged
from app.modules.administration.schemas import AdminUserOut, AdminUserPage


def admin_user(document: dict) -> AdminUserOut:
    return AdminUserOut(
        id=str(document["_id"]),
        email=document.get("email", ""),
        name=document.get("name", ""),
        role=document.get("role", "user"),
        account_active=document.get("account_active", True),
        auth_provider=document.get("auth_provider", "password"),
        created_at=document.get("created_at", ""),
        updated_at=document.get("updated_at", document.get("created_at", "")),
    )


def admin_user_page(
    documents: list[dict], total: int, page: int, page_size: int
) -> AdminUserPage:
    return AdminUserPage(
        items=[admin_user(document) for document in documents],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


def email_template(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "key": document.get("key", ""),
        "name": document.get("name", ""),
        "subject_id": document.get("subject_id", ""),
        "subject_en": document.get("subject_en", ""),
        "body_id": document.get("body_id", ""),
        "body_en": document.get("body_en", ""),
        "enabled": document.get("enabled", True),
        "updated_at": document.get("updated_at", document.get("created_at", "")),
    }


def llm_profile(document: dict) -> dict:
    configured = bool(
        document.get("api_key_ciphertext") and document.get("api_key_nonce")
    )
    return {
        "id": str(document["_id"]),
        "name": document.get("name", ""),
        "base_url": document.get("base_url", ""),
        "model_name": document.get("model_name", ""),
        "enabled": document.get("enabled", True),
        "active": document.get("active", False),
        "api_key_configured": configured,
        "api_key_masked": "••••••••" if configured else "",
        "health_status": document.get("health_status", "untested"),
        "latency_ms": document.get("latency_ms"),
        "last_tested_at": document.get("last_tested_at", ""),
        "last_error": document.get("last_error", ""),
        "created_at": document.get("created_at", ""),
        "updated_at": document.get("updated_at", document.get("created_at", "")),
    }


def notification_rows(channel: str, documents: list[dict]) -> list[dict]:
    return [
        {
            "id": str(document["_id"]),
            "channel": channel,
            "recipient": document.get("recipient") or document.get("user_id", ""),
            "kind": document.get("kind", ""),
            "status": document.get("status", ""),
            "error": document.get("error", ""),
            "created_at": (
                document.get("created_at").isoformat()
                if isinstance(document.get("created_at"), datetime)
                else document.get("created_at", "")
            ),
        }
        for document in documents
    ]


def audit_log(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "admin_id": document.get("admin_id", ""),
        "admin_email": document.get("admin_email", ""),
        "action": document.get("action", ""),
        "entity_type": document.get("entity_type", ""),
        "entity_id": document.get("entity_id", ""),
        "details": document.get("details", {}),
        "created_at": document.get("created_at", ""),
    }


def system_log(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "level": document.get("level", "info"),
        "source": document.get("source", "system"),
        "message": document.get("message", ""),
        "details": document.get("details", {}),
        "created_at": document.get("created_at", ""),
    }


def ai_log(document: dict) -> dict:
    return {
        "id": str(document["_id"]),
        "status": document.get("status", ""),
        "days": document.get("days", 0),
        "budget": document.get("budget"),
        "budget_style": document.get("budget_style"),
        "interests": document.get("interests", []),
        "lang": document.get("lang", "id"),
        "catalog_size": document.get("catalog_size", 0),
        "prompt_catalog_size": document.get(
            "prompt_catalog_size", document.get("catalog_size", 0)
        ),
        "prompt_catalog_chars": document.get("prompt_catalog_chars", 0),
        "partner_count": document.get("partner_count", 0),
        "output_chars": document.get("output_chars", 0),
        "response_payload_bytes": document.get("response_payload_bytes", 0),
        "sse_event_count": document.get("sse_event_count", 0),
        "result_format_requested": document.get("result_format_requested", "legacy"),
        "structured_rollout_reason": document.get("structured_rollout_reason", ""),
        "culinary_rollout_reason": document.get("culinary_rollout_reason", ""),
        "result_format": document.get("result_format", "legacy"),
        "parse_status": document.get("parse_status", "not_requested"),
        "fallback_reason": document.get("fallback_reason", ""),
        "unknown_destination_count": document.get("unknown_destination_count", 0),
        "partner_match_count": document.get("partner_match_count", 0),
        "partner_match_types": document.get("partner_match_types", []),
        "partner_selection_audit": document.get("partner_selection_audit", []),
        "partner_gap_keys": document.get("partner_gap_keys", []),
        "duration_ms": document.get("duration_ms"),
        "error": document.get("error", ""),
        "llm_source": document.get("llm_source", "environment"),
        "llm_profile_id": document.get("llm_profile_id"),
        "llm_profile_name": document.get("llm_profile_name", ""),
        "llm_model": document.get("llm_model", ""),
        "created_at": document.get("created_at", ""),
        "completed_at": document.get("completed_at", ""),
    }


def page_of(
    documents: list[dict],
    total: int,
    page: int,
    page_size: int,
    serializer,
) -> dict:
    return paged(
        [serializer(document) for document in documents], total, page, page_size
    )
