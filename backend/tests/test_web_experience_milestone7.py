"""Quality and staged-rollout contract for Web Experience Milestone 7."""

import os
import uuid

import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "QA-rollout-m7-123!"
SETTING_KEYS = {
    "site_name", "support_email", "default_language", "maintenance_mode",
    "partner_review_sla_days", "planner_enabled", "planner_guest_trial_enabled",
    "planner_guest_generation_limit", "planner_guest_identity_ttl_days",
    "planner_guest_ip_daily_limit", "planner_authenticated_daily_limit",
    "planner_generation_cooldown_seconds", "mitra_onboarding_enabled",
    "planner_result_cards_enabled", "planner_structured_results_enabled",
    "planner_result_cards_rollout_percentage",
    "planner_structured_rollout_percentage", "planner_culinary_enabled",
    "planner_culinary_rollout_percentage", "planner_partner_matches_enabled",
    "planner_partner_matches_rollout_percentage",
    "mitra_onboarding_rollout_percentage", "mitra_dashboard_enabled",
    "mitra_dashboard_rollout_percentage", "backup_retention_days",
}


def register(session, email):
    response = session.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "name": "QA Rollout User", "accepted_terms": True,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_staged_rollout_is_stable_server_enforced_and_preserves_existing_mitra():
    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    suffix = uuid.uuid4().hex[:10]
    user_email = f"qa-m7-rollout-{suffix}@example.com"
    other_email = f"qa-m7-other-{suffix}@example.com"
    admin, user, other = requests.Session(), requests.Session(), requests.Session()
    partner_id = None
    original = None
    try:
        assert admin.post(f"{API}/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id"),
            "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
        }).status_code == 200
        register(user, user_email)
        register(other, other_email)
        original_response = admin.get(f"{API}/admin/settings")
        assert original_response.status_code == 200
        original = {key: value for key, value in original_response.json().items() if key in SETTING_KEYS}

        disabled = {**original, "mitra_onboarding_enabled": False, "mitra_onboarding_rollout_percentage": 0,
                    "mitra_dashboard_enabled": True, "mitra_dashboard_rollout_percentage": 0}
        assert admin.put(f"{API}/admin/settings", json=disabled).status_code == 200
        guest_flags = requests.get(f"{API}/experience/features")
        assert guest_flags.status_code == 200
        assert set(guest_flags.json()) == {
            "mitra_onboarding", "mitra_dashboard", "planner_result_cards",
            "planner_structured_results", "planner_culinary", "planner_partner_matches",
        }
        assert guest_flags.json()["mitra_onboarding"] == {
            "enabled": False, "rollout_percentage": 0, "reason": "disabled",
        }
        # Global off is an emergency rollback for every role, including Admin.
        assert admin.get(f"{API}/experience/features").json()["mitra_onboarding"] == {
            "enabled": False, "rollout_percentage": 0, "reason": "disabled",
        }
        blocked = user.post(f"{API}/mitra/onboarding", json={"type": "guide"})
        assert blocked.status_code == 403
        assert blocked.json()["detail"]["code"] == "feature_not_available"

        enabled = {**disabled, "mitra_onboarding_enabled": True, "mitra_onboarding_rollout_percentage": 100}
        assert admin.put(f"{API}/admin/settings", json=enabled).status_code == 200
        decision_one = user.get(f"{API}/experience/features").json()
        decision_two = user.get(f"{API}/experience/features").json()
        assert decision_one == decision_two
        assert decision_one["mitra_onboarding"]["enabled"] is True
        started = user.post(f"{API}/mitra/onboarding", json={"type": "guide"})
        assert started.status_code == 201, started.text
        partner_id = started.json()["id"]

        # A 0% dashboard rollout blocks new accounts but retains access for an existing Mitra.
        existing = user.get(f"{API}/experience/features").json()["mitra_dashboard"]
        assert existing == {"enabled": True, "rollout_percentage": 0, "reason": "existing_partner"}
        assert user.get(f"{API}/mitra/partners").status_code == 200
        assert other.get(f"{API}/mitra/partners").status_code == 403
    finally:
        if original:
            admin.put(f"{API}/admin/settings", json=original)
        if partner_id:
            database.partner_memberships.delete_many({"partner_id": partner_id})
            database.partners.delete_many({"_id": ObjectId(partner_id)})
        database.users.delete_many({"email": {"$in": [user_email, other_email]}})
        database.email_outbox.delete_many({"recipient": {"$in": [user_email, other_email]}})
        database.auth_rate_limits.delete_many({"key": {"$regex": suffix}})
        client.close()
