"""Backend tests for iteration 7: Share OG cards + Midtrans premium partners."""
import hashlib
import io
import os
import time

import pytest
import requests
from PIL import Image

from runtime_config import backend_url

BASE_URL = backend_url()
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
MIDTRANS_SERVER_KEY = "SB-Mid-server-kVFpSup6aiZHAiDuK2NMwkeV"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    return requests.Session()


@pytest.fixture(scope="module")
def public_itinerary(admin_session):
    """Create and share an itinerary; return its slug + doc."""
    payload = {
        "title": "TEST_ Danau Toba 3 Hari",
        "days": 3,
        "budget": 1500000,
        "interests": ["nature", "culture"],
        "content": "Day 1: Parapat. Day 2: Samosir. Day 3: Bukit Holbung.",
        "lang": "id",
    }
    r = admin_session.post(f"{API}/itineraries", json=payload)
    assert r.status_code == 200, r.text
    itin = r.json()
    r2 = admin_session.patch(f"{API}/itineraries/{itin['id']}/share", json={"public": True})
    assert r2.status_code == 200, r2.text
    itin = r2.json()
    assert itin["share_slug"], "share_slug must be set after enabling share"
    yield itin
    # cleanup
    admin_session.delete(f"{API}/itineraries/{itin['id']}")


@pytest.fixture(scope="module")
def approved_partner(admin_session):
    r = requests.post(
        f"{API}/partners",
        json={
            "business_name": "TEST_ Kopi Toba",
            "type": "guide",
            "whatsapp": "6281234567890",
            "description": "Kopi enak di tepi danau TEST partner",
            "city": "Parapat",
            "destination_ids": [],
        },
    )
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    r2 = admin_session.patch(f"{API}/partners/{pid}/status", json={"status": "approved"})
    assert r2.status_code == 200
    yield r2.json()
    admin_session.delete(f"{API}/partners/{pid}")


# ---------------- OG Share HTML ----------------
class TestShareOG:
    def test_share_html_ok(self, public_itinerary):
        slug = public_itinerary["share_slug"]
        r = requests.get(f"{API}/share/{slug}")
        assert r.status_code == 200
        html = r.text
        assert 'property="og:title"' in html
        assert public_itinerary["title"] in html
        assert 'property="og:description"' in html
        assert "hari" in html or "days" in html
        assert 'property="og:image"' in html
        assert f"/api/share/{slug}/image.png" in html
        assert 'property="og:url"' in html
        assert f"/trip/{slug}" in html
        assert 'name="twitter:card" content="summary_large_image"' in html

    def test_share_html_404_unknown(self):
        r = requests.get(f"{API}/share/does-not-exist-xyz")
        assert r.status_code == 404

    def test_share_image_1200x630(self, public_itinerary):
        slug = public_itinerary["share_slug"]
        r = requests.get(f"{API}/share/{slug}/image.png")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (1200, 630), f"size was {img.size}"

    def test_share_image_404_unknown(self):
        r = requests.get(f"{API}/share/does-not-exist-xyz/image.png")
        assert r.status_code == 404


