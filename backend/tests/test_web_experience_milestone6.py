"""Admin experience-governance contract: quality, moderation, delivery, analytics, and role preview."""

import os
import uuid
from datetime import datetime, timezone, timedelta

import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "QA-governance-m6-123!"


def register(session, email, name):
    response = session.post(f"{API}/auth/register", json={"email": email, "password": PASSWORD, "name": name, "accepted_terms": True})
    assert response.status_code == 200, response.text
    return response.json()


def test_admin_governance_quality_moderation_delivery_and_analytics():
    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    suffix = uuid.uuid4().hex[:10]
    owner, reporter, admin = requests.Session(), requests.Session(), requests.Session()
    owner_email = f"qa-m6-owner-{suffix}@example.com"
    reporter_email = f"qa-m6-reporter-{suffix}@example.com"
    destination_id = partner_id = review_id = report_id = None
    rates_before = set(database.auth_rate_limits.distinct("_id"))
    try:
        owner_user = register(owner, owner_email, "QA M6 Owner")
        reporter_user = register(reporter, reporter_email, "QA M6 Reporter")
        login = admin.post(f"{API}/auth/login", json={"email": os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id"), "password": os.environ.get("ADMIN_PASSWORD", "admin123")})
        assert login.status_code == 200, login.text
        now = datetime.now(timezone.utc)
        stale = (now - timedelta(days=250)).isoformat()
        destination = {
            "name": f"Governance Destination {suffix}", "name_en": "", "location": "Toba", "category": "nature", "price": None,
            "description": "Deskripsi singkat untuk antrean kualitas.", "description_en": "", "tags": [],
            "source_label": "Explore Wisata Sumut Instagram", "source_url": "https://instagram.com/explorewisatasumut",
            "editorial_reviewed_at": stale, "editorial_status": "in_review", "images": [], "video": "",
            "latitude": 2.6, "longitude": 98.8, "featured": False, "is_active": False,
            "created_at": stale, "updated_at": stale,
        }
        destination_id = str(database.destinations.insert_one(destination).inserted_id)
        partner = {
            "business_name": f"Governance Partner {suffix}", "type": "guide", "whatsapp": "6281234567890", "description": "Pemandu lokal untuk pengujian governance dan distribusi exposure Mitra.",
            "city": "Medan", "email": owner_email, "address": "Private", "destination_ids": [destination_id], "service_tags": ["keluarga"],
            "image": "", "gallery": [], "status": "approved", "is_active": True, "accepting_contacts": True,
            "owner_user_id": owner_user["id"], "ownership_status": "claimed", "verification_documents": [], "approval_history": [],
            "guide_languages": ["Indonesia"], "created_at": stale, "updated_at": stale, "last_profile_reviewed_at": stale,
        }
        partner_id = str(database.partners.insert_one(partner).inserted_id)
        database.partner_memberships.insert_one({"partner_id": partner_id, "user_id": owner_user["id"], "role": "owner", "status": "active", "created_at": now.isoformat(), "updated_at": now.isoformat()})
        review_id = str(database.reviews.insert_one({"destination_id": destination_id, "user_id": reporter_user["id"], "user_name": "QA Reporter", "rating": 1, "comment": "Informasi ini perlu diperiksa.", "created_at": now.isoformat()}).inserted_id)

        assert reporter.get(f"{API}/admin/governance/overview").status_code == 403
        preview = admin.get(f"{API}/admin/governance/role-preview/partner")
        assert preview.status_code == 200 and preview.json()["session_unchanged"] is True and preview.json()["read_only"] is True
        assert admin.get(f"{API}/auth/me").json()["role"] == "admin"

        overview = admin.get(f"{API}/admin/governance/overview")
        assert overview.status_code == 200, overview.text
        assert any(item["id"] == destination_id and item["stale"] for item in overview.json()["quality_queue"])
        assert any(item["id"] == partner_id for item in overview.json()["quality_queue"])
        assert overview.json()["quality_queue"][0]["public_urls"]["id"].endswith("?lang=id")
        preview_item = next(item for item in overview.json()["quality_queue"] if item["id"] == destination_id)
        assert preview_item["preview_urls"]["en"].endswith("lang=en&preview=admin")
        assert reporter.get(f"{API}/admin/governance/preview/destinations/{destination_id}").status_code == 403
        assert admin.get(f"{API}/admin/governance/preview/destinations/{destination_id}").status_code == 200
        assert admin.get(f"{API}/admin/governance/preview/partners/{partner_id}").status_code == 200
        bad_revision = admin.patch(f"{API}/admin/governance/destinations/{destination_id}/workflow", json={"status": "needs_revision", "note": "no"})
        assert bad_revision.status_code == 400
        published = admin.patch(f"{API}/admin/governance/destinations/{destination_id}/workflow", json={"status": "published", "note": "Sumber dan informasi telah ditinjau."})
        assert published.status_code == 200
        stored_destination = database.destinations.find_one({"_id": ObjectId(destination_id)})
        assert stored_destination["is_active"] is True and stored_destination["editorial_reviewed_by"]

        report = reporter.post(f"{API}/reports", json={"target_type": "review", "target_id": review_id, "reason": "incorrect", "description": "Ulasan berisi informasi yang tidak tepat."})
        assert report.status_code == 201, report.text
        report_id = report.json()["id"]
        reports = admin.get(f"{API}/admin/governance/reports")
        assert reports.status_code == 200 and any(item["id"] == report_id for item in reports.json())
        hidden = admin.patch(f"{API}/admin/governance/reports/{report_id}", json={"status": "resolved", "action": "hide", "admin_note": "Diverifikasi moderator."})
        assert hidden.status_code == 200
        public_reviews = reporter.get(f"{API}/destinations/{destination_id}/reviews").json()
        assert all(item["id"] != review_id for item in public_reviews["reviews"])

        consent_headers = {"X-Analytics-Consent": "granted"}
        for event_type, source in (("directory_impression", "directory"), ("ai_impression", "planner"), ("profile_view", "partner_detail"), ("whatsapp_click", "partner_detail")):
            event = reporter.post(f"{API}/analytics/partner-events", headers=consent_headers, json={"event_id": uuid.uuid4().hex, "event_type": event_type, "partner_id": partner_id, "source": source, "destination_id": destination_id, "anonymous_session_id": uuid.uuid4().hex})
            assert event.status_code == 200 and event.json()["accepted"] is True
        analytics = admin.get(f"{API}/admin/governance/analytics")
        assert analytics.status_code == 200
        row = next(item for item in analytics.json()["exposure"] if item["partner_id"] == partner_id)
        assert row["directory_impression"] == 1 and row["ai_impression"] == 1 and row["whatsapp_click"] == 1
        assert row["tier"] == "regular" and row["contact_rate"] == 50.0

        database.partners.update_one({"_id": ObjectId(partner_id)}, {"$set": {"status": "needs_revision", "is_active": False, "revision_note": "Mohon lengkapi informasi layanan.", "review_due_at": (now - timedelta(days=1)).isoformat()}})
        attention = admin.get(f"{API}/admin/governance/overview").json()["partner_queue"]
        assert any(item["id"] == partner_id for item in attention)
        notified = admin.post(f"{API}/admin/governance/partners/{partner_id}/notify")
        assert notified.status_code == 200, notified.text
        deliveries = {item["channel"]: item["status"] for item in notified.json()["deliveries"]}
        assert deliveries["in_app"] == "sent" and deliveries["email"] in {"sent", "configuration_required"} and deliveries["sms"] in {"sent", "configuration_required"}
        inbox = owner.get(f"{API}/notifications")
        assert inbox.status_code == 200 and any(item["kind"] == "partner_revision_reminder" for item in inbox.json())
        notification_id = next(item["id"] for item in inbox.json() if item["kind"] == "partner_revision_reminder")
        assert reporter.patch(f"{API}/notifications/{notification_id}/read").status_code == 404
        assert owner.patch(f"{API}/notifications/{notification_id}/read").status_code == 200
        delivery_log = admin.get(f"{API}/admin/governance/notifications")
        assert delivery_log.status_code == 200 and {item["channel"] for item in delivery_log.json()} >= {"email", "sms", "in_app"}
    finally:
        for collection, query in (
            (database.content_reports, {"_id": ObjectId(report_id)} if report_id else {"target_id": review_id}),
            (database.partner_analytics, {"partner_id": partner_id}),
            (database.in_app_notifications, {"user_id": owner_user["id"] if "owner_user" in locals() else ""}),
            (database.sms_outbox, {"kind": {"$in": ["partner_revision_reminder", "partner_sla_update"]}, "recipient": "6281234567890"}),
            (database.email_outbox, {"recipient": {"$in": [owner_email, reporter_email]}}),
            (database.partner_memberships, {"partner_id": partner_id}),
            (database.reviews, {"_id": ObjectId(review_id)} if review_id else {"destination_id": destination_id}),
            (database.partners, {"_id": ObjectId(partner_id)} if partner_id else {"business_name": f"Governance Partner {suffix}"}),
            (database.destinations, {"_id": ObjectId(destination_id)} if destination_id else {"name": f"Governance Destination {suffix}"}),
            (database.users, {"email": {"$in": [owner_email, reporter_email]}}),
        ):
            collection.delete_many(query)
        new_rates = set(database.auth_rate_limits.distinct("_id")) - rates_before
        if new_rates:
            database.auth_rate_limits.delete_many({"_id": {"$in": list(new_rates)}})
        client.close()
