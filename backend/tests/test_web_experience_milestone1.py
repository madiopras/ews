"""Public discovery contract for Web Experience Milestone 1."""

import os
import uuid

import requests
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


def test_guest_discovery_search_editorial_metadata_and_pagination():
    admin = requests.Session()
    login = admin.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    assert login.status_code == 200, login.text

    suffix = uuid.uuid4().hex[:10]
    location = f"QA Discovery {suffix}"
    tag = f"tag-{suffix}"
    created_ids = []
    try:
        for index, name in enumerate(["Air Terjun", "Bukit Panorama"]):
            response = admin.post(f"{API}/destinations", json={
                "name": f"{name} {suffix}",
                "name_en": f"QA Destination {index}",
                "location": location,
                "category": "nature",
                "description": "Destinasi QA untuk menguji discovery publik tanpa harga wajib.",
                "description_en": "QA destination for the public discovery contract.",
                "tags": [tag.upper(), "Keluarga", tag],
                "source_label": "Explore Wisata Sumut",
                "source_url": "https://www.instagram.com/explorewisatasumut/",
                "editorial_reviewed_at": "2026-08-24",
                "images": [f"https://example.com/{suffix}-{index}.webp"],
                "latitude": 2.5 + index / 100,
                "longitude": 98.8 + index / 100,
                "featured": index == 0,
                "is_active": True,
            })
            assert response.status_code == 200, response.text
            body = response.json()
            created_ids.append(body["id"])
            assert body["price"] is None
            assert body["tags"] == [tag, "keluarga"]

        first_page = requests.get(f"{API}/destinations/search", params={
            "q": tag,
            "location": location,
            "category": "nature",
            "sort": "name",
            "page": 1,
            "page_size": 1,
        })
        assert first_page.status_code == 200, first_page.text
        result = first_page.json()
        assert result["total"] == 2
        assert result["pages"] == 2
        assert len(result["items"]) == 1

        second_page = requests.get(f"{API}/destinations/search", params={
            "q": suffix,
            "page": 2,
            "page_size": 1,
        }).json()
        assert second_page["page"] == 2
        assert len(second_page["items"]) == 1

        suggestions = requests.get(f"{API}/destinations/suggestions", params={
            "q": suffix,
            "limit": 10,
        })
        assert suggestions.status_code == 200, suggestions.text
        assert {row["id"] for row in suggestions.json()} == set(created_ids)
        assert "price" not in suggestions.json()[0]

        locations = requests.get(f"{API}/destinations/locations")
        assert locations.status_code == 200
        assert location in locations.json()

        detail = requests.get(f"{API}/destinations/{created_ids[0]}")
        assert detail.status_code == 200
        assert detail.json()["source_label"] == "Explore Wisata Sumut"
        assert detail.json()["source_url"].startswith("https://")
        assert detail.json()["editorial_reviewed_at"] == "2026-08-24"

        invalid_source = admin.post(f"{API}/destinations", json={
            "name": f"Invalid {suffix}",
            "location": location,
            "category": "nature",
            "description": "Destinasi QA dengan sumber editorial yang tidak aman.",
            "source_url": "javascript:alert(1)",
            "latitude": 2.5,
            "longitude": 98.8,
        })
        assert invalid_source.status_code == 400
    finally:
        for destination_id in created_ids:
            admin.delete(f"{API}/destinations/{destination_id}")
        client = MongoClient(os.environ["MONGO_URL"])
        try:
            client[os.environ["DB_NAME"]].audit_logs.delete_many({
                "entity_id": {"$in": created_ids},
            })
        finally:
            client.close()
