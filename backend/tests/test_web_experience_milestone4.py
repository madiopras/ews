"""Partner identity, onboarding, and role authorization contract for Milestone 4."""

import os
from pathlib import Path
import uuid

import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "QA-mitra-123!"


def register(session, email, name):
    response = session.post(f"{API}/auth/register", json={
        "email": email,
        "password": PASSWORD,
        "name": name,
        "accepted_terms": True,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_partner_onboarding_owner_staff_user_and_admin_access():
    database_client = MongoClient(os.environ["MONGO_URL"])
    database = database_client[os.environ["DB_NAME"]]
    suffix = uuid.uuid4().hex[:10]
    emails = {
        "owner": f"qa-m4-owner-{suffix}@example.com",
        "staff": f"qa-m4-staff-{suffix}@example.com",
        "user": f"qa-m4-user-{suffix}@example.com",
    }
    sessions = {key: requests.Session() for key in emails}
    admin = requests.Session()
    partner_ids = []
    outbox_before = set(database.email_outbox.distinct("_id"))
    rates_before = set(database.auth_rate_limits.distinct("_id"))
    try:
        users = {
            key: register(sessions[key], email, f"QA M4 {key.title()}")
            for key, email in emails.items()
        }
        admin_login = admin.post(f"{API}/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id"),
            "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
        })
        assert admin_login.status_code == 200, admin_login.text
        destination = database.destinations.find_one({"is_active": {"$ne": False}}, {"_id": 1})
        assert destination
        destination_id = str(destination["_id"])

        started = sessions["owner"].post(f"{API}/mitra/onboarding", json={"type": "guide"})
        assert started.status_code == 201, started.text
        partner = started.json()
        partner_id = partner["id"]
        partner_ids.append(partner_id)
        assert partner["status"] == "draft"
        assert partner["membership_role"] == "owner"
        assert partner["ownership_status"] == "claimed"

        assert sessions["staff"].get(f"{API}/mitra/partners/{partner_id}").status_code == 403
        assert sessions["user"].get(f"{API}/mitra/partners/{partner_id}").status_code == 403

        added = sessions["owner"].post(f"{API}/mitra/partners/{partner_id}/members", json={
            "email": emails["staff"],
        })
        assert added.status_code == 200, added.text
        assert any(member["user_id"] == users["staff"]["id"] and member["role"] == "staff" for member in added.json()["members"])
        assert sessions["staff"].get(f"{API}/mitra/partners/{partner_id}").status_code == 200

        draft_payload = {
            "business_name": f"Pemandu QA {suffix}",
            "type": "guide",
            "whatsapp": "6281234567890",
            "description": "Pemandu wisata lokal untuk keluarga dan perjalanan budaya di Sumatera Utara.",
            "city": "Medan",
            "email": emails["owner"],
            "address": "Medan, Sumatera Utara",
            "destination_ids": [destination_id],
            "service_tags": ["keluarga", "budaya"],
            "current_step": 3,
            "guide_languages": ["Indonesia", "English"],
            "guide_license_number": "QA-GUIDE-1",
            "guide_experience_years": 7,
            "rental_vehicle_types": [],
            "rental_driver_available": False,
            "rental_fleet_size": 0,
            "homestay_room_count": 0,
            "homestay_facilities": [],
            "homestay_checkin_info": "",
            "souvenir_products": [],
            "souvenir_delivery_available": False,
            "souvenir_shop_hours": "",
        }
        staff_save = sessions["staff"].put(f"{API}/mitra/partners/{partner_id}/draft", json=draft_payload)
        assert staff_save.status_code == 200, staff_save.text
        assert staff_save.json()["guide_languages"] == ["Indonesia", "English"]
        assert sessions["user"].put(f"{API}/mitra/partners/{partner_id}/draft", json=draft_payload).status_code == 403
        assert sessions["staff"].post(f"{API}/mitra/partners/{partner_id}/submit").status_code == 403

        png = b"\x89PNG\r\n\x1a\n" + b"qa-milestone-4"
        forbidden_document = sessions["user"].post(
            f"{API}/partners/{partner_id}/upload-docs",
            data={"document_type": "ktp"},
            files={"file": ("identity.png", png, "image/png")},
        )
        assert forbidden_document.status_code == 403
        document = sessions["owner"].post(
            f"{API}/partners/{partner_id}/upload-docs",
            data={"document_type": "ktp"},
            files={"file": ("identity.png", png, "image/png")},
        )
        assert document.status_code == 200, document.text
        document_id = document.json()["verification_documents"][0]["id"]
        gallery = sessions["staff"].post(
            f"{API}/mitra/partners/{partner_id}/gallery",
            files={"file": ("business.png", png, "image/png")},
        )
        assert gallery.status_code == 200, gallery.text
        assert len(gallery.json()["gallery"]) == 1
        assert sessions["user"].get(f"{API}/mitra/partners/{partner_id}/documents/{document_id}").status_code == 403
        assert sessions["owner"].get(f"{API}/mitra/partners/{partner_id}/documents/{document_id}").status_code == 200

        submitted = sessions["owner"].post(f"{API}/mitra/partners/{partner_id}/submit")
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["status"] == "pending"
        assert submitted.json()["review_due_at"]
        assert sessions["staff"].put(f"{API}/mitra/partners/{partner_id}/draft", json=draft_payload).status_code == 409

        missing_note = admin.patch(f"{API}/partners/{partner_id}/status", json={
            "status": "needs_revision",
            "revision_note": "",
        })
        assert missing_note.status_code == 400
        revision = admin.patch(f"{API}/partners/{partner_id}/status", json={
            "status": "needs_revision",
            "revision_note": "Tambahkan detail titik temu dan kontak alternatif.",
        })
        assert revision.status_code == 200, revision.text
        assert revision.json()["is_active"] is False
        assert revision.json()["revision_note"].startswith("Tambahkan")
        assert database.email_outbox.find_one({"recipient": emails["owner"], "kind": "partner_needs_revision"})

        revised_payload = {**draft_payload, "address": "Titik temu: pusat Kota Medan", "current_step": 4}
        assert sessions["staff"].put(f"{API}/mitra/partners/{partner_id}/draft", json=revised_payload).status_code == 200
        assert sessions["staff"].post(f"{API}/mitra/partners/{partner_id}/resubmit").status_code == 403
        resubmitted = sessions["owner"].post(f"{API}/mitra/partners/{partner_id}/resubmit")
        assert resubmitted.status_code == 200, resubmitted.text
        assert resubmitted.json()["status"] == "pending"

        approved = admin.patch(f"{API}/partners/{partner_id}/status", json={
            "status": "approved",
            "revision_note": "",
        })
        assert approved.status_code == 200, approved.text
        assert approved.json()["is_active"] is True
        assert sessions["owner"].get(f"{API}/auth/me").json()["role"] == "partner"
        assert database.email_outbox.find_one({"recipient": emails["owner"], "kind": "partner_approved"})
        assert admin.get(f"{API}/mitra/partners/{partner_id}").status_code == 200
        assert sessions["owner"].get(f"{API}/mitra/partners/{partner_id}").status_code == 200
        assert sessions["staff"].get(f"{API}/mitra/partners/{partner_id}").status_code == 200
        assert sessions["user"].get(f"{API}/mitra/partners/{partner_id}").status_code == 403

        legacy = admin.post(f"{API}/partners/admin", json={
            "business_name": f"Legacy QA {suffix}",
            "type": "souvenir",
            "whatsapp": "6289876543210",
            "description": "Listing lama yang akan dihubungkan kepada pemilik akun terdaftar.",
            "city": "Medan",
            "email": emails["owner"],
            "address": "Medan",
            "destination_ids": [destination_id],
            "service_tags": ["oleh-oleh"],
            "image": "",
        })
        assert legacy.status_code == 200, legacy.text
        legacy_id = legacy.json()["id"]
        partner_ids.append(legacy_id)
        assert legacy.json()["ownership_status"] == "unclaimed"
        assigned = admin.put(f"{API}/admin/partners/{legacy_id}/owner", json={"email": emails["owner"]})
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["owner_user_id"] == users["owner"]["id"]
        owner_businesses = sessions["owner"].get(f"{API}/mitra/partners").json()
        assert {row["id"] for row in owner_businesses}.issuperset({partner_id, legacy_id})
    finally:
        # Prefer normal admin cleanup so object files and memberships follow production behavior.
        for partner_id in partner_ids:
            try:
                admin.delete(f"{API}/partners/{partner_id}")
            except requests.RequestException:
                pass
        # Fallback cleanup keeps the test isolated if an assertion failed before admin login.
        valid_partner_oids = [ObjectId(value) for value in partner_ids]
        storage_root = Path(os.environ.get("STORAGE_DIR", Path(__file__).parent.parent / "storage")).resolve()
        for row in database.partners.find({"_id": {"$in": valid_partner_oids}}):
            for item in [*(row.get("verification_documents") or []), *(row.get("gallery") or [])]:
                storage_path = item.get("storage_path")
                if not storage_path:
                    continue
                target = (storage_root / storage_path).resolve()
                try:
                    target.relative_to(storage_root)
                except ValueError:
                    continue
                if target.is_file():
                    target.unlink()
        database.files.delete_many({"partner_id": {"$in": partner_ids}})
        database.partners.delete_many({"_id": {"$in": valid_partner_oids}})
        database.partner_memberships.delete_many({"partner_id": {"$in": partner_ids}})
        database.partner_memberships.delete_many({"user_id": {"$in": [user.get("id") for user in locals().get("users", {}).values()]}})
        database.users.delete_many({"email": {"$in": list(emails.values())}})
        new_outbox = [row_id for row_id in database.email_outbox.distinct("_id") if row_id not in outbox_before]
        new_rates = [row_id for row_id in database.auth_rate_limits.distinct("_id") if row_id not in rates_before]
        if new_outbox:
            database.email_outbox.delete_many({"_id": {"$in": new_outbox}})
        if new_rates:
            database.auth_rate_limits.delete_many({"_id": {"$in": new_rates}})
        database_client.close()
