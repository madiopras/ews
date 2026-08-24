"""End-to-end auth continuity contract for Web Experience Milestone 2."""

import os
import re
import uuid

import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"


def token_from_email(row):
    match = re.search(r"[?&]token=([^\s]+)", row["body"])
    assert match, row
    return match.group(1)


def test_auth_recovery_profile_export_and_account_deletion():
    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    email = f"qa-m2-{uuid.uuid4().hex[:10]}@example.com"
    old_password = "QA-password-123"
    new_password = "QA-password-456!"
    outbox_before = set(database.email_outbox.distinct("_id"))
    rates_before = set(database.auth_rate_limits.distinct("_id"))
    session = requests.Session()
    try:
        no_consent = session.post(f"{API}/auth/register", json={
            "email": email,
            "password": old_password,
            "name": "QA M2 User",
            "accepted_terms": False,
        })
        assert no_consent.status_code == 400

        registered = session.post(f"{API}/auth/register", json={
            "email": email,
            "password": old_password,
            "name": "QA M2 User",
            "accepted_terms": True,
        })
        assert registered.status_code == 200, registered.text
        user_id = registered.json()["id"]
        assert registered.json()["email_verified"] is False
        assert registered.json()["preferred_language"] == "id"

        verification_mail = database.email_outbox.find_one({
            "recipient": email,
            "kind": "email_verification",
        }, sort=[("created_at", -1)])
        assert verification_mail and verification_mail["status"] in {"configuration_required", "sent"}
        verification = session.post(f"{API}/auth/verify-email", json={
            "token": token_from_email(verification_mail),
        })
        assert verification.status_code == 200, verification.text
        assert session.get(f"{API}/auth/me").json()["email_verified"] is True

        profile = session.put(f"{API}/profile", json={
            "name": "QA M2 Updated",
            "preferred_language": "en",
            "interests": ["nature", "culture", "nature"],
            "home_city": "Medan",
        })
        assert profile.status_code == 200, profile.text
        assert profile.json()["name"] == "QA M2 Updated"
        assert profile.json()["interests"] == ["nature", "culture"]
        assert profile.json()["home_city"] == "Medan"

        exported = session.get(f"{API}/account/export")
        assert exported.status_code == 200
        assert "attachment" in exported.headers["Content-Disposition"]
        assert exported.json()["account"]["email"] == email
        assert "password_hash" not in exported.json()["account"]

        unknown = requests.post(f"{API}/auth/forgot-password", json={
            "email": f"missing-{uuid.uuid4().hex[:8]}@example.com",
        })
        assert unknown.status_code == 200
        assert unknown.json()["message"] == "If the account exists, reset instructions have been sent."

        forgot = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert forgot.status_code == 200, forgot.text
        reset_mail = database.email_outbox.find_one({
            "recipient": email,
            "kind": "password_reset",
        }, sort=[("created_at", -1)])
        reset = requests.post(f"{API}/auth/reset-password", json={
            "token": token_from_email(reset_mail),
            "password": new_password,
        })
        assert reset.status_code == 200, reset.text
        assert session.get(f"{API}/auth/me").status_code == 401
        assert session.post(f"{API}/auth/login", json={"email": email, "password": old_password}).status_code == 401
        assert session.post(f"{API}/auth/login", json={"email": email, "password": new_password}).status_code == 200

        wrong_delete = session.delete(f"{API}/account", json={
            "confirmation": "DELETE",
            "password": old_password,
        })
        assert wrong_delete.status_code == 401
        deleted = session.delete(f"{API}/account", json={
            "confirmation": "DELETE",
            "password": new_password,
        })
        assert deleted.status_code == 200, deleted.text
        assert database.users.find_one({"email": email}) is None
        assert session.get(f"{API}/auth/me").status_code == 401
    finally:
        database.users.delete_many({"email": email})
        new_outbox = [row_id for row_id in database.email_outbox.distinct("_id") if row_id not in outbox_before]
        new_rates = [row_id for row_id in database.auth_rate_limits.distinct("_id") if row_id not in rates_before]
        if new_outbox:
            database.email_outbox.delete_many({"_id": {"$in": new_outbox}})
        if new_rates:
            database.auth_rate_limits.delete_many({"_id": {"$in": new_rates}})
        client.close()
