"""Provider-agnostic contracts for structured AI Planner results.

The LLM is allowed to describe a trip and reference destination IDs from an
allowlist. Destination and partner cards are always hydrated from database
documents through the public serializers in this module.
"""

from datetime import datetime, timezone
import re
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from planner_contract import BudgetStyle


PLANNER_RESULT_VERSION = 2
PlannerResultFormat = Literal["structured"]
PlannerLanguage = Literal["id", "en"]
PlannerPeriod = Literal["morning", "afternoon", "evening", "flexible"]
PlannerPartnerType = Literal["guide", "rental", "homestay", "culinary", "souvenir"]
PlannerPlacement = Literal["organic", "featured"]
PlannerMatchFactor = Literal[
    "destination_coverage",
    "requested_service_type",
    "service_tag_match",
    "multi_destination_coverage",
]
PlannerIdentifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
PlannerTag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
PlannerImage = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
PlannerReason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
PlannerNote = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]

PLANNER_ERROR_CODES = (
    "planner_out_of_scope",
    "authentication_required",
    "guest_trial_used",
    "guest_network_limit_reached",
    "user_planner_limit_reached",
    "planner_provider_unavailable",
    "planner_empty_catalog",
    "planner_invalid_result",
    "planner_timeout",
    "planner_cancelled",
)
PlannerErrorCode = Literal[
    "planner_out_of_scope",
    "authentication_required",
    "guest_trial_used",
    "guest_network_limit_reached",
    "user_planner_limit_reached",
    "planner_provider_unavailable",
    "planner_empty_catalog",
    "planner_invalid_result",
    "planner_timeout",
    "planner_cancelled",
]

PLANNER_ERROR_MESSAGES = {
    "planner_out_of_scope": {
        "id": "AI Trip Planner hanya dapat membantu perjalanan wisata Sumatera Utara.",
        "en": "AI Trip Planner can only help with North Sumatra travel.",
    },
    "authentication_required": {
        "id": "Masuk untuk menggunakan AI Trip Planner.",
        "en": "Sign in to use AI Trip Planner.",
    },
    "guest_trial_used": {
        "id": "Rencana gratis Anda sudah digunakan. Masuk untuk membuat rencana lainnya.",
        "en": "Your free plan has been used. Sign in to create another plan.",
    },
    "guest_network_limit_reached": {
        "id": "Batas penggunaan Guest pada jaringan ini telah tercapai. Masuk untuk melanjutkan.",
        "en": "The Guest limit for this network has been reached. Sign in to continue.",
    },
    "user_planner_limit_reached": {
        "id": "Batas harian AI Trip Planner telah tercapai. Silakan coba kembali nanti.",
        "en": "The daily AI Trip Planner limit has been reached. Please try again later.",
    },
    "planner_provider_unavailable": {
        "id": "Layanan AI Trip Planner sedang tidak tersedia. Silakan coba kembali nanti.",
        "en": "AI Trip Planner is temporarily unavailable. Please try again later.",
    },
    "planner_empty_catalog": {
        "id": "Belum ada destinasi aktif yang dapat digunakan untuk membuat rencana.",
        "en": "There are no active destinations available for planning yet.",
    },
    "planner_invalid_result": {
        "id": "Rencana belum dapat disusun dengan benar. Silakan coba membuat versi lain.",
        "en": "The trip could not be structured correctly. Please try another version.",
    },
    "planner_timeout": {
        "id": "Pembuatan rencana membutuhkan waktu terlalu lama. Silakan coba kembali.",
        "en": "Trip generation took too long. Please try again.",
    },
    "planner_cancelled": {
        "id": "Pembuatan rencana dibatalkan.",
        "en": "Trip generation was cancelled.",
    },
}


def planner_safe_media_url(value: object) -> str:
    """Allow public HTTP(S) or local absolute paths; never emit inline image data."""
    candidate = str(value or "").strip()
    lowered = candidate.lower()
    if not candidate or lowered.startswith(("data:", "blob:", "javascript:")):
        return ""
    if candidate.startswith("/") and not candidate.startswith("//"):
        return candidate[:1000]
    if re.fullmatch(r"https?://[^\s]+", candidate, flags=re.IGNORECASE):
        return candidate[:1000]
    return ""


