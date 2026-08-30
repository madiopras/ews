from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import sys

from bson import ObjectId
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def destination(name="Danau Toba"):
    return {
        "_id": ObjectId(),
        "name": name,
        "name_en": "Lake Toba",
    }


def test_partner_recommendations_only_use_valid_destination_coverage():
    included = destination()
    excluded = destination("Bukit Lawang")
    included_id = str(included["_id"])
    excluded_id = str(excluded["_id"])
    partners = {
        included_id: [{
            "id": "partner-valid",
            "business_name": "Oleh-oleh Toba",
            "type": "souvenir",
            "whatsapp": "628123456789",
            "city": "Samosir",
            "description": "Produk lokal Samosir",
            "image": "",
            "service_tags": ["produk lokal"],
            "is_premium": False,
            "status": "approved",
            "is_active": True,
            "accepting_contacts": True,
            "owner_user_id": "must-not-leak",
        }],
        excluded_id: [{
            "id": "partner-wrong-route",
            "business_name": "Guide Bukit Lawang",
            "type": "guide",
            "whatsapp": "628111111111",
            "city": "Langkat",
            "description": "Guide lokal",
            "image": "",
            "service_tags": [],
            "is_premium": True,
            "status": "approved",
            "is_active": True,
            "accepting_contacts": True,
        }],
    }

    used_ids, result = server.build_planner_partner_recommendations(
        "## Hari 1\nMengunjungi **Danau Toba**.",
        [included, excluded],
        partners,
        [],
        "ingin mencari oleh-oleh",
        "id",
    )

    assert used_ids == [included_id]
    assert [row["partner_id"] for row in result] == ["partner-valid"]
    assert result[0]["placement"] == "organic"
    assert result[0]["type"] == "souvenir"
    assert result[0]["partner"]["type"] == "souvenir"
    assert "owner_user_id" not in result[0]["partner"]


def test_featured_status_does_not_override_daily_organic_rotation():
    target = destination()
    target_id = str(target["_id"])
    candidates = [
        {
            "id": f"partner-{index}",
            "business_name": f"Partner {index}",
            "type": "guide",
            "whatsapp": f"6281234567{index}",
            "city": "Samosir",
            "description": "Guide lokal",
            "image": "",
            "service_tags": [],
            "is_premium": index == 0,
            "status": "approved",
            "is_active": True,
            "accepting_contacts": True,
        }
        for index in range(5)
    ]

    _, result = server.build_planner_partner_recommendations(
        "Danau Toba", [target], {target_id: candidates}, [], "", "id"
    )

    expected = sorted(
        candidates,
        key=lambda partner: server.hashlib.sha256(
            f"{datetime.now(timezone.utc).date().isoformat()}:{partner['id']}".encode()
        ).hexdigest(),
    )[:2]
    assert [row["partner_id"] for row in result] == [row["id"] for row in expected]
    assert len(result) == 2


def test_partner_recommendations_deduplicate_and_merge_destination_context():
    first = destination("Danau Toba")
    second = destination("Bukit Holbung")
    first_id, second_id = str(first["_id"]), str(second["_id"])
    shared = {
        "id": "partner-shared",
        "business_name": "Pemandu Toba",
        "type": "guide",
        "whatsapp": "628123456789",
        "city": "Samosir",
        "description": "Pemandu untuk beberapa destinasi.",
        "image": "",
        "service_tags": ["keluarga"],
        "is_premium": False,
        "status": "approved",
        "is_active": True,
        "accepting_contacts": True,
    }

    used_ids, result = server.build_planner_partner_recommendations(
        "Danau Toba dan Bukit Holbung",
        [first, second],
        {first_id: [shared], second_id: [shared]},
        [],
        "perjalanan keluarga dengan pemandu",
        "id",
    )

    assert used_ids == [first_id, second_id]
    assert len(result) == 1
    assert result[0]["destination_ids"] == [first_id, second_id]
    assert result[0]["destination_names"] == ["Danau Toba", "Bukit Holbung"]
    assert result[0]["destination_id"] == first_id
    assert "2 destinasi" in result[0]["match_reasons"][0]


def test_partner_recommendations_apply_global_and_per_type_limits():
    target = destination()
    target_id = str(target["_id"])
    partner_types = ["guide", "rental", "homestay", "souvenir", "culinary"]
    candidates = []
    for partner_type in partner_types:
        for index in range(3):
            candidates.append({
                "id": f"{partner_type}-{index}",
                "business_name": f"{partner_type} {index}",
                "type": partner_type,
                "whatsapp": f"62812000{partner_types.index(partner_type)}{index}00",
                "city": "Toba",
                "description": "Usaha lokal yang aktif.",
                "image": "",
                "service_tags": [],
                "is_premium": False,
                "status": "approved",
                "is_active": True,
                "accepting_contacts": True,
            })

    _, result = server.build_planner_partner_recommendations(
        "Danau Toba", [target], {target_id: candidates}, [], "", "id"
    )

    assert len(result) == 8
    for partner_type in partner_types:
        assert len([row for row in result if row["type"] == partner_type]) <= 2


def test_partner_recommendations_limit_featured_to_one_per_type():
    target = destination()
    target_id = str(target["_id"])
    candidates = [
        {
            "id": f"guide-{index}",
            "business_name": f"Guide {index}",
            "type": "guide",
            "whatsapp": f"62812345000{index}",
            "city": "Samosir",
            "description": "Pemandu lokal.",
            "image": "",
            "service_tags": [],
            "is_premium": index < 2,
            "status": "approved",
            "is_active": True,
            "accepting_contacts": True,
        }
        for index in range(3)
    ]

    _, result = server.build_planner_partner_recommendations(
        "Danau Toba", [target], {target_id: candidates}, [], "", "id"
    )

    assert len(result) == 2
    assert len([row for row in result if row["placement"] == "featured"]) == 1
    assert len([row for row in result if row["placement"] == "organic"]) == 1


def test_share_card_uses_available_font_fallbacks():
    content = server.build_share_card("Perjalanan Danau Toba", "3 hari", "QA User")
    image = Image.open(BytesIO(content))
    assert image.format == "PNG"
    assert image.size == (1200, 630)


def test_editorial_links_are_only_exposed_for_http_protocols():
    assert server.safe_public_http_url("https://instagram.com/explorewisatasumut")
    assert server.safe_public_http_url("http://example.com/source")
    assert server.safe_public_http_url("javascript:alert(1)") == ""
    assert server.safe_public_http_url("//example.com/source") == ""


def test_public_media_serializers_never_emit_inline_base64_images():
    assert server.safe_public_media_url("data:image/png;base64,private") == ""
    assert server.safe_public_media_url("blob:https://example.com/private") == ""
    assert server.safe_public_media_url("/api/files/public.webp") == "/api/files/public.webp"
    assert server.safe_public_media_url("https://cdn.example.com/public.webp") == "https://cdn.example.com/public.webp"

    destination = {
        "_id": ObjectId(), "name": "Danau Toba", "name_en": "Lake Toba", "location": "Toba",
        "category": "nature", "description": "Deskripsi destinasi yang aman.", "description_en": "Safe description.",
        "images": ["data:image/png;base64,private", "/public.webp"], "video": "data:video/mp4;base64,private",
        "latitude": 2.61, "longitude": 98.88, "created_at": "", "is_active": True,
    }
    public = server.dest_to_out(destination)
    assert public.images == ["/public.webp"]
    assert public.video == ""
