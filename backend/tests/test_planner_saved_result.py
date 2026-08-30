import asyncio
import copy
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from bson import ObjectId
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server
from planner_result_contract import PlannerStoredResultV2


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, _limit):
        return self.rows


class FakeCollection:
    def __init__(self, rows=None, one=None):
        self.rows = rows or []
        self.one = one

    def find(self, *_args, **_kwargs):
        return FakeCursor(self.rows)

    async def find_one(self, *_args, **_kwargs):
        return self.one


class FakeWriteResult:
    def __init__(self, *, inserted_id=None, deleted_count=0):
        self.inserted_id = inserted_id
        self.deleted_count = deleted_count


class FakeItineraryCollection:
    def __init__(self):
        self.documents = {}

    async def insert_one(self, document):
        inserted_id = ObjectId()
        stored = copy.deepcopy(document)
        stored["_id"] = inserted_id
        self.documents[str(inserted_id)] = stored
        return FakeWriteResult(inserted_id=inserted_id)

    async def find_one(self, query, *_args, **_kwargs):
        document = self.documents.get(str(query.get("_id")))
        return copy.deepcopy(document) if document else None

    async def update_one(self, query, update):
        document = self.documents.get(str(query.get("_id")))
        if document:
            document.update(copy.deepcopy(update.get("$set", {})))

    async def delete_one(self, query):
        deleted = self.documents.pop(str(query.get("_id")), None)
        return FakeWriteResult(deleted_count=1 if deleted else 0)


def stored_payload(destination_id, partner_id=None):
    matches = []
    if partner_id:
        matches.append({
            "partner_id": partner_id,
            "type": "guide",
            "destination_ids": [destination_id],
            "offering_ids": [],
            "match_reasons": ["Melayani kawasan itinerary"],
            "placement": "organic",
        })
    return {
        "version": 2,
        "result_format": "structured",
        "request_snapshot": {"days": 1, "budget_style": "mid_range", "interests": ["nature"], "lang": "id"},
        "summary": "Perjalanan santai di kawasan Toba.",
        "days": [{
            "day": 1,
            "title": "Jelajah Toba",
            "area_label": "Toba",
            "description": "Hari dengan ritme ringan.",
            "stops": [{
                "period": "morning",
                "time_label": "08.00",
                "destination_id": destination_id,
                "activity": "Menikmati panorama.",
                "practical_tip": "Periksa cuaca.",
            }],
        }],
        "destination_ids": [destination_id],
        "partner_matches": matches,
        "travel_notes": [],
        "travel_tips": ["Bawa air minum."],
        "generated_at": "2026-08-30T10:00:00+00:00",
    }


def test_itinerary_input_keeps_v1_compatible_and_validates_v2_pairing():
    destination_id = str(ObjectId())
    legacy = server.ItineraryIn(
        title="Legacy", days=1, budget_style="budget", content="## Hari 1",
        destination_ids=[destination_id],
    )
    assert legacy.result_version is None
    assert legacy.structured_result is None

    structured = server.ItineraryIn(
        title="V2", days=1, budget_style="mid_range", content="Compatibility markdown",
        destination_ids=[destination_id], result_version=2,
        structured_result=stored_payload(destination_id),
    )
    assert structured.structured_result.version == 2

    with pytest.raises(ValidationError):
        server.ItineraryIn(
            title="Invalid", days=1, budget_style="budget", content="Content",
            destination_ids=[destination_id], result_version=2,
        )
    with pytest.raises(ValidationError):
        server.ItineraryIn(
            title="Mismatch", days=1, budget_style="budget", content="Content",
            destination_ids=[str(ObjectId())], result_version=2,
            structured_result=stored_payload(destination_id),
        )


def test_hydration_uses_current_database_cards_and_filters_inactive_partner(monkeypatch):
    destination_oid = ObjectId()
    partner_oid = ObjectId()
    destination_id, partner_id = str(destination_oid), str(partner_oid)
    destination_doc = {
        "_id": destination_oid, "name": "Danau Toba DB", "name_en": "Lake Toba",
        "location": "Toba", "category": "nature", "images": [],
        "description": "Editorial", "description_en": "Editorial", "is_active": True,
        "admin_note": "private destination note",
    }
    partner_doc = {
        "_id": partner_oid, "business_name": "Pemandu DB Terbaru", "type": "guide",
        "whatsapp": "628123456789", "city": "Toba", "description": "Pemandu lokal",
        "service_tags": [], "destination_ids": [destination_id], "status": "approved",
        "is_active": True, "accepting_contacts": True, "owner_user_id": "private-owner",
    }
    fake_db = SimpleNamespace(
        destinations=FakeCollection([destination_doc]),
        partners=FakeCollection([partner_doc]),
        partner_offerings=FakeCollection([]),
    )
    monkeypatch.setattr(server, "db", fake_db)

    hydrated = asyncio.run(server.hydrate_stored_planner_result(stored_payload(destination_id, partner_id)))
    dumped = hydrated.model_dump(mode="json")
    assert dumped["destinations"][0]["name"] == "Danau Toba DB"
    assert dumped["partner_matches"][0]["partner"]["business_name"] == "Pemandu DB Terbaru"
    serialized = json.dumps(dumped)
    assert "private-owner" not in serialized
    assert "private destination note" not in serialized

    fake_db.partners.rows = []
    without_partner = asyncio.run(server.hydrate_stored_planner_result(stored_payload(destination_id, partner_id)))
    assert without_partner.partner_matches == []
    assert without_partner.days[0].stops[0].activity == "Menikmati panorama."


