"""Sanitize stored planner references and hydrate current public cards."""

import logging
from datetime import datetime, timezone

from pydantic import ValidationError

from app.modules.itineraries.ports import ItineraryRepository
from app.shared.planner_result import (
    PlannerResultV2,
    PlannerStoredPartnerMatch,
    PlannerStoredResultV2,
    planner_destination_card_from_doc,
    planner_partner_match_from_doc,
)

logger = logging.getLogger(__name__)


def premium_active(document: dict) -> bool:
    until = document.get("premium_until")
    if not until:
        return False
    try:
        return datetime.fromisoformat(until) > datetime.now(timezone.utc)
    except Exception:
        return False


class PlannerResultHydrator:
    def __init__(self, repository: ItineraryRepository):
        self.repository = repository

    async def sanitize(self, result: PlannerStoredResultV2) -> PlannerStoredResultV2:
        partner_ids = [match.partner_id for match in result.partner_matches]
        partners = await self.repository.eligible_partners(partner_ids)
        partners_by_id = {str(row["_id"]): row for row in partners}
        offerings = await self.repository.active_offerings(list(partners_by_id))
        offerings_by_partner: dict[str, list[dict]] = {}
        for offering in offerings:
            offerings_by_partner.setdefault(offering["partner_id"], []).append(offering)

        valid_matches = []
        for match in result.partner_matches:
            partner = partners_by_id.get(match.partner_id)
            if not partner or partner.get("type") != match.type:
                continue
            partner_offerings = offerings_by_partner.get(match.partner_id, [])
            service_destinations = set(partner.get("destination_ids") or [])
            for offering in partner_offerings:
                service_destinations.update(offering.get("destination_ids") or [])
            if not set(match.destination_ids).issubset(service_destinations):
                continue
            valid_offerings = {
                str(offering["_id"])
                for offering in partner_offerings
                if set(offering.get("destination_ids") or []).intersection(
                    match.destination_ids
                )
            }
            valid_matches.append(
                PlannerStoredPartnerMatch(
                    partner_id=match.partner_id,
                    type=match.type,
                    destination_ids=match.destination_ids,
                    offering_ids=[
                        value
                        for value in match.offering_ids
                        if value in valid_offerings
                    ],
                    match_reasons=match.match_reasons,
                    relevance_score=match.relevance_score,
                    match_factor_codes=match.match_factor_codes,
                    placement="featured" if premium_active(partner) else "organic",
                )
            )
        return PlannerStoredResultV2(
            **{
                **result.model_dump(mode="python"),
                "partner_matches": valid_matches,
            }
        )

    async def hydrate(self, raw: dict | None) -> PlannerResultV2 | None:
        if not raw:
            return None
        try:
            stored = PlannerStoredResultV2.model_validate(raw)
        except ValidationError:
            logger.warning("Ignoring an invalid stored Planner V2 result")
            return None

        destination_documents = await self.repository.destination_cards(
            stored.destination_ids
        )
        destinations_by_id = {
            str(document["_id"]): document for document in destination_documents
        }
        destination_cards = []
        for destination_id in stored.destination_ids:
            document = destinations_by_id.get(destination_id)
            if not document:
                continue
            try:
                destination_cards.append(planner_destination_card_from_doc(document))
            except (TypeError, ValueError, ValidationError):
                continue

        sanitized = await self.sanitize(stored)
        partner_ids = [match.partner_id for match in sanitized.partner_matches]
        partners = await self.repository.eligible_partners(partner_ids)
        partners_by_id = {str(row["_id"]): row for row in partners}
        partner_matches = []
        for match in sanitized.partner_matches:
            partner = partners_by_id.get(match.partner_id)
            if not partner:
                continue
            try:
                partner_matches.append(
                    planner_partner_match_from_doc(
                        partner,
                        destination_ids=match.destination_ids,
                        offering_ids=match.offering_ids,
                        match_reasons=match.match_reasons,
                        relevance_score=match.relevance_score,
                        match_factor_codes=match.match_factor_codes,
                        placement=(
                            "featured" if premium_active(partner) else "organic"
                        ),
                        is_premium=premium_active(partner),
                    )
                )
            except (TypeError, ValueError, ValidationError):
                continue
        try:
            return PlannerResultV2(
                request_snapshot=stored.request_snapshot,
                summary=stored.summary,
                days=stored.days,
                destination_ids=stored.destination_ids,
                destinations=destination_cards,
                partner_matches=partner_matches,
                travel_notes=stored.travel_notes,
                travel_tips=stored.travel_tips,
                generated_at=stored.generated_at,
            )
        except ValidationError:
            logger.warning("Stored Planner V2 result could not be hydrated")
            return None
