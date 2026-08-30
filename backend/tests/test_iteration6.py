"""
Backend tests for Explore Wisata Sumut - Iteration 6.
Covers: itinerary create with new fields, PATCH /share toggle,
GET /public/itineraries/{slug}, trip-planner regenerate with previous_content.
"""
import os
import json
import uuid
import time
import pytest
import requests

from runtime_config import backend_url

BASE_URL = backend_url()

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
    em = f"TEST_it6_{uuid.uuid4().hex[:8]}@test.id"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"email": em, "password": "user1234", "name": "Iter6 User", "accepted_terms": True})
    assert r.status_code == 200, r.text
    s._email = em
    return s


@pytest.fixture(scope="module")
def other_session():
    s = requests.Session()
    em = f"TEST_it6b_{uuid.uuid4().hex[:8]}@test.id"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"email": em, "password": "user1234", "name": "Other User", "accepted_terms": True})
    assert r.status_code == 200, r.text
    return s


SAMPLE_ITIN = {
    "title": "TEST_it6 trip",
    "days": 2,
    "budget": 500000,
    "interests": ["nature"],
    "content": "## Hari 1\n- Danau Toba\n\n## Hari 2\n- Bukit Lawang",
    "lang": "id",
}


@pytest.fixture(scope="module")
def owned_itin(user_session):
    r = user_session.post(f"{BASE_URL}/api/itineraries", json=SAMPLE_ITIN)
    assert r.status_code == 200, r.text
    return r.json()


class TestItineraryCreate:
    def test_create_defaults(self, owned_itin):
        d = owned_itin
        assert d["title"] == SAMPLE_ITIN["title"]
        assert d["is_public"] is False
        assert d["share_slug"] in (None, "")
        assert d["author_name"] == "Iter6 User"
        assert "id" in d


class TestItineraryShare:
    def test_share_invalid_id(self, user_session):
        r = user_session.patch(f"{BASE_URL}/api/itineraries/not-an-oid/share",
                               json={"public": True})
        assert r.status_code == 400

    def test_share_unknown_id(self, user_session):
        # valid ObjectId format but not existing
        fake = "507f1f77bcf86cd799439011"
        r = user_session.patch(f"{BASE_URL}/api/itineraries/{fake}/share",
                               json={"public": True})
        assert r.status_code == 404

    def test_share_forbidden_for_other_user(self, other_session, owned_itin):
        itin_id = owned_itin["id"]
        r = other_session.patch(f"{BASE_URL}/api/itineraries/{itin_id}/share",
                                json={"public": True})
        assert r.status_code == 403

    def test_share_enable_generates_slug(self, user_session, owned_itin):
        itin_id = owned_itin["id"]
        r = user_session.patch(f"{BASE_URL}/api/itineraries/{itin_id}/share",
                               json={"public": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_public"] is True
        assert isinstance(d["share_slug"], str) and len(d["share_slug"]) > 0
        owned_itin["share_slug"] = d["share_slug"]

    def test_public_get_no_auth(self, owned_itin):
        slug = owned_itin["share_slug"]
        # brand-new session without cookies
        r = requests.get(f"{BASE_URL}/api/public/itineraries/{slug}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("title", "days", "budget", "interests", "content", "author_name"):
            assert k in d, f"missing {k}"
        assert d["title"] == SAMPLE_ITIN["title"]
        assert d["author_name"] == "Iter6 User"
        # should NOT expose user_id / id
        assert "user_id" not in d

    def test_share_disable_returns_404(self, user_session, owned_itin):
        itin_id = owned_itin["id"]
        r = user_session.patch(f"{BASE_URL}/api/itineraries/{itin_id}/share",
                               json={"public": False})
        assert r.status_code == 200
        assert r.json()["is_public"] is False
        # slug should now 404 publicly
        r2 = requests.get(f"{BASE_URL}/api/public/itineraries/{owned_itin['share_slug']}")
        assert r2.status_code == 404


# ---------------- Trip Planner regenerate ----------------
class TestPlannerRegenerate:
    SEEDED = {"Danau Toba", "Bukit Lawang", "Pantai Cermin", "Istana Maimun", "Tip Top Restaurant"}

    def _consume(self, payload, timeout=90):
        r = requests.post(f"{BASE_URL}/api/trip-planner/stream", json=payload, stream=True, timeout=timeout)
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert ct.startswith("text/event-stream"), ct
        parts, done, err = [], False, None
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data: "):
                continue
            try:
                ev = json.loads(raw[6:])
            except json.JSONDecodeError:
                continue
            if "text" in ev:
                parts.append(ev["text"])
            elif ev.get("done"):
                done = True
                break
            elif "error" in ev:
                err = ev["error"]
                break
        r.close()
        return "".join(parts), done, err

    def test_regenerate_with_previous_content(self):
        prev = "## Hari 1\n- Danau Toba (pagi)\n- Bukit Lawang (sore)\n\n## Hari 2\n- Istana Maimun\n"
        text, done, err = self._consume({
            "days": 2, "budget": 500000, "interests": ["nature"], "lang": "id",
            "previous_content": prev,
        })
        assert err is None, err
        assert len(text) > 100, text[:200]
        assert ("Hari" in text) or ("##" in text)
        mentioned = [n for n in self.SEEDED if n in text]
        assert mentioned, f"No seeded destination mentioned: {text[:400]}"

    def test_regenerate_empty_previous(self):
        text, done, err = self._consume({
            "days": 2, "budget": 500000, "interests": ["culture"], "lang": "en",
            "previous_content": "",
        })
        assert err is None, err
        assert len(text) > 100
        assert ("Day" in text) or ("##" in text)

    def test_regenerate_long_previous(self):
        long_prev = "## Hari 1\n" + ("- Danau Toba\n" * 300)  # under 20000 chars
        text, done, err = self._consume({
            "days": 1, "budget": 300000, "interests": ["nature"], "lang": "id",
            "previous_content": long_prev,
        })
        assert err is None, err
        assert len(text) > 50