def test_public_contract_and_share_metadata_never_expose_private_context(monkeypatch):
    destination_id = str(ObjectId())
    raw = stored_payload(destination_id)
    raw["summary"] = "<script>alert(1)</script> **Ringkasan aman**"
    document = {
        "_id": ObjectId(), "user_id": "owner", "title": "Trip publik", "days": 1,
        "budget_style": "mid_range", "interests": ["nature"], "content": "Fallback",
        "lang": "id", "created_at": "2026-08-30T10:00:00+00:00", "author_name": "Owner",
        "is_public": True, "share_slug": "public-slug", "destination_ids": [destination_id],
        "extra_context": "PRIVATE FAMILY STORY", "result_version": 2, "structured_result": raw,
    }
    fake_db = SimpleNamespace(itineraries=FakeCollection(one=document))
    monkeypatch.setattr(server, "db", fake_db)
    monkeypatch.setenv("PUBLIC_APP_URL", "https://explorewisatasumut.com")
    response = asyncio.run(server.share_preview_page(
        "public-slug",
        SimpleNamespace(headers={"host": "api.ews.example", "x-forwarded-proto": "https"}),
    ))
    html = response.body.decode("utf-8")
    assert "PRIVATE FAMILY STORY" not in html
    assert "<script>alert(1)</script>" not in html
    assert "Ringkasan aman" in html
    assert 'content="https://explorewisatasumut.com/trip/public-slug"' in html
    assert 'content="https://api.ews.example/api/share/public-slug/image.png"' in html

    public_fields = server.PublicItineraryOut.model_fields
    assert "extra_context" not in public_fields
    assert "user_id" not in public_fields


def test_stored_result_schema_rejects_hydrated_partner_and_destination_snapshots():
    destination_id = str(ObjectId())
    payload = stored_payload(destination_id)
    payload["destinations"] = [{"id": destination_id, "name": "Must not persist"}]
    with pytest.raises(ValidationError):
        PlannerStoredResultV2.model_validate(payload)

    payload = stored_payload(destination_id, str(ObjectId()))
    payload["partner_matches"][0]["partner"] = {"whatsapp": "628123456789"}
    with pytest.raises(ValidationError):
        PlannerStoredResultV2.model_validate(payload)


def test_v2_save_reopen_update_and_delete_lifecycle(monkeypatch):
    destination_oid = ObjectId()
    destination_id = str(destination_oid)
    itineraries = FakeItineraryCollection()
    fake_db = SimpleNamespace(
        destinations=FakeCollection([{
            "_id": destination_oid,
            "name": "Bukit Holbung",
            "location": "Samosir",
            "category": "nature",
            "images": [],
            "is_active": True,
        }]),
        partners=FakeCollection([]),
        partner_offerings=FakeCollection([]),
        itineraries=itineraries,
    )
    monkeypatch.setattr(server, "db", fake_db)
    owner = {"id": "owner-1", "name": "Pemilik Trip"}

    created = asyncio.run(server.save_itinerary(server.ItineraryIn(
        title="Trip V2",
        days=1,
        budget_style="mid_range",
        content="## Hari 1\nFallback yang tetap disimpan.",
        interests=["nature"],
        destination_ids=[destination_id],
        result_version=2,
        structured_result=stored_payload(destination_id),
    ), owner))

    stored = itineraries.documents[created.id]
    assert created.result_version == 2
    assert created.structured_result.destinations[0].name == "Bukit Holbung"
    assert stored["content"].startswith("## Hari 1")
    assert "destinations" not in stored["structured_result"]

    reopened = asyncio.run(server.get_itinerary(created.id, owner))
    assert reopened.structured_result.summary == "Perjalanan santai di kawasan Toba."

    updated = asyncio.run(server.update_itinerary(
        created.id,
        server.ItineraryUpdateIn(
            title="Trip V2 diperbarui",
            days=1,
            budget_style="mid_range",
            interests=["nature"],
            destination_ids=[destination_id],
        ),
        owner,
    ))
    assert updated.title == "Trip V2 diperbarui"
    assert updated.result_version == 2
    assert updated.structured_result is not None

    assert asyncio.run(server.delete_itinerary(created.id, owner)) == {"ok": True}
    assert created.id not in itineraries.documents
