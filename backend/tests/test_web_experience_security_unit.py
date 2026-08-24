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
            "is_featured": False,
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
            "is_featured": True,
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
    assert result[0]["partner"]["type"] == "souvenir"


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
            "is_featured": index == 0,
        }
        for index in range(5)
    ]

    _, result = server.build_planner_partner_recommendations(
        "Danau Toba", [target], {target_id: candidates}, [], "", "id"
    )

    expected = sorted(
        candidates,
        key=lambda partner: server.hashlib.sha256(
            f"{datetime.now(timezone.utc).date().isoformat()}:{target_id}:{partner['id']}".encode()
        ).hexdigest(),
    )[:3]
    assert [row["partner_id"] for row in result] == [row["id"] for row in expected]
    assert len(result) == 3


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
