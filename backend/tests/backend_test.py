"""
Backend tests for Explore Wisata Sumut - Iteration 2.
Covers: reviews CRUD, upload (auth-gated), file serving, trip planner SSE.
"""
import os
import io
import json
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
# Fallback: read frontend .env
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
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.id"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "user1234", "name": "Test User"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    s._email = email
    return s


@pytest.fixture(scope="module")
def dest_id():
    r = requests.get(f"{BASE_URL}/api/destinations")
    assert r.status_code == 200
    items = r.json()
    assert items
    # Prefer Danau Toba
    for d in items:
        if d["name"] == "Danau Toba":
            return d["id"]
    return items[0]["id"]


# ---------------- Upload ----------------
def _tiny_png_bytes():
    # 1x1 red PNG
    import base64
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    )


class TestUpload:
    def test_upload_requires_auth(self):
        files = {"file": ("t.png", _tiny_png_bytes(), "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert r.status_code == 401

    def test_upload_rejects_non_image(self, admin_session):
        files = {"file": ("t.txt", b"hello world", "text/plain")}
        r = admin_session.post(f"{BASE_URL}/api/upload", files=files)
        assert r.status_code == 400

    def test_upload_success_and_serve(self, admin_session):
        files = {"file": ("test.png", _tiny_png_bytes(), "image/png")}
        r = admin_session.post(f"{BASE_URL}/api/upload", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "path" in data and "url" in data
        assert data["url"].startswith("/api/files/")
        # Public serve, no auth
        r2 = requests.get(f"{BASE_URL}{data['url']}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) > 0


# ---------------- Reviews ----------------
class TestReviews:
    def test_create_requires_auth(self, dest_id):
        r = requests.post(f"{BASE_URL}/api/destinations/{dest_id}/reviews",
                          json={"rating": 5, "comment": "great"})
        assert r.status_code == 401

    def test_rating_validation(self, user_session, dest_id):
        r = user_session.post(f"{BASE_URL}/api/destinations/{dest_id}/reviews",
                              json={"rating": 6, "comment": "bad"})
        assert r.status_code == 422
        r = user_session.post(f"{BASE_URL}/api/destinations/{dest_id}/reviews",
                              json={"rating": 0, "comment": "bad"})
        assert r.status_code == 422

    def test_create_list_delete_flow(self, user_session, admin_session, dest_id):
        # Create
        r = user_session.post(f"{BASE_URL}/api/destinations/{dest_id}/reviews",
                              json={"rating": 4, "comment": "TEST_review nice"})
        assert r.status_code == 200, r.text
        rev = r.json()
        review_id = rev["id"]
        assert rev["rating"] == 4
        assert rev["comment"] == "TEST_review nice"
        assert rev["destination_id"] == dest_id

        # List returns it with avg
        r = requests.get(f"{BASE_URL}/api/destinations/{dest_id}/reviews")
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 1
        assert any(x["id"] == review_id for x in data["reviews"])
        assert isinstance(data["average"], (int, float))

        # Delete by other user: create another user and try
        other = requests.Session()
        em = f"TEST_other_{uuid.uuid4().hex[:6]}@test.id"
        other.post(f"{BASE_URL}/api/auth/register", json={"email": em, "password": "user1234", "name": "Other"})
        r = other.delete(f"{BASE_URL}/api/reviews/{review_id}")
        assert r.status_code == 403

        # Owner can delete
        r = user_session.delete(f"{BASE_URL}/api/reviews/{review_id}")
        assert r.status_code == 200

        # Verify removed
        r = requests.get(f"{BASE_URL}/api/destinations/{dest_id}/reviews")
        assert not any(x["id"] == review_id for x in r.json()["reviews"])

    def test_admin_can_delete_any(self, user_session, admin_session, dest_id):
        r = user_session.post(f"{BASE_URL}/api/destinations/{dest_id}/reviews",
                              json={"rating": 3, "comment": "TEST_admin_delete"})
        assert r.status_code == 200
        rid = r.json()["id"]
        r = admin_session.delete(f"{BASE_URL}/api/reviews/{rid}")
        assert r.status_code == 200


# ---------------- Trip Planner SSE ----------------
class TestTripPlanner:
    SEEDED_NAMES = {"Danau Toba", "Bukit Lawang", "Pantai Cermin", "Istana Maimun", "Tip Top Restaurant"}

    def _consume_stream(self, payload, max_events=200, timeout=90):
        r = requests.post(f"{BASE_URL}/api/trip-planner/stream", json=payload, stream=True, timeout=timeout)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("text/event-stream")
        text_parts = []
        done = False
        err = None
        count = 0
        for raw in r.iter_lines(decode_unicode=True):
            if not raw:
                continue
            if raw.startswith("data: "):
                try:
                    ev = json.loads(raw[6:])
                except json.JSONDecodeError:
                    continue
                if "text" in ev:
                    text_parts.append(ev["text"])
                elif ev.get("done"):
                    done = True
                    break
                elif "error" in ev:
                    err = ev["error"]
                    break
            count += 1
            if count > max_events * 20:
                break
        r.close()
        return "".join(text_parts), done, err

    def test_indonesian_itinerary(self):
        text, done, err = self._consume_stream({
            "days": 2, "budget": 500000, "interests": ["nature"], "lang": "id"
        })
        assert err is None, f"stream error: {err}"
        assert len(text) > 100, f"too short: {text[:200]}"
        # Should contain at least one seeded destination
        mentioned = [n for n in self.SEEDED_NAMES if n in text]
        assert mentioned, f"No seeded destination mentioned. text={text[:500]}"
        # Should contain markdown day header
        assert "Hari" in text or "##" in text

    def test_english_itinerary(self):
        text, done, err = self._consume_stream({
            "days": 2, "budget": 500000, "interests": ["culture"], "lang": "en"
        })
        assert err is None, f"stream error: {err}"
        assert len(text) > 100
        mentioned = [n for n in self.SEEDED_NAMES if n in text]
        assert mentioned, f"No seeded destination mentioned. text={text[:500]}"
        assert "Day" in text or "##" in text
