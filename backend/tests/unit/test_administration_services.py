"""Unit coverage for Phase 7 policies and administration service boundaries."""

import asyncio

import pytest

from app.modules.administration.domain import (
    feature_decision,
    pagination,
    planner_health_summary,
    redact,
)
from app.modules.administration.exceptions import AdministrationError
from app.modules.administration.schemas import AdminUserUpdate
from app.modules.administration.service import AdminUserService


def test_feature_decision_is_stable_and_global_disable_precedes_admin_override():
    settings = {
        "planner_structured_results_enabled": True,
        "planner_structured_rollout_percentage": 37,
    }
    user = {"id": "stable-user", "role": "user"}
    assert feature_decision("planner_structured_results", settings, user) == (
        feature_decision("planner_structured_results", settings, user)
    )

    disabled = {
        "mitra_onboarding_enabled": False,
        "mitra_onboarding_rollout_percentage": 100,
    }
    assert feature_decision(
        "mitra_onboarding", disabled, {"id": "admin", "role": "admin"}
    ) == {"enabled": False, "rollout_percentage": 100, "reason": "disabled"}


def test_existing_partner_dashboard_access_and_unknown_feature_policy():
    decision = feature_decision(
        "mitra_dashboard",
        {
            "mitra_dashboard_enabled": True,
            "mitra_dashboard_rollout_percentage": 0,
        },
        {"id": "owner", "role": "user"},
        existing_partner=True,
    )
    assert decision == {
        "enabled": True,
        "rollout_percentage": 0,
        "reason": "existing_partner",
    }
    with pytest.raises(AdministrationError) as error:
        feature_decision("unknown", {}, None)
    assert error.value.status_code == 404


def test_pagination_normalizes_legacy_limit_and_skip_contract():
    assert pagination(1, 25, limit=500, skip=401) == (3, 200, 400)
    assert pagination(-1, 0) == (1, 1, 0)


def test_recursive_redaction_removes_secrets_from_message_and_nested_details():
    secret = "very-private-key"
    value = {
        "message": f"provider failed with {secret}",
        "nested": [secret, {"token": f"Bearer {secret}"}],
    }
    result = redact(value, [secret])
    assert secret not in str(result)
    assert result["nested"][1]["token"] == "Bearer [redacted]"


class FakeUserRepository:
    def __init__(self, target, active_admins=2):
        self.target = target
        self.active_admins = active_admins
        self.updated = None

    async def get(self, _identifier):
        return self.target

    async def count_active_admins(self):
        return self.active_admins

    async def update(self, _identifier, changes):
        self.updated = changes
        return {**self.target, **changes}


class FakeAudit:
    def __init__(self):
        self.entries = []

    async def audit(self, *values):
        self.entries.append(values)


def test_user_administration_prevents_self_lockout_and_last_admin_removal():
    target = {
        "_id": "admin-1",
        "email": "admin@example.com",
        "name": "Admin",
        "role": "admin",
        "account_active": True,
    }
    actor = {"id": "admin-1", "email": "admin@example.com"}
    service = AdminUserService(FakeUserRepository(target), FakeAudit())
    with pytest.raises(AdministrationError, match="deactivate"):
        asyncio.run(
            service.update("admin-1", AdminUserUpdate(account_active=False), actor)
        )

    service = AdminUserService(FakeUserRepository(target, active_admins=1), FakeAudit())
    with pytest.raises(AdministrationError, match="active admin"):
        asyncio.run(
            service.update(
                "admin-1",
                AdminUserUpdate(role="user"),
                {"id": "another-admin"},
            )
        )


def test_planner_health_policy_remains_deterministic_and_actionable():
    logs = [
        {
            "result_format_requested": "structured",
            "parse_status": "fallback" if index < 2 else "success",
            "fallback_reason": "schema_validation_failed" if index < 2 else "",
            "status": "error" if index == 0 else "completed",
            "unknown_destination_count": 1 if index == 1 else 0,
            "duration_ms": 130_000 if index == 9 else 1_000,
            "response_payload_bytes": 2_000,
        }
        for index in range(10)
    ]
    result = planner_health_summary(logs)
    assert result["alert"]["active"] is True
    assert result["rollback"]["recommended"] is True
    assert result["performance"]["p95_duration_ms"] == 130_000
