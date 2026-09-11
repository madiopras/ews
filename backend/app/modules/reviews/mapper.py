"""Review persistence-to-API mapping."""

from typing import Any, Mapping

from app.modules.reviews.schemas import ReviewOut


def review_document_to_response(document: Mapping[str, Any]) -> ReviewOut:
    return ReviewOut(
        id=str(document["_id"]),
        destination_id=document["destination_id"],
        user_id=document["user_id"],
        user_name=document["user_name"],
        rating=document["rating"],
        comment=document["comment"],
        created_at=document["created_at"],
    )
