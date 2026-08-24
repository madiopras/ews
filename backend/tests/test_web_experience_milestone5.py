"""Mitra self-service, safe public DTO, consent analytics, and owner payment access."""

import os
import uuid

import requests
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE_URL}/api"
PASSWORD = "QA-mitra-m5-123!"


def register(session, email, name):
    response = session.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "name": name, "accepted_terms": True,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_mitra_self_service_public_trust_and_consent_contract():
    client = MongoClient(os.environ["MONGO_URL"])
    database = client[os.environ["DB_NAME"]]
    suffix = uuid.uuid4().hex[:10]
    owner, staff, outsider, admin = requests.Session(), requests.Session(), requests.Session(), requests.Session()
    emails = {role: f"qa-m5-{role}-{suffix}@example.com" for role in ("owner", "staff", "outsider")}
    partner_id = None
    order_id = f"QA-M5-{suffix}"
    try:
        users = {role: register(session, emails[role], f"QA M5 {role}") for role, session in (("owner", owner), ("staff", staff), ("outsider", outsider))}
        login = admin.post(f"{API}/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL", "admin@wisatasumut.id"),
            "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
        })
        assert login.status_code == 200, login.text
        destination = database.destinations.find_one({"is_active": {"$ne": False}}, {"_id": 1, "name": 1})
        assert destination
        destination_id = str(destination["_id"])

        started = owner.post(f"{API}/mitra/onboarding", json={"type": "guide"})
        assert started.status_code == 201, started.text
        partner_id = started.json()["id"]
        assert owner.post(f"{API}/mitra/partners/{partner_id}/members", json={"email": emails["staff"]}).status_code == 200
        database.partners.update_one({"_id": ObjectId(partner_id)}, {"$set": {
            "business_name": f"Pemandu Self Service {suffix}", "type": "guide", "whatsapp": "6281234567890",
            "description": "Pemandu lokal berpengalaman untuk perjalanan keluarga, budaya, alam, dan kebutuhan rute yang fleksibel.",
            "city": "Medan", "email": emails["owner"], "address": "Alamat privat QA",
            "destination_ids": [destination_id], "service_tags": ["keluarga", "budaya"],
            "guide_languages": ["Indonesia"], "verification_documents": [{"id": "private-doc", "document_type": "other", "filename": "private.pdf", "content_type": "application/pdf", "size": 100, "uploaded_at": "2026-08-24T00:00:00+00:00", "uploaded_by": users["owner"]["id"]}],
            "status": "approved", "is_active": True, "accepting_contacts": True,
        }})

        workspace = owner.get(f"{API}/mitra/partners/{partner_id}")
        assert workspace.status_code == 200, workspace.text
        assert workspace.json()["profile_completeness"] < 100
        payload = {
            "business_name": f"Pemandu Self Service {suffix}", "type": "guide", "whatsapp": "6281234567890",
            "description": "Pemandu lokal berpengalaman untuk perjalanan keluarga, budaya, alam, kuliner, dan kebutuhan rute fleksibel di Sumatera Utara.",
            "city": "Medan", "email": emails["owner"], "address": "Alamat privat QA",
            "destination_ids": [destination_id], "service_tags": ["keluarga", "budaya"], "current_step": 4,
            "guide_languages": ["Indonesia", "English"], "guide_license_number": "", "guide_experience_years": 8,
            "rental_vehicle_types": [], "rental_driver_available": False, "rental_fleet_size": 0,
            "homestay_room_count": 0, "homestay_facilities": [], "homestay_checkin_info": "",
            "souvenir_products": [], "souvenir_delivery_available": False, "souvenir_shop_hours": "",
        }
        updated = staff.put(f"{API}/mitra/partners/{partner_id}/profile", json=payload)
        assert updated.status_code == 200, updated.text
        assert outsider.put(f"{API}/mitra/partners/{partner_id}/profile", json=payload).status_code == 403
        assert staff.put(f"{API}/mitra/partners/{partner_id}/profile", json={**payload, "type": "rental"}).status_code == 400

        offering_payload = {
            "kind": "service", "name": "Tur keluarga Danau Toba", "description": "Pendampingan rute fleksibel tanpa sistem booking.",
            "ai_tags": ["keluarga", "danau", "budaya"], "service_areas": ["Medan", "Toba"],
            "destination_ids": [destination_id], "availability_note": "Konfirmasi jadwal via WhatsApp", "is_active": True,
        }
        offering = staff.post(f"{API}/mitra/partners/{partner_id}/offerings", json=offering_payload)
        assert offering.status_code == 201, offering.text
        offering_id = offering.json()["id"]
        assert outsider.get(f"{API}/mitra/partners/{partner_id}/offerings").status_code == 403
        assert staff.put(f"{API}/mitra/partners/{partner_id}/offerings/{offering_id}", json={**offering_payload, "name": "Tur budaya keluarga"}).status_code == 200

        png = b"\x89PNG\r\n\x1a\n" + b"milestone-five-gallery"
        gallery = staff.post(f"{API}/mitra/partners/{partner_id}/gallery", files={"file": ("public.png", png, "image/png")})
        assert gallery.status_code == 200, gallery.text
        assert gallery.json()["profile_completeness"] == 100

        public = outsider.get(f"{API}/partners/{partner_id}/public")
        assert public.status_code == 200, public.text
        body = public.json()
        assert body["whatsapp"] == "6281234567890" and len(body["offerings"]) == 1
        for private_field in ("email", "address", "owner_user_id", "members", "verification_documents"):
            assert private_field not in body

        unavailable = staff.patch(f"{API}/mitra/partners/{partner_id}/availability", json={"accepting_contacts": False, "contact_status_note": "Sedang penuh"})
        assert unavailable.status_code == 200
        assert outsider.get(f"{API}/partners/{partner_id}/public").json()["whatsapp"] is None
        assert staff.patch(f"{API}/mitra/partners/{partner_id}/availability", json={"accepting_contacts": True, "contact_status_note": ""}).status_code == 200

        session_id = uuid.uuid4().hex
        event_id = uuid.uuid4().hex
        event = {"event_id": event_id, "event_type": "profile_view", "partner_id": partner_id, "source": "partner_detail", "destination_id": None, "anonymous_session_id": session_id}
        refused = outsider.post(f"{API}/analytics/partner-events", json=event)
        assert refused.status_code == 200 and refused.json()["accepted"] is False
        accepted = outsider.post(f"{API}/analytics/partner-events", json=event, headers={"X-Analytics-Consent": "granted"})
        assert accepted.status_code == 200 and accepted.json() == {"accepted": True, "duplicate": False}
        duplicate = outsider.post(f"{API}/analytics/partner-events", json=event, headers={"X-Analytics-Consent": "granted"})
        assert duplicate.json() == {"accepted": True, "duplicate": True}
        insight = owner.get(f"{API}/mitra/partners/{partner_id}/insights")
        assert insight.status_code == 200 and insight.json()["counts"]["profile_view"] == 1

        database.payment_orders.insert_one({"order_id": order_id, "partner_id": partner_id, "plan_code": "monthly", "months": 1, "amount": 1000, "status": "failed", "created_at": "2026-08-24T00:00:00+00:00"})
        assert staff.get(f"{API}/mitra/partners/{partner_id}/payments").status_code == 403
        history = owner.get(f"{API}/mitra/partners/{partner_id}/payments")
        assert history.status_code == 200 and history.json()["orders"][0]["can_retry"] is True
    finally:
        if partner_id:
            admin.delete(f"{API}/partners/{partner_id}")
        database.payment_orders.delete_many({"order_id": order_id})
        database.partner_offerings.delete_many({"partner_id": partner_id})
        database.partner_analytics.delete_many({"partner_id": partner_id})
        database.partner_memberships.delete_many({"partner_id": partner_id})
        database.partners.delete_many({"_id": ObjectId(partner_id)}) if partner_id else None
        database.users.delete_many({"email": {"$in": list(emails.values())}})
        database.email_outbox.delete_many({"recipient": {"$in": list(emails.values())}})
        client.close()
