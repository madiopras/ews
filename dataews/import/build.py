#!/usr/bin/env python3
"""Build dataews/import/destinations.json from instagram source + curated metadata."""
import json, os, re
from meta_data import META

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(os.path.dirname(BASE), "instagram_destinations.json")
OUT = os.path.join(BASE, "destinations.json")

# destination IDs marked as featured (exactly 9)
FEATURED = {
    "dest_0001",  # Sipiso-piso Waterfall
    "dest_0007",  # Mount Sibayak
    "dest_0009",  # Mount Sinabung
    "dest_0017",  # Lake Sidihoni
    "dest_0021",  # Tangkahan
    "dest_0026",  # Bukit Lawang
    "dest_0032",  # Maimun Palace
    "dest_0071",  # Nias Island
    "dest_0097",  # Pusuk Buhit
}

with open(SRC, encoding="utf-8") as f:
    source = json.load(f)


def clean_images(item):
    """Return deduplicated list of cloudinary image URLs (non-local)."""
    urls = []
    for u in (item.get("images") or []):
        if isinstance(u, str) and u.startswith("http"):
            urls.append(u)
    du = item.get("displayUrl")
    if isinstance(du, str) and du.startswith("http") and du not in urls:
        urls.append(du)
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


rows = []
for item in source:
    iid = item["id"]
    name_en, category, location, lat, lon, desc_id, desc_en = META[iid]
    images = clean_images(item)
    video = item.get("videoUrl") or None
    rows.append({
        "_id": iid,
        "name": item["name"],
        "name_en": name_en,
        "location": location,
        "category": category,
        "price": 0,
        "description": desc_id,
        "description_en": desc_en,
        "images": images,
        "video": video,
        "latitude": lat,
        "longitude": lon,
        "featured": iid in FEATURED,
        "created_at": item.get("timestamp"),
    })

rows.sort(key=lambda r: r["_id"])

# Validation
assert len(rows) == 100, f"expected 100 rows, got {len(rows)}"
assert len({r["_id"] for r in rows}) == 100, "duplicate _id"
feat = [r for r in rows if r["featured"]]
assert len(feat) == 9, f"featured count = {len(feat)}"
for r in rows:
    assert r["name"] and r["name_en"] and r["location"] and r["category"]
    assert r["description"] and r["description_en"]
    assert r["images"], f"{r['_id']} has no images"

with open(OUT, "w", encoding="utf-8") as f:
    raw = json.dumps(rows, ensure_ascii=False, indent=2)
    # Inject Mongo-style wrappers to match the template format
    raw = re.sub(r'"(_id)": "([^"]+)"', r'"\1": ObjectId("\2")', raw)
    raw = re.sub(r'"(created_at)": "([0-9T:.Z-]+)"', r'"\1": ISODate("\2")', raw)
    f.write(raw)

print(f"Wrote {len(rows)} destinations to {OUT}")
print(f"Featured: {[r['_id'] for r in feat]}")