def planner_error_message(code: PlannerErrorCode, lang: str = "id") -> str:
    """Return safe copy without exposing provider or internal exception data."""
    return PLANNER_ERROR_MESSAGES[code]["en" if lang == "en" else "id"]


class PlannerContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PlannerRequestSnapshot(PlannerContractModel):
    days: int = Field(..., ge=1, le=14)
    budget_style: BudgetStyle
    interests: List[PlannerTag] = Field(default_factory=list, max_length=14)
    lang: PlannerLanguage = "id"


class PlannerStop(PlannerContractModel):
    period: PlannerPeriod = "flexible"
    time_label: str = Field(default="", max_length=40)
    destination_id: PlannerIdentifier
    activity: str = Field(..., min_length=1, max_length=600)
    practical_tip: str = Field(default="", max_length=300)


class PlannerDay(PlannerContractModel):
    day: int = Field(..., ge=1, le=14)
    title: str = Field(..., min_length=1, max_length=160)
    area_label: str = Field(default="", max_length=160)
    description: str = Field(default="", max_length=600)
    stops: List[PlannerStop] = Field(default_factory=list, min_length=1, max_length=8)


class PlannerDestinationCardOut(PlannerContractModel):
    id: PlannerIdentifier
    name: str = Field(..., min_length=1, max_length=150)
    name_en: str = Field(default="", max_length=150)
    location: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=50)
    images: List[PlannerImage] = Field(default_factory=list, max_length=10)
    description: str = Field(default="", max_length=600)
    description_en: str = Field(default="", max_length=600)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class PlannerPartnerPublicOut(PlannerContractModel):
    id: PlannerIdentifier
    business_name: str = Field(..., min_length=1, max_length=120)
    type: PlannerPartnerType
    whatsapp: Optional[str] = Field(default=None, pattern=r"^\d{8,20}$")
    city: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=600)
    image: str = Field(default="", max_length=1000)
    service_tags: List[PlannerTag] = Field(default_factory=list, max_length=20)
    is_premium: bool = False
    promotional_disclosure: Optional[Literal["unggulan_berbayar"]] = None
    accepting_contacts: bool = True

    @model_validator(mode="after")
    def consistent_public_state(self):
        if self.is_premium != (self.promotional_disclosure == "unggulan_berbayar"):
            raise ValueError("premium status and disclosure must be consistent")
        if not self.accepting_contacts and self.whatsapp is not None:
            raise ValueError("unavailable partners cannot expose a contact number")
        return self


class PlannerPartnerMatchOut(PlannerContractModel):
    partner_id: PlannerIdentifier
    type: PlannerPartnerType
    destination_ids: List[PlannerIdentifier] = Field(default_factory=list, min_length=1, max_length=20)
    offering_ids: List[PlannerIdentifier] = Field(default_factory=list, max_length=20)
    match_reasons: List[PlannerReason] = Field(default_factory=list, min_length=1, max_length=3)
    relevance_score: int = Field(default=0, ge=0, le=100)
    match_factor_codes: List[PlannerMatchFactor] = Field(default_factory=list, max_length=4)
    placement: PlannerPlacement = "organic"
    partner: PlannerPartnerPublicOut

    @model_validator(mode="after")
    def consistent_partner_identity(self):
        if self.partner.id != self.partner_id:
            raise ValueError("partner.id must match partner_id")
        if self.partner.type != self.type:
            raise ValueError("partner.type must match match type")
        if self.placement == "featured" and not self.partner.is_premium:
            raise ValueError("featured placement requires a premium partner")
        return self


class PlannerStoredPartnerMatch(PlannerContractModel):
    """Stable references saved with an itinerary; never store partner snapshots."""

    partner_id: PlannerIdentifier
    type: PlannerPartnerType
    destination_ids: List[PlannerIdentifier] = Field(default_factory=list, min_length=1, max_length=20)
    offering_ids: List[PlannerIdentifier] = Field(default_factory=list, max_length=20)
    match_reasons: List[PlannerReason] = Field(default_factory=list, min_length=1, max_length=3)
    relevance_score: int = Field(default=0, ge=0, le=100)
    match_factor_codes: List[PlannerMatchFactor] = Field(default_factory=list, max_length=4)
    placement: PlannerPlacement = "organic"


