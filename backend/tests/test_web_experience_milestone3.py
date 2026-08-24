"""User workspace and ownership contract for Web Experience Milestone 3."""

import os
import uuid

import requests
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"


def register(session, email, name):
    response = session.post(f"{API}/auth/register", json={
        "email": email,
        "password": "QA-workspace-123!",
        "name": name,
        "accepted_terms": True,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_trip_workspace_ownership_lifecycle_and_review_management():
    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    suffix = uuid.uuid4().hex[:10]
    owner_email = f"qa-m3-owner-{suffix}@example.com"
    other_email = f"qa-m3-other-{suffix}@example.com"
    owner = requests.Session()
    other = requests.Session()
    itinerary_ids = []
    review_ids = []
    outbox_before = set(database.email_outbox.distinct("_id"))
    rates_before = set(database.auth_rate_limits.distinct("_id"))
    try:
        owner_user = register(owner, owner_email, "QA Workspace Owner")
        register(other, other_email, "QA Workspace Other")
        destination_docs = list(database.destinations.find(
            {"is_active": {"$ne": False}}, {"_id": 1}
        ).limit(2))
        assert destination_docs, "Milestone 3 contract requires one active destination"
        destination_ids = [str(row["_id"]) for row in destination_docs]

        batch = requests.post(f"{API}/destinations/batch", json={
            "ids": destination_ids + destination_ids[:1],
        })
        assert batch.status_code == 200, batch.text
        assert [row["id"] for row in batch.json()] == destination_ids

        created = owner.post(f"{API}/itineraries", json={
            "title": "QA Lake and Culture Trip",
            "days": 3,
            "budget": 2500000,
            "interests": ["nature", "culture"],
            "content": "## Hari 1\nKunjungi destinasi pilihan.",
            "lang": "id",
            "destination_ids": destination_ids,
            "extra_context": "Perjalanan keluarga",
        })
        assert created.status_code == 200, created.text
        trip = created.json()
        itinerary_ids.append(trip["id"])
        assert trip["destination_ids"] == destination_ids
        assert trip["extra_context"] == "Perjalanan keluarga"
        assert trip["is_public"] is False

        detail = owner.get(f"{API}/itineraries/{trip['id']}")
        assert detail.status_code == 200
        assert detail.json()["user_id"] == owner_user["id"]
        assert other.get(f"{API}/itineraries/{trip['id']}").status_code == 403

        updated = owner.put(f"{API}/itineraries/{trip['id']}", json={
            "title": "QA Updated Workspace Trip",
            "days": 4,
            "budget": 3000000,
            "interests": ["culture", "culinary", "culture"],
            "lang": "en",
            "destination_ids": destination_ids,
            "extra_context": "Slow pace",
        })
        assert updated.status_code == 200, updated.text
        assert updated.json()["title"] == "QA Updated Workspace Trip"
        assert updated.json()["interests"] == ["culture", "culinary"]
        assert updated.json()["content"] == trip["content"]

        copied = owner.post(f"{API}/itineraries/{trip['id']}/duplicate", json={
            "title": "QA Workspace Copy",
        })
        assert copied.status_code == 200, copied.text
        duplicate = copied.json()
        itinerary_ids.append(duplicate["id"])
        assert duplicate["id"] != trip["id"]
        assert duplicate["duplicated_from_id"] == trip["id"]
        assert duplicate["is_public"] is False
        assert duplicate["share_slug"] is None

        forbidden_copy = other.post(f"{API}/itineraries/{trip['id']}/duplicate", json={})
        assert forbidden_copy.status_code == 403

        shared = owner.patch(f"{API}/itineraries/{trip['id']}/share", json={"public": True})
        assert shared.status_code == 200, shared.text
        share_slug = shared.json()["share_slug"]
        public = requests.get(f"{API}/public/itineraries/{share_slug}")
        assert public.status_code == 200
        assert public.json()["destination_ids"] == destination_ids
        assert "extra_context" not in public.json()

        review = owner.post(f"{API}/destinations/{destination_ids[0]}/reviews", json={
            "rating": 4,
            "comment": "Ulasan workspace milik pengguna.",
        })
        assert review.status_code == 200, review.text
        review_id = review.json()["id"]
        review_ids.append(review_id)
        forbidden_update = other.put(f"{API}/reviews/{review_id}", json={
            "rating": 1,
            "comment": "Tidak boleh diubah pengguna lain.",
        })
        assert forbidden_update.status_code == 403
        assert other.delete(f"{API}/reviews/{review_id}").status_code == 403
        review_update = owner.put(f"{API}/reviews/{review_id}", json={
            "rating": 5,
            "comment": "Ulasan berhasil diperbarui pemilik.",
        })
        assert review_update.status_code == 200
        assert review_update.json()["rating"] == 5
        assert owner.delete(f"{API}/reviews/{review_id}").status_code == 200
        review_ids.remove(review_id)

        assert owner.delete(f"{API}/itineraries/{duplicate['id']}").status_code == 200
        itinerary_ids.remove(duplicate["id"])
        assert other.delete(f"{API}/itineraries/{trip['id']}").status_code == 403
    finally:
        if itinerary_ids:
            from bson import ObjectId
            database.itineraries.delete_many({"_id": {"$in": [ObjectId(value) for value in itinerary_ids]}})
        if review_ids:
            from bson import ObjectId
            database.reviews.delete_many({"_id": {"$in": [ObjectId(value) for value in review_ids]}})
        database.users.delete_many({"email": {"$in": [owner_email, other_email]}})
        new_outbox = [row_id for row_id in database.email_outbox.distinct("_id") if row_id not in outbox_before]
        new_rates = [row_id for row_id in database.auth_rate_limits.distinct("_id") if row_id not in rates_before]
        if new_outbox:
            database.email_outbox.delete_many({"_id": {"$in": new_outbox}})
        if new_rates:
            database.auth_rate_limits.delete_many({"_id": {"$in": new_rates}})
        client.close()
