"""
Iteration 3 backend tests: Partners CRUD/approval, Trending destinations,
Saved Itineraries CRUD.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin@wisatasumut.id"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    email = f"TEST_it3user_{uuid.uuid4().hex[:8]}@test.id"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "user1234", "name": "Iter3 User", "accepted_terms": True})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def dest_ids():
    r = requests.get(f"{BASE_URL}/api/destinations")
    assert r.status_code == 200
    items = r.json()
    assert items
    toba = next((d["id"] for d in items if d["name"] == "Danau Toba"), items[0]["id"])
    other = next((d["id"] for d in items if d["id"] != toba), items[0]["id"])
    return {"toba": toba, "other": other, "all": [d["id"] for d in items]}


# ---------------- Partners ----------------
class TestPartners:
    def test_register_partner_public(self):
        payload = {
            "business_name": "TEST_Guide Toba",
            "type": "guide",
            "whatsapp": "+62 812-3456-7890",
            "description": "Pemandu berpengalaman di Danau Toba dan sekitarnya.",
            "city": "Parapat",
            "destination_ids": [],
        }
        r = requests.post(f"{BASE_URL}/api/partners", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert data["whatsapp"] == "6281234567890"  # digits only
        assert data["type"] == "guide"
        assert "id" in data

    def test_register_partner_validation(self):
        # Missing description
        r = requests.post(f"{BASE_URL}/api/partners", json={
            "business_name": "X", "type": "guide", "whatsapp": "6281111111", "city": "A"
        })
        assert r.status_code == 422
        # Bad type
        r = requests.post(f"{BASE_URL}/api/partners", json={
            "business_name": "TEST_bad", "type": "hotel",
            "whatsapp": "6281111111", "description": "long enough desc", "city": "Medan"
        })
        assert r.status_code == 422

    def test_public_list_returns_only_approved(self, admin_session, dest_ids):
        # Create a pending partner tied to toba
        payload = {
            "business_name": "TEST_Homestay Toba",
            "type": "homestay",
            "whatsapp": "6281299998888",
            "description": "Homestay nyaman di tepi Danau Toba.",
            "city": "Tuktuk",
            "destination_ids": [dest_ids["toba"]],
        }
        r = requests.post(f"{BASE_URL}/api/partners", json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]

        # Public list (default status=approved) should NOT include pending
        r = requests.get(f"{BASE_URL}/api/partners")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert pid not in ids

        # Approve as admin
        r = admin_session.patch(f"{BASE_URL}/api/partners/{pid}/status", json={"status": "approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        # Now visible publicly
        r = requests.get(f"{BASE_URL}/api/partners")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert pid in ids

        # Filter by destination_id
        r = requests.get(f"{BASE_URL}/api/partners", params={"destination_id": dest_ids["toba"]})
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())

        # Filter by type=homestay
        r = requests.get(f"{BASE_URL}/api/partners", params={"type": "homestay"})
        assert r.status_code == 200
        assert all(p["type"] == "homestay" for p in r.json())
        assert any(p["id"] == pid for p in r.json())

        # Cleanup
        r = admin_session.delete(f"{BASE_URL}/api/partners/{pid}")
        assert r.status_code == 200

    def test_admin_endpoint_requires_admin(self, user_session):
        r = requests.get(f"{BASE_URL}/api/partners/admin")
        assert r.status_code == 401
        r = user_session.get(f"{BASE_URL}/api/partners/admin")
        assert r.status_code == 403

    def test_admin_endpoint_lists_all_statuses(self, admin_session):
        # Create a pending partner
        r = requests.post(f"{BASE_URL}/api/partners", json={
            "business_name": "TEST_Rental Medan", "type": "rental",
            "whatsapp": "6281111222", "description": "Rental mobil di Medan.",
            "city": "Medan",
        })
        assert r.status_code == 200
        pid = r.json()["id"]

        r = admin_session.get(f"{BASE_URL}/api/partners/admin")
        assert r.status_code == 200
        items = r.json()
        found = next((p for p in items if p["id"] == pid), None)
        assert found is not None
        assert found["status"] == "pending"

        # Reject then delete
        r = admin_session.patch(f"{BASE_URL}/api/partners/{pid}/status", json={"status": "rejected"})
        assert r.status_code == 200 and r.json()["status"] == "rejected"

        r = admin_session.delete(f"{BASE_URL}/api/partners/{pid}")
        assert r.status_code == 200

    def test_delete_and_patch_require_admin(self, user_session):
        # Create pending partner publicly
        r = requests.post(f"{BASE_URL}/api/partners", json={
            "business_name": "TEST_Perm", "type": "guide",
            "whatsapp": "62899999", "description": "Permission test partner.",
            "city": "Medan",
        })
        pid = r.json()["id"]

        r = user_session.patch(f"{BASE_URL}/api/partners/{pid}/status", json={"status": "approved"})
        assert r.status_code == 403
        r = user_session.delete(f"{BASE_URL}/api/partners/{pid}")
        assert r.status_code == 403
        # cleanup with admin
        adm = requests.Session()
        adm.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        adm.delete(f"{BASE_URL}/api/partners/{pid}")


# ---------------- Trending ----------------
class TestTrending:
    def test_trending_route_not_shadowed(self):
        # Must return list (not 400 "Invalid id" from /destinations/{id})
        r = requests.get(f"{BASE_URL}/api/destinations/trending", params={"days": 30, "limit": 6})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_trending_reflects_wishlist_events(self, user_session, dest_ids):
        # Add to wishlist -> logs event
        r = user_session.post(f"{BASE_URL}/api/wishlist/{dest_ids['toba']}")
        assert r.status_code == 200

        r = requests.get(f"{BASE_URL}/api/destinations/trending", params={"days": 30, "limit": 6})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(d["id"] == dest_ids["toba"] for d in items), \
            f"Expected toba in trending, got {[d['name'] for d in items]}"

        # Cleanup wishlist entry
        user_session.delete(f"{BASE_URL}/api/wishlist/{dest_ids['toba']}")


# ---------------- Saved Itineraries ----------------
class TestItineraries:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/itineraries", json={
            "title": "x", "days": 2, "budget": 100000, "interests": [], "content": "hi", "lang": "id"
        })
        assert r.status_code == 401
        r = requests.get(f"{BASE_URL}/api/itineraries")
        assert r.status_code == 401

    def test_create_list_delete_owner_only(self, user_session):
        payload = {
            "title": "TEST_Trip Toba", "days": 2, "budget": 500000,
            "interests": ["nature"], "content": "## Hari 1\n**Danau Toba**", "lang": "id"
        }
        r = user_session.post(f"{BASE_URL}/api/itineraries", json=payload)
        assert r.status_code == 200, r.text
        itin = r.json()
        assert itin["title"] == "TEST_Trip Toba"
        assert itin["days"] == 2
        assert itin["lang"] == "id"
        iid = itin["id"]

        r = user_session.get(f"{BASE_URL}/api/itineraries")
        assert r.status_code == 200
        assert any(x["id"] == iid for x in r.json())

        # Another user cannot delete
        other = requests.Session()
        em = f"TEST_other3_{uuid.uuid4().hex[:6]}@test.id"
        other.post(f"{BASE_URL}/api/auth/register", json={"email": em, "password": "user1234", "name": "O", "accepted_terms": True})
        r = other.delete(f"{BASE_URL}/api/itineraries/{iid}")
        assert r.status_code == 403

        # Owner deletes
        r = user_session.delete(f"{BASE_URL}/api/itineraries/{iid}")
        assert r.status_code == 200

        # Verify gone
        r = user_session.get(f"{BASE_URL}/api/itineraries")
        assert not any(x["id"] == iid for x in r.json())

    def test_validation(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/itineraries", json={
            "title": "", "days": 2, "budget": 0, "content": "x"
        })
        assert r.status_code == 422
        r = user_session.post(f"{BASE_URL}/api/itineraries", json={
            "title": "ok", "days": 0, "budget": 0, "content": "x"
        })
        assert r.status_code == 422
