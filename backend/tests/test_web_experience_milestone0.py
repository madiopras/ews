"""End-to-end security contract for Web Experience Milestone 0."""

from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import threading
import uuid

import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
PROVIDER_URL = "http://127.0.0.1:18083"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


class PlannerProvider(BaseHTTPRequestHandler):
    calls = 0
    lock = threading.Lock()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        with self.lock:
            self.__class__.calls += 1
        serialized = json.dumps(payload, ensure_ascii=False)
        content = "" if "force-empty" in serialized else "## Hari 1\n**Danau Toba** — itinerary QA."
        body = json.dumps({"choices": [{"message": {"content": content}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        return


@pytest.fixture(scope="module")
def provider():
    PlannerProvider.calls = 0
    server = ThreadingHTTPServer(("127.0.0.1", 18083), PlannerProvider)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield PlannerProvider
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


@pytest.fixture(scope="module")
def database():
    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    yield database
    client.close()


def register_user(label):
    session = requests.Session()
    email = f"qa-m0-{label}-{uuid.uuid4().hex[:10]}@example.com"
    response = session.post(f"{API}/auth/register", json={
        "email": email,
        "password": "qa-password-123",
        "name": f"QA M0 {label}",
        "accepted_terms": True,
    })
    assert response.status_code == 200, response.text
    return session, email, response.json()["id"]


def planner_payload(destination_id, extra_context="ingin membeli oleh-oleh lokal"):
    return {
        "days": 1,
        "budget": 500000,
        "interests": ["nature"],
        "lang": "id",
        "extra_context": extra_context,
        "preferred_destination_ids": [destination_id],
    }


def test_milestone0_guest_quota_partner_ownership_and_recommendations(database, provider):
    admin = requests.Session()
    login = admin.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert login.status_code == 200, login.text
    owner, owner_email, owner_id = register_user("owner")
    other, other_email, other_id = register_user("other")
    destination = database.destinations.find_one({"name": "Danau Toba", "is_active": {"$ne": False}})
    if not destination:
        destination = database.destinations.find_one({"is_active": {"$ne": False}})
    assert destination
    destination_id = str(destination["_id"])
    suffix = uuid.uuid4().hex[:8]
    partner_id = profile_id = None
    fake_order_id = f"QA-M0-{suffix}"
    usage_before = set(database.planner_usage.distinct("_id"))
    logs_before = set(database.ai_planner_logs.distinct("_id"))
    original_settings = admin.get(f"{API}/admin/settings").json()
    try:
        profile = admin.post(f"{API}/admin/llm-profiles", json={
            "name": f"QA M0 LLM {suffix}",
            "base_url": f"{PROVIDER_URL}/v1",
            "model_name": "qa-m0-model",
            "enabled": True,
        })
        assert profile.status_code == 201, profile.text
        profile_id = profile.json()["id"]
        assert admin.post(f"{API}/admin/llm-profiles/{profile_id}/test").json()["success"] is True
        assert admin.post(f"{API}/admin/llm-profiles/{profile_id}/activate").status_code == 200

        settings = {
            key: value for key, value in original_settings.items()
            if key not in {"updated_at", "updated_by"}
        }
        settings.update({
            "planner_guest_trial_enabled": True,
            "planner_guest_generation_limit": 1,
            "planner_guest_ip_daily_limit": 1000,
            "planner_authenticated_daily_limit": 20,
            "planner_generation_cooldown_seconds": 0,
        })
        assert admin.put(f"{API}/admin/settings", json=settings).status_code == 200

        partner_payload = {
            "business_name": f"QA Oleh-oleh Toba {suffix}",
            "type": "souvenir",
            "whatsapp": "628123456789",
            "description": "Produk oleh-oleh lokal dari masyarakat sekitar Danau Toba.",
            "city": "Samosir",
            "destination_ids": [destination_id],
            "service_tags": ["produk lokal", "keluarga"],
        }
        assert requests.post(f"{API}/partners", json=partner_payload).status_code == 401
        created = owner.post(f"{API}/partners", json=partner_payload)
        assert created.status_code == 200, created.text
        partner_id = created.json()["id"]
        stored = database.partners.find_one({"_id": ObjectId(partner_id)})
        assert stored["owner_user_id"] == owner_id
        approved = admin.patch(f"{API}/partners/{partner_id}/status", json={"status": "approved"})
        assert approved.status_code == 200, approved.text
        public = requests.get(f"{API}/partners", params={"type": "souvenir"}).json()
        assert any(row["id"] == partner_id for row in public)

        # Payment creation/status can only be accessed by the owner or an admin.
        assert requests.post(f"{API}/payments/snap-token", json={
            "partner_id": partner_id, "plan_code": "1m",
        }).status_code == 401
        assert other.post(f"{API}/payments/snap-token", json={
            "partner_id": partner_id, "plan_code": "1m",
        }).status_code == 403
        database.payment_orders.insert_one({
            "order_id": fake_order_id,
            "partner_id": partner_id,
            "status": "pending",
        })
        assert other.get(f"{API}/payments/{fake_order_id}/status").status_code == 403

        guest = requests.Session()
        quota = guest.get(f"{API}/planner/quota")
        assert quota.status_code == 200
        assert quota.json() == {
            "authenticated": False,
            "limit": 1,
            "remaining": 1,
            "login_required": False,
        }
        first = guest.post(f"{API}/trip-planner/stream", json=planner_payload(destination_id))
        assert first.status_code == 200, first.text
        assert partner_id in first.text
        assert '"placement": "organic"' in first.text
        assert "produk lokal" in first.text
        after = guest.get(f"{API}/planner/quota").json()
        assert after["remaining"] == 0 and after["login_required"] is True
        calls_after_first = provider.calls
        second = guest.post(f"{API}/trip-planner/stream", json=planner_payload(destination_id))
        assert second.status_code == 401
        assert second.json()["detail"]["code"] == "guest_trial_used"
        assert provider.calls == calls_after_first

        # An authenticated account has a separate server-side daily quota.
        authenticated = owner.post(f"{API}/trip-planner/stream", json=planner_payload(destination_id))
        assert authenticated.status_code == 200 and "Danau Toba" in authenticated.text

        # Empty provider output is refunded, so the same Guest may retry once.
        retry_guest = requests.Session()
        retry_guest.get(f"{API}/planner/quota")
        failed = retry_guest.post(
            f"{API}/trip-planner/stream",
            json=planner_payload(destination_id, "force-empty"),
        )
        assert failed.status_code == 200 and "empty response" in failed.text
        assert retry_guest.get(f"{API}/planner/quota").json()["remaining"] == 1
        retried = retry_guest.post(f"{API}/trip-planner/stream", json=planner_payload(destination_id))
        assert retried.status_code == 200 and partner_id in retried.text

        # Two simultaneous requests sharing one signed Guest identity cannot both reserve quota.
        concurrent_guest = requests.Session()
        concurrent_guest.get(f"{API}/planner/quota")
        cookie = concurrent_guest.cookies.get("planner_guest")

        def generate_once():
            return requests.post(
                f"{API}/trip-planner/stream",
                json=planner_payload(destination_id),
                cookies={"planner_guest": cookie},
            ).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(lambda _index: generate_once(), range(2)))
        assert statuses == [200, 401]
    finally:
        restore = {
            key: value for key, value in original_settings.items()
            if key not in {"updated_at", "updated_by"}
        }
        admin.put(f"{API}/admin/settings", json=restore)
        admin.post(f"{API}/admin/llm-profiles/use-environment")
        if profile_id:
            admin.delete(f"{API}/admin/llm-profiles/{profile_id}")
        if partner_id:
            admin.delete(f"{API}/partners/{partner_id}")
        database.payment_orders.delete_many({"order_id": fake_order_id})
        database.users.delete_many({"email": {"$in": [owner_email, other_email]}})
        database.email_outbox.delete_many({"recipient": {"$in": [owner_email, other_email]}})
        database.audit_logs.delete_many({"entity_id": {"$in": [value for value in [partner_id, profile_id] if value]}})
        new_usage = [value for value in database.planner_usage.distinct("_id") if value not in usage_before]
        if new_usage:
            database.planner_usage.delete_many({"_id": {"$in": new_usage}})
        new_logs = [value for value in database.ai_planner_logs.distinct("_id") if value not in logs_before]
        if new_logs:
            database.ai_planner_logs.delete_many({"_id": {"$in": new_logs}})
