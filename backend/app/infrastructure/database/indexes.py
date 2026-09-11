"""Idempotent MongoDB index registry."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class IndexDefinition:
    collection: str
    keys: Any
    options: dict[str, Any] = field(default_factory=dict)


INDEX_DEFINITIONS = (
    IndexDefinition("users", "email", {"unique": True}),
    IndexDefinition("users", "google_id", {"sparse": True}),
    IndexDefinition("users", "name"),
    IndexDefinition("users", [("role", 1), ("account_active", 1)]),
    IndexDefinition("users", "created_at"),
    IndexDefinition("users", "updated_at"),
    IndexDefinition("auth_rate_limits", "expires_at", {"expireAfterSeconds": 0}),
    IndexDefinition("email_outbox", "expires_at", {"expireAfterSeconds": 0}),
    IndexDefinition(
        "email_outbox", [("recipient", 1), ("kind", 1), ("created_at", -1)]
    ),
    IndexDefinition("audit_logs", "created_at"),
    IndexDefinition("audit_logs", [("entity_type", 1), ("action", 1)]),
    IndexDefinition("ai_planner_logs", "created_at"),
    IndexDefinition("ai_planner_logs", "status"),
    IndexDefinition("planner_usage", "expires_at", {"expireAfterSeconds": 0}),
    IndexDefinition("system_logs", "created_at"),
    IndexDefinition("system_logs", [("level", 1), ("source", 1)]),
    IndexDefinition("backup_jobs", "created_at"),
    IndexDefinition("backup_jobs", "status"),
    IndexDefinition("email_templates", "key", {"unique": True}),
    IndexDefinition("email_templates", "enabled"),
    IndexDefinition("llm_profiles", "name_normalized", {"unique": True}),
    IndexDefinition(
        "llm_profiles",
        "active",
        {"unique": True, "partialFilterExpression": {"active": True}},
    ),
    IndexDefinition("llm_profiles", "updated_at"),
    IndexDefinition("destinations", "name"),
    IndexDefinition("destinations", "location"),
    IndexDefinition("destinations", "category"),
    IndexDefinition("destinations", "is_active"),
    IndexDefinition("destinations", "featured"),
    IndexDefinition("destinations", "price"),
    IndexDefinition("destinations", "created_at"),
    IndexDefinition("destinations", "updated_at"),
    IndexDefinition("itineraries", [("user_id", 1), ("updated_at", -1)]),
    IndexDefinition("itineraries", "share_slug", {"sparse": True}),
    IndexDefinition("reviews", [("destination_id", 1), ("created_at", -1)]),
    IndexDefinition("reviews", "user_id"),
    IndexDefinition("partners", "business_name"),
    IndexDefinition("partners", "city"),
    IndexDefinition("partners", "type"),
    IndexDefinition("partners", "status"),
    IndexDefinition("partners", "is_active"),
    IndexDefinition("partners", "premium_until"),
    IndexDefinition("partners", "destination_ids"),
    IndexDefinition("partners", "created_at"),
    IndexDefinition("partners", "updated_at"),
    IndexDefinition(
        "partner_memberships", [("partner_id", 1), ("user_id", 1)], {"unique": True}
    ),
    IndexDefinition("partner_memberships", [("user_id", 1), ("status", 1)]),
    IndexDefinition(
        "partner_memberships", [("partner_id", 1), ("role", 1), ("status", 1)]
    ),
    IndexDefinition(
        "partner_offerings",
        [("partner_id", 1), ("is_active", 1), ("updated_at", -1)],
    ),
    IndexDefinition("partner_offerings", "destination_ids"),
    IndexDefinition("partner_offerings", "ai_tags"),
    IndexDefinition("partner_analytics", "event_id", {"unique": True}),
    IndexDefinition(
        "partner_analytics", [("partner_id", 1), ("event_type", 1), ("created_at", -1)]
    ),
    IndexDefinition(
        "partner_analytics", "created_at", {"expireAfterSeconds": 31536000}
    ),
    IndexDefinition("planner_analytics", "event_id", {"unique": True}),
    IndexDefinition("planner_analytics", [("event_type", 1), ("created_at", -1)]),
    IndexDefinition("planner_analytics", "expires_at", {"expireAfterSeconds": 0}),
    IndexDefinition("content_reports", [("status", 1), ("created_at", -1)]),
    IndexDefinition("content_reports", [("target_type", 1), ("target_id", 1)]),
    IndexDefinition("in_app_notifications", [("user_id", 1), ("created_at", -1)]),
    IndexDefinition("in_app_notifications", "read_at"),
    IndexDefinition("sms_outbox", [("status", 1), ("created_at", -1)]),
    IndexDefinition("payment_orders", "order_id", {"unique": True}),
    IndexDefinition("payment_orders", [("partner_id", 1), ("created_at", -1)]),
    IndexDefinition("premium_plans", "code", {"unique": True}),
    IndexDefinition("premium_plans", "active"),
    IndexDefinition("premium_plans", "order"),
    IndexDefinition("premium_plans", "price"),
)


async def ensure_indexes(database: Any) -> None:
    """Create all registered indexes; MongoDB treats repeated calls idempotently."""

    for definition in INDEX_DEFINITIONS:
        collection = database[definition.collection]
        await collection.create_index(definition.keys, **definition.options)