# ---------------- Premium Plans CRUD ----------------
class TestPlans:
    def test_public_plans_only_active(self):
        r = requests.get(f"{API}/premium/plans")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for p in data:
            assert p["active"] is True
            assert {"id", "code", "label_id", "label_en", "months", "price", "order"} <= set(p)

    def test_admin_plans_requires_auth(self):
        r = requests.get(f"{API}/admin/premium/plans")
        assert r.status_code in (401, 403)

    def test_admin_plans_crud(self, admin_session):
        # list
        r = admin_session.get(f"{API}/admin/premium/plans")
        assert r.status_code == 200
        existing = r.json()

        # create
        code = f"test{int(time.time())}"
        payload = {
            "code": code,
            "label_id": "TEST_ Paket",
            "label_en": "TEST_ Plan",
            "months": 2,
            "price": 12345,
            "active": True,
            "order": 99,
        }
        r = admin_session.post(f"{API}/admin/premium/plans", json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        pid = created["id"]

        # duplicate code -> 400
        r = admin_session.post(f"{API}/admin/premium/plans", json=payload)
        assert r.status_code == 400

        # update -> price changed
        payload2 = {**payload, "price": 22222, "label_id": "TEST_ Paket UPDATED"}
        r = admin_session.put(f"{API}/admin/premium/plans/{pid}", json=payload2)
        assert r.status_code == 200
        assert r.json()["price"] == 22222

        # bad id -> 400
        r = admin_session.put(f"{API}/admin/premium/plans/notanid", json=payload2)
        assert r.status_code == 400

        # non-existent -> 404
        r = admin_session.put(
            f"{API}/admin/premium/plans/000000000000000000000000", json=payload2
        )
        assert r.status_code == 404

        # delete
        r = admin_session.delete(f"{API}/admin/premium/plans/{pid}")
        assert r.status_code == 200

        # delete bad id -> 400
        r = admin_session.delete(f"{API}/admin/premium/plans/xxx")
        assert r.status_code == 400

        # delete non-existent -> 404
        r = admin_session.delete(f"{API}/admin/premium/plans/000000000000000000000000")
        assert r.status_code == 404


# ---------------- Midtrans payments ----------------
class TestPayments:
    def test_config_public(self):
        r = requests.get(f"{API}/payments/config")
        assert r.status_code == 200
        c = r.json()
        assert c["client_key"].startswith("SB-Mid-client-")
        assert "sandbox.midtrans.com/snap/snap.js" in c["snap_js"]
        assert c["is_production"] is False

    def test_snap_token_success(self, approved_partner):
        r = requests.get(f"{API}/premium/plans")
        plans = r.json()
        plan = next((p for p in plans if p["code"] == "3m"), plans[0])
        r = requests.post(
            f"{API}/payments/snap-token",
            json={"partner_id": approved_partner["id"], "plan_code": plan["code"]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["token"]
        assert data["order_id"].startswith("PRM-")
        assert data["amount"] == plan["price"]
        pytest.snap_order_id = data["order_id"]
        pytest.snap_amount = data["amount"]
        pytest.snap_months = plan["months"]

    def test_snap_token_plan_not_found(self, approved_partner):
        r = requests.post(
            f"{API}/payments/snap-token",
            json={"partner_id": approved_partner["id"], "plan_code": "nope-xyz"},
        )
        assert r.status_code == 404

    def test_snap_token_bad_partner_id(self):
        r = requests.get(f"{API}/premium/plans")
        code = r.json()[0]["code"]
        r = requests.post(
            f"{API}/payments/snap-token",
            json={"partner_id": "not-an-oid", "plan_code": code},
        )
        assert r.status_code == 400

    def test_snap_token_unapproved_partner(self, admin_session):
        # create pending partner
        r = requests.post(
            f"{API}/partners",
            json={
                "business_name": "TEST_ Pending",
                "type": "rental",
                "whatsapp": "6281234500000",
                "description": "Pending partner TEST",
                "city": "Medan",
                "destination_ids": [],
            },
        )
        pid = r.json()["id"]
        plans = requests.get(f"{API}/premium/plans").json()
        r = requests.post(
            f"{API}/payments/snap-token",
            json={"partner_id": pid, "plan_code": plans[0]["code"]},
        )
        assert r.status_code == 400
        admin_session.delete(f"{API}/partners/{pid}")


# ---------------- Webhook ----------------
def _sig(order_id: str, status_code: str, gross_amount: str) -> str:
    raw = f"{order_id}{status_code}{gross_amount}{MIDTRANS_SERVER_KEY}"
    return hashlib.sha512(raw.encode()).hexdigest()


class TestWebhook:
    def test_bad_signature(self):
        oid = getattr(pytest, "snap_order_id", None)
        if not oid:
            pytest.skip("no snap token")
        body = {
            "order_id": oid,
            "status_code": "200",
            "gross_amount": f"{pytest.snap_amount}.00",
            "signature_key": "deadbeef",
            "transaction_status": "settlement",
            "fraud_status": "accept",
        }
        r = requests.post(f"{API}/payments/midtrans/notification", json=body)
        assert r.status_code == 403

    def test_missing_fields(self):
        r = requests.post(
            f"{API}/payments/midtrans/notification", json={"order_id": "xx"}
        )
        assert r.status_code == 400

    def test_pending_does_not_activate(self, approved_partner):
        oid = pytest.snap_order_id
        gross = f"{pytest.snap_amount}.00"
        body = {
            "order_id": oid,
            "status_code": "201",
            "gross_amount": gross,
            "signature_key": _sig(oid, "201", gross),
            "transaction_status": "pending",
        }
        r = requests.post(f"{API}/payments/midtrans/notification", json=body)
        assert r.status_code == 200
        # partner still not premium
        p = requests.get(f"{API}/partners").json()
        me = next((x for x in p if x["id"] == approved_partner["id"]), None)
        # is_premium may be False (premium_until not set)
        assert (me is None) or (not me.get("premium_until"))

    def test_settlement_activates_and_idempotent(self, approved_partner):
        oid = pytest.snap_order_id
        gross = f"{pytest.snap_amount}.00"
        body = {
            "order_id": oid,
            "status_code": "200",
            "gross_amount": gross,
            "signature_key": _sig(oid, "200", gross),
            "transaction_status": "settlement",
            "fraud_status": "accept",
        }
        r = requests.post(f"{API}/payments/midtrans/notification", json=body)
        assert r.status_code == 200

        # verify partner premium activated (avoid /status which pings live Midtrans)
        partners = requests.get(f"{API}/partners").json()
        me = next(x for x in partners if x["id"] == approved_partner["id"])
        assert me["is_premium"] is True
        assert me["premium_until"], "premium_until must be set"
        first_until = me["premium_until"]

        # replay -> idempotent
        r = requests.post(f"{API}/payments/midtrans/notification", json=body)
        assert r.status_code == 200
        partners = requests.get(f"{API}/partners").json()
        me = next(x for x in partners if x["id"] == approved_partner["id"])
        assert me["premium_until"] == first_until, "replay must not extend duration"

    def test_status_unknown_order(self):
        r = requests.get(f"{API}/payments/UNKNOWN-ORDER-XYZ/status")
        assert r.status_code == 404


# ---------------- Sorting ----------------
class TestSorting:
    def test_premium_partner_first(self, approved_partner):
        r = requests.get(f"{API}/partners")
        assert r.status_code == 200
        docs = r.json()
        # find our partner - should be premium and appear before non-premium approved partners
        idx = next((i for i, d in enumerate(docs) if d["id"] == approved_partner["id"]), None)
        assert idx is not None
        me = docs[idx]
        assert me["is_premium"] is True
        assert me["premium_until"]
        # first non-premium index must be after idx
        non_premium_positions = [i for i, d in enumerate(docs) if not d["is_premium"]]
        if non_premium_positions:
            assert idx < non_premium_positions[0], "premium must appear before non-premium"
