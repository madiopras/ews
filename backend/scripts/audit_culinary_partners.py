"""Read-only audit for legacy Partner listings that may belong to Culinary.

This command never updates records and intentionally excludes contacts,
ownership, verification documents, and other private fields from its output.
"""

import argparse
import asyncio
import json
import re

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import load_settings

CULINARY_TERMS = (
    "kuliner",
    "makanan",
    "minuman",
    "rumah makan",
    "restoran",
    "restaurant",
    "warung",
    "kedai",
    "cafe",
    "kafe",
    "kopi",
    "coffee",
    "bakery",
    "oleh-oleh makanan",
)


def matched_terms(document: dict) -> list[str]:
    searchable = " ".join(
        [
            str(document.get("business_name") or ""),
            str(document.get("description") or ""),
            " ".join(document.get("service_tags") or []),
            " ".join(document.get("souvenir_products") or []),
        ]
    ).lower()
    return [
        term
        for term in CULINARY_TERMS
        if re.search(rf"\b{re.escape(term)}\b", searchable)
    ]


async def audit(limit: int) -> list[dict]:
    settings = load_settings()
    client = AsyncIOMotorClient(settings.mongo_url)
    try:
        documents = (
            await client[settings.db_name]
            .partners.find(
                {"type": {"$in": ["guide", "rental", "homestay", "souvenir"]}},
                {
                    "business_name": 1,
                    "type": 1,
                    "city": 1,
                    "description": 1,
                    "service_tags": 1,
                    "souvenir_products": 1,
                },
            )
            .limit(limit)
            .to_list(limit)
        )
        candidates = []
        for document in documents:
            signals = matched_terms(document)
            if signals:
                candidates.append(
                    {
                        "id": str(document["_id"]),
                        "business_name": document.get("business_name", ""),
                        "current_type": document.get("type", ""),
                        "city": document.get("city", ""),
                        "matched_terms": signals,
                        "recommended_action": "manual_review",
                    }
                )
        return candidates
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read-only Culinary Partner candidate audit"
    )
    parser.add_argument("--limit", type=int, default=1000)
    args = parser.parse_args()
    safe_limit = max(1, min(args.limit, 10_000))
    print(json.dumps(asyncio.run(audit(safe_limit)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