class PlannerStoredResultV2(PlannerContractModel):
    """Persisted V2 shape containing prose and IDs but no hydrated cards/contact data."""

    version: Literal[2] = PLANNER_RESULT_VERSION
    result_format: PlannerResultFormat = "structured"
    request_snapshot: PlannerRequestSnapshot
    summary: str = Field(..., min_length=1, max_length=1000)
    days: List[PlannerDay] = Field(default_factory=list, min_length=1, max_length=14)
    destination_ids: List[PlannerIdentifier] = Field(default_factory=list, min_length=1, max_length=50)
    partner_matches: List[PlannerStoredPartnerMatch] = Field(default_factory=list, max_length=20)
    travel_notes: List[PlannerNote] = Field(default_factory=list, max_length=10)
    travel_tips: List[PlannerNote] = Field(default_factory=list, max_length=10)
    generated_at: str = Field(..., max_length=40)

    @field_validator("generated_at")
    @classmethod
    def valid_generated_at(cls, value: str) -> str:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("generated_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_stored_relationships(self):
        day_numbers = [day.day for day in self.days]
        if day_numbers != list(range(1, len(day_numbers) + 1)):
            raise ValueError("days must be unique, contiguous, and start at 1")
        if any(day > self.request_snapshot.days for day in day_numbers):
            raise ValueError("result day exceeds requested duration")
        if len(self.destination_ids) != len(set(self.destination_ids)):
            raise ValueError("destination_ids must be unique")
        destination_ids = set(self.destination_ids)
        if any(
            stop.destination_id not in destination_ids
            for day in self.days
            for stop in day.stops
        ):
            raise ValueError("every stop destination must be declared in destination_ids")
        partner_ids = [match.partner_id for match in self.partner_matches]
        if len(partner_ids) != len(set(partner_ids)):
            raise ValueError("partner matches must be deduplicated")
        if any(
            not set(match.destination_ids).issubset(destination_ids)
            for match in self.partner_matches
        ):
            raise ValueError("partner match references an unknown destination")
        return self


class PlannerResultV2(PlannerContractModel):
    version: Literal[2] = PLANNER_RESULT_VERSION
    result_format: PlannerResultFormat = "structured"
    request_snapshot: PlannerRequestSnapshot
    summary: str = Field(..., min_length=1, max_length=1000)
    days: List[PlannerDay] = Field(default_factory=list, min_length=1, max_length=14)
    destination_ids: List[PlannerIdentifier] = Field(default_factory=list, min_length=1, max_length=50)
    destinations: List[PlannerDestinationCardOut] = Field(default_factory=list, max_length=50)
    partner_matches: List[PlannerPartnerMatchOut] = Field(default_factory=list, max_length=20)
    travel_notes: List[PlannerNote] = Field(default_factory=list, max_length=10)
    travel_tips: List[PlannerNote] = Field(default_factory=list, max_length=10)
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(), max_length=40)

    @field_validator("generated_at")
    @classmethod
    def valid_generated_at(cls, value: str) -> str:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("generated_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_result_relationships(self):
        day_numbers = [day.day for day in self.days]
        if day_numbers != list(range(1, len(day_numbers) + 1)):
            raise ValueError("days must be unique, contiguous, and start at 1")
        if any(day > self.request_snapshot.days for day in day_numbers):
            raise ValueError("result day exceeds requested duration")

        if len(self.destination_ids) != len(set(self.destination_ids)):
            raise ValueError("destination_ids must be unique")
        destination_ids = set(self.destination_ids)

        used_ids = {
            stop.destination_id
            for day in self.days
            for stop in day.stops
        }
        if not used_ids.issubset(destination_ids):
            raise ValueError("every stop destination must be declared in destination_ids")

        hydrated_ids = [destination.id for destination in self.destinations]
        if len(hydrated_ids) != len(set(hydrated_ids)):
            raise ValueError("destination cards must be unique")
        if not set(hydrated_ids).issubset(destination_ids):
            raise ValueError("destination cards must belong to destination_ids")

        partner_ids = [match.partner_id for match in self.partner_matches]
        if len(partner_ids) != len(set(partner_ids)):
            raise ValueError("partner matches must be deduplicated")
        for match in self.partner_matches:
            if not set(match.destination_ids).issubset(destination_ids):
                raise ValueError("partner match references an unknown destination")
        return self


def planner_stored_result_from_public(result: PlannerResultV2) -> PlannerStoredResultV2:
    """Strip all hydrated destination and partner data before persistence."""
    return PlannerStoredResultV2(
        request_snapshot=result.request_snapshot,
        summary=result.summary,
        days=result.days,
        destination_ids=result.destination_ids,
        partner_matches=[PlannerStoredPartnerMatch(
            partner_id=match.partner_id,
            type=match.type,
            destination_ids=match.destination_ids,
            offering_ids=match.offering_ids,
            match_reasons=match.match_reasons,
            relevance_score=match.relevance_score,
            match_factor_codes=match.match_factor_codes,
            placement=match.placement,
        ) for match in result.partner_matches],
        travel_notes=result.travel_notes,
        travel_tips=result.travel_tips,
        generated_at=result.generated_at,
    )


def planner_destination_card_from_doc(doc: dict) -> PlannerDestinationCardOut:
    """Create the minimal Planner destination DTO; never include price/admin fields."""
    if doc.get("is_active", True) is False:
        raise ValueError("inactive destinations cannot be exposed in Planner results")
    images = [planner_safe_media_url(value) for value in (doc.get("images") or [])]
    images = [value for value in images if value][:10]
    return PlannerDestinationCardOut(
        id=str(doc.get("_id") or doc.get("id") or ""),
        name=str(doc.get("name") or "")[:150],
        name_en=str(doc.get("name_en") or "")[:150],
        location=str(doc.get("location") or "")[:200],
        category=str(doc.get("category") or "nature")[:50],
        images=images,
        description=str(doc.get("description") or "")[:600],
        description_en=str(doc.get("description_en") or "")[:600],
        latitude=doc.get("latitude"),
        longitude=doc.get("longitude"),
    )


def planner_partner_public_from_doc(
    doc: dict,
    *,
    is_premium: Optional[bool] = None,
) -> PlannerPartnerPublicOut:
    """Create a privacy-safe partner DTO from a validated database document."""
    if doc.get("status") != "approved" or doc.get("is_active", True) is False:
        raise ValueError("only active approved partners can be exposed in Planner results")
    accepts = doc.get("accepting_contacts", True) is not False
    whatsapp = re.sub(r"\D", "", str(doc.get("whatsapp") or "")) if accepts else ""
    if not re.fullmatch(r"\d{8,20}", whatsapp):
        whatsapp = ""
    premium = bool(doc.get("is_premium", False) if is_premium is None else is_premium)
    return PlannerPartnerPublicOut(
        id=str(doc.get("_id") or doc.get("id") or ""),
        business_name=str(doc.get("business_name") or "")[:120],
        type=doc.get("type", "guide"),
        whatsapp=whatsapp or None,
        city=str(doc.get("city") or "")[:120],
        description=str(doc.get("description") or "")[:600],
        image=planner_safe_media_url(doc.get("image")),
        service_tags=[str(value)[:50] for value in (doc.get("service_tags") or []) if value][:20],
        is_premium=premium,
        promotional_disclosure="unggulan_berbayar" if premium else None,
        accepting_contacts=accepts,
    )


def planner_partner_match_from_doc(
    doc: dict,
    *,
    destination_ids: List[str],
    match_reasons: List[str],
    offering_ids: Optional[List[str]] = None,
    relevance_score: int = 0,
    match_factor_codes: Optional[List[PlannerMatchFactor]] = None,
    placement: PlannerPlacement = "organic",
    is_premium: Optional[bool] = None,
) -> PlannerPartnerMatchOut:
    """Build a validated match without accepting identity/contact data from an LLM."""
    partner = planner_partner_public_from_doc(doc, is_premium=is_premium)
    if not partner.accepting_contacts or not partner.whatsapp:
        raise ValueError("Planner matches must be available for direct contact")
    return PlannerPartnerMatchOut(
        partner_id=partner.id,
        type=partner.type,
        destination_ids=destination_ids,
        offering_ids=offering_ids or [],
        match_reasons=match_reasons,
        relevance_score=relevance_score,
        match_factor_codes=match_factor_codes or [],
        placement=placement,
        partner=partner,
    )
