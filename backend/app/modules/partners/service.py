"""Partner lifecycle, workspace authorization, and public discovery use cases."""

import hashlib
import hmac
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.modules.partners.domain import (
    EDITABLE_APPLICATION_STATUSES,
    normalize_partner_list,
    normalize_service_tags,
    normalize_whatsapp,
    partner_completeness,
    partner_draft_changes,
    premium_active,
    validate_admin_transition,
    validate_member_role,
    validate_submission,
)
from app.modules.partners.exceptions import PartnerError
from app.modules.partners.mapper import (
    gallery_to_response,
    member_to_response,
    offering_to_response,
    partner_to_admin_list_response,
    partner_to_admin_response,
    partner_to_public_response,
    partner_to_response,
    public_type_details,
    workspace_response,
)
from app.modules.partners.schemas import (
    PartnerAdminPage,
    PartnerAnalyticsEventIn,
    PartnerAvailabilityIn,
    PartnerDraftIn,
    PartnerIn,
    PartnerOfferingIn,
    PartnerOnboardingStartIn,
    PartnerOwnerAssignIn,
    PartnerPublicDetailOut,
    PartnerSelfServiceIn,
    PartnerStatusIn,
)

ADMIN_SORTS = {
    "business_name": ("business_name", 1),
    "-business_name": ("business_name", -1),
    "city": ("city", 1),
    "-city": ("city", -1),
    "type": ("type", 1),
    "-type": ("type", -1),
    "status": ("status", 1),
    "-status": ("status", -1),
    "created_at": ("created_at", 1),
    "-created_at": ("created_at", -1),
    "updated_at": ("updated_at", 1),
    "-updated_at": ("updated_at", -1),
}


@dataclass(frozen=True)
class PartnerFile:
    data: bytes
    content_type: str
    filename: str


class PartnerService:
    def __init__(
        self,
        repository: Any,
        *,
        analytics_secret: str,
        storage: Any = None,
        notifications: Any = None,
    ):
        self.repository = repository
        self.analytics_secret = analytics_secret
        self.storage = storage
        self.notifications = notifications

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    async def _feature(self, name: str, user: dict) -> None:
        settings = await self.repository.general_settings()
        enabled = bool(settings.get(f"{name}_enabled", True))
        percentage = max(
            0, min(100, int(settings.get(f"{name}_rollout_percentage", 100)))
        )
        if not enabled:
            allowed = False
        elif name == "mitra_dashboard" and await self.repository.has_active_membership(
            user["id"]
        ):
            allowed = True
        elif user.get("role") == "admin":
            allowed = True
        elif percentage >= 100:
            allowed = enabled
        elif percentage <= 0:
            allowed = False
        else:
            digest = hashlib.sha256(
                f"ews-rollout-v1:{name}:{user['id']}".encode()
            ).digest()
            allowed = enabled and int.from_bytes(digest[:4], "big") % 100 < percentage
        if not allowed:
            raise PartnerError(
                403,
                {
                    "code": "feature_not_available",
                    "feature": name,
                    "message": "This feature is not available for this account yet.",
                },
            )

    async def _destinations(self, values: list[str], active_only: bool) -> None:
        if not await self.repository.destinations_exist(values, active_only):
            raise PartnerError(
                400, "One or more destinations do not exist or are inactive"
            )

    async def _access(
        self,
        partner_id: str,
        user: dict,
        allowed: tuple[str, ...] = ("owner", "staff"),
    ) -> tuple[dict, str]:
        partner = await self.repository.get(partner_id)
        if partner is None:
            raise PartnerError(404, "Partner not found")
        if user.get("role") == "admin":
            return partner, "admin"
        membership = await self.repository.membership(partner_id, user["id"])
        role = membership.get("role") if membership else None
        if not role and partner.get("owner_user_id") == user["id"]:
            role = "owner"
            await self.repository.upsert_membership(
                partner_id, user["id"], "owner", self._now()
            )
        validate_member_role(role, allowed)
        return partner, role

    async def _workspace(self, partner: dict, role: str):
        partner_id = str(partner["_id"])
        memberships = await self.repository.active_memberships(partner_id)
        users = await self.repository.users_by_ids(
            [membership["user_id"] for membership in memberships]
        )
        members = [
            member_to_response(item, users.get(item["user_id"], {}))
            for item in memberships
        ]
        count = await self.repository.offering_count(partner_id)
        return workspace_response(partner, role, members, count)

    @staticmethod
    def _input_changes(payload: PartnerIn) -> dict:
        changes = payload.model_dump(mode="json")
        for field in ("business_name", "description", "city"):
            changes[field] = getattr(payload, field).strip()
        changes["address"] = (payload.address or "").strip()
        changes["service_tags"] = normalize_service_tags(payload.service_tags)
        for field, length in (
            ("culinary_categories", 80),
            ("culinary_specialties", 120),
            ("culinary_service_modes", 50),
            ("culinary_dietary_tags", 50),
        ):
            changes[field] = normalize_partner_list(getattr(payload, field), length)
        changes["culinary_opening_info"] = payload.culinary_opening_info.strip()
        changes["culinary_reservation_note"] = payload.culinary_reservation_note.strip()
        return changes

    @classmethod
    def _draft_changes(cls, payload: PartnerDraftIn) -> dict:
        return partner_draft_changes(payload, cls._now())

    async def register(self, payload: PartnerIn, user: dict):
        await self._feature("mitra_onboarding", user)
        await self._destinations(payload.destination_ids, True)
        now = self._now()
        settings = await self.repository.general_settings()
        document = self._input_changes(payload)
        document.update(
            {
                "whatsapp": normalize_whatsapp(payload.whatsapp),
                "status": "pending",
                "is_active": False,
                "owner_user_id": user["id"],
                "ownership_status": "claimed",
                "verification_documents": [],
                "approval_history": [],
                "created_at": now,
                "updated_at": now,
                "submitted_at": now,
                "review_due_at": (
                    datetime.now(timezone.utc)
                    + timedelta(days=settings.get("partner_review_sla_days", 2))
                ).isoformat(),
            }
        )
        created = await self.repository.insert(document)
        await self.repository.upsert_membership(
            str(created["_id"]), user["id"], "owner", now
        )
        return partner_to_response(created)

    async def start_onboarding(self, payload: PartnerOnboardingStartIn, user: dict):
        await self._feature("mitra_onboarding", user)
        now = self._now()
        document = {
            "business_name": "",
            "type": payload.type,
            "whatsapp": "",
            "description": "",
            "city": "",
            "email": user.get("email"),
            "address": "",
            "destination_ids": [],
            "service_tags": [],
            "image": "",
            "gallery": [],
            "status": "draft",
            "is_active": False,
            "owner_user_id": user["id"],
            "ownership_status": "claimed",
            "verification_documents": [],
            "approval_history": [],
            "current_step": 1,
            "revision_note": "",
            "created_at": now,
            "updated_at": now,
        }
        for field in (
            "culinary_categories",
            "culinary_specialties",
            "culinary_service_modes",
            "culinary_dietary_tags",
        ):
            document[field] = []
        document.update({"culinary_opening_info": "", "culinary_reservation_note": ""})
        created = await self.repository.insert(document)
        await self.repository.upsert_membership(
            str(created["_id"]), user["id"], "owner", now
        )
        return await self._workspace(created, "owner")

    async def list_mine(self, user: dict):
        await self._feature("mitra_dashboard", user)
        memberships = await self.repository.my_memberships(user["id"])
        ids, roles = [], {}
        for membership in memberships:
            try:
                oid = self.repository.object_id(membership["partner_id"])
            except PartnerError:
                continue
            ids.append(oid)
            roles[membership["partner_id"]] = membership.get("role", "staff")
        for oid in await self.repository.owned_partner_ids(user["id"]):
            if oid not in ids:
                ids.append(oid)
                roles[str(oid)] = "owner"
        documents = await self.repository.partners_by_ids(ids)
        return [
            await self._workspace(item, roles.get(str(item["_id"]), "staff"))
            for item in documents
        ]

    async def get_mine(self, partner_id: str, user: dict):
        partner, role = await self._access(partner_id, user)
        return await self._workspace(partner, role)

    async def save_draft(self, partner_id: str, payload: PartnerDraftIn, user: dict):
        partner, role = await self._access(partner_id, user)
        if (
            role != "admin"
            and partner.get("status", "draft") not in EDITABLE_APPLICATION_STATUSES
        ):
            raise PartnerError(
                409,
                "Submitted applications cannot be edited until revision is requested",
            )
        await self._destinations(payload.destination_ids, True)
        updated = await self.repository.update(partner_id, self._draft_changes(payload))
        return await self._workspace(updated, role)

    async def submit(self, partner_id: str, user: dict, resubmission: bool):
        partner, role = await self._access(partner_id, user, ("owner",))
        allowed = (
            {"needs_revision", "rejected"}
            if resubmission
            else EDITABLE_APPLICATION_STATUSES
        )
        if role != "admin" and partner.get("status", "draft") not in allowed:
            raise PartnerError(
                409, "Partner application cannot be submitted in its current state"
            )
        validate_submission(partner)
        await self._destinations(partner.get("destination_ids", []), True)
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        settings = await self.repository.general_settings()
        event = {
            "status": "pending",
            "event": "resubmitted" if resubmission else "submitted",
            "actor_user_id": user["id"],
            "actor_role": role,
            "reviewed_at": now,
        }
        updated = await self.repository.update(
            partner_id,
            {
                "status": "pending",
                "is_active": False,
                "submitted_at": now,
                "review_due_at": (
                    now_dt + timedelta(days=settings.get("partner_review_sla_days", 2))
                ).isoformat(),
                "revision_note": "",
                "current_step": 4,
                "updated_at": now,
            },
            {"approval_history": event},
        )
        return await self._workspace(updated, role)

    async def add_staff(self, partner_id: str, email: str, user: dict):
        partner, role = await self._access(partner_id, user, ("owner",))
        member = await self.repository.user_by_email(email)
        if member is None:
            raise PartnerError(
                404, "User must register before being added as partner staff"
            )
        member_id = str(member["_id"])
        if member_id == partner.get("owner_user_id"):
            raise PartnerError(409, "Partner owner is already a member")
        await self.repository.upsert_membership(
            partner_id, member_id, "staff", self._now()
        )
        return await self._workspace(partner, role)

    async def remove_staff(self, partner_id: str, member_user_id: str, user: dict):
        partner, role = await self._access(partner_id, user, ("owner",))
        membership = await self.repository.membership(partner_id, member_user_id)
        if not membership or membership.get("role") != "staff":
            raise PartnerError(404, "Partner staff membership not found")
        await self.repository.remove_membership(
            partner_id, member_user_id, self._now(), role="staff"
        )
        return await self._workspace(partner, role)

    async def update_profile(
        self, partner_id: str, payload: PartnerSelfServiceIn, user: dict
    ):
        partner, role = await self._access(partner_id, user)
        if partner.get("status") != "approved":
            raise PartnerError(
                409, "Only approved partner profiles can use self-service editing"
            )
        if payload.type != partner.get("type"):
            raise PartnerError(400, "Partner type cannot be changed after approval")
        await self._destinations(payload.destination_ids, True)
        changes = self._draft_changes(payload)
        changes.pop("type", None)
        changes.pop("current_step", None)
        changes["last_profile_reviewed_at"] = changes["updated_at"]
        validate_submission({**partner, **changes})
        updated = await self.repository.update(partner_id, changes)
        return await self._workspace(updated, role)

    async def availability(
        self, partner_id: str, payload: PartnerAvailabilityIn, user: dict
    ):
        partner, role = await self._access(partner_id, user)
        if partner.get("status") != "approved":
            raise PartnerError(
                409, "Only approved partners can update contact availability"
            )
        changes = {
            "accepting_contacts": payload.accepting_contacts,
            "contact_status_note": payload.contact_status_note.strip(),
            "updated_at": self._now(),
        }
        return await self._workspace(
            await self.repository.update(partner_id, changes), role
        )

    async def confirm_freshness(self, partner_id: str, user: dict):
        partner, role = await self._access(partner_id, user)
        if partner.get("status") != "approved":
            raise PartnerError(409, "Only approved partner profiles can be reviewed")
        now = self._now()
        updated = await self.repository.update(
            partner_id, {"last_profile_reviewed_at": now, "updated_at": now}
        )
        return await self._workspace(updated, role)

    async def list_offerings(self, partner_id: str, user: dict):
        await self._access(partner_id, user)
        return [
            offering_to_response(document)
            for document in await self.repository.offerings_for(partner_id)
        ]

    @staticmethod
    def _offering_changes(payload: PartnerOfferingIn, user_id: str) -> dict:
        changes = payload.model_dump(mode="json")
        changes.update(
            {
                "name": payload.name.strip(),
                "description": payload.description.strip(),
                "ai_tags": normalize_service_tags(payload.ai_tags),
                "service_areas": normalize_partner_list(payload.service_areas, 100),
                "availability_note": payload.availability_note.strip(),
                "updated_at": PartnerService._now(),
                "updated_by": user_id,
            }
        )
        return changes

    async def create_offering(
        self, partner_id: str, payload: PartnerOfferingIn, user: dict
    ):
        partner, _ = await self._access(partner_id, user)
        if partner.get("status") != "approved":
            raise PartnerError(
                409, "Offerings can only be published for approved partners"
            )
        await self._destinations(payload.destination_ids, True)
        now = self._now()
        document = {
            **self._offering_changes(payload, user["id"]),
            "partner_id": partner_id,
            "created_at": now,
            "updated_at": now,
        }
        created = await self.repository.insert_offering(document)
        await self.repository.update(partner_id, {"updated_at": now})
        return offering_to_response(created)

    async def update_offering(
        self,
        partner_id: str,
        offering_id: str,
        payload: PartnerOfferingIn,
        user: dict,
    ):
        partner, _ = await self._access(partner_id, user)
        if partner.get("status") != "approved":
            raise PartnerError(
                409, "Offerings can only be edited for approved partners"
            )
        if await self.repository.get_offering(partner_id, offering_id) is None:
            raise PartnerError(404, "Offering not found")
        await self._destinations(payload.destination_ids, True)
        updated = await self.repository.update_offering(
            partner_id,
            offering_id,
            self._offering_changes(payload, user["id"]),
        )
        return offering_to_response(updated)

    async def delete_offering(
        self, partner_id: str, offering_id: str, user: dict
    ) -> dict[str, bool]:
        await self._access(partner_id, user)
        if not await self.repository.delete_offering(partner_id, offering_id):
            raise PartnerError(404, "Offering not found")
        return {"ok": True}

    async def insights(self, partner_id: str, days: int, user: dict) -> dict:
        partner, _ = await self._access(partner_id, user)
        days = max(7, min(days, 365))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        counts = {
            event: await self.repository.insight_count(partner_id, event, since)
            for event in ("ai_impression", "profile_view", "whatsapp_click")
        }
        counts["offerings"] = await self.repository.offering_count(partner_id)
        completeness, missing = partner_completeness(partner, counts["offerings"])
        return {
            "days": days,
            "counts": counts,
            "profile_completeness": completeness,
            "completeness_missing": missing,
        }

    @staticmethod
    def _sort_public(documents: list[dict]) -> list[dict]:
        salt = datetime.now(timezone.utc).date().isoformat()
        premium = [item for item in documents if premium_active(item)]
        regular = [item for item in documents if not premium_active(item)]

        def key(item: dict) -> str:
            return hashlib.sha256(f"{salt}:{item['_id']}".encode()).hexdigest()

        premium.sort(key=key)
        regular.sort(key=key)
        result = []
        while premium or regular:
            if premium:
                result.append(premium.pop(0))
            if regular:
                result.append(regular.pop(0))
        return result

    async def list_public(self, destination_id: str | None, partner_type: str | None):
        documents = await self.repository.list_public(destination_id, partner_type)
        return [
            partner_to_public_response(item) for item in self._sort_public(documents)
        ]

    async def public_detail(self, partner_id: str):
        partner = await self.repository.get_public(partner_id)
        if partner is None:
            raise PartnerError(404, "Partner not found")
        offerings = await self.repository.offerings_for(partner_id, True)
        destinations = await self.repository.public_destinations(
            partner.get("destination_ids", [])
        )
        return PartnerPublicDetailOut(
            **partner_to_public_response(partner).model_dump(),
            gallery=gallery_to_response(partner.get("gallery", [])),
            offerings=[offering_to_response(item) for item in offerings],
            destinations=[
                {
                    "id": str(item["_id"]),
                    "name": item.get("name", ""),
                    "name_en": item.get("name_en", ""),
                    "location": item.get("location", ""),
                }
                for item in destinations
            ],
            type_details=public_type_details(partner),
            last_profile_reviewed_at=partner.get("last_profile_reviewed_at")
            or partner.get("updated_at"),
        )

    async def track_event(
        self,
        payload: PartnerAnalyticsEventIn,
        consent: bool,
        user: dict | None,
    ) -> dict:
        if not consent:
            return {"accepted": False, "reason": "consent_required"}
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,80}", payload.event_id):
            raise PartnerError(400, "Invalid event id")
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,80}", payload.anonymous_session_id):
            raise PartnerError(400, "Invalid anonymous session id")
        partner = await self.repository.get_public(payload.partner_id)
        if partner is None:
            raise PartnerError(404, "Partner not found")
        destination_area = ""
        if payload.destination_id:
            self.repository.object_id(payload.destination_id, "Invalid destination id")
            destinations = await self.repository.public_destinations(
                [payload.destination_id]
            )
            if not destinations:
                raise PartnerError(404, "Destination not found")
            destination_area = str(destinations[0].get("location") or "")[:120]
        anonymous_hash = hmac.new(
            self.analytics_secret.encode(),
            payload.anonymous_session_id.encode(),
            hashlib.sha256,
        ).hexdigest()
        premium = premium_active(partner)
        created = await self.repository.insert_analytics(
            {
                "event_id": payload.event_id,
                "event_type": payload.event_type,
                "partner_id": payload.partner_id,
                "source": payload.source,
                "destination_id": payload.destination_id,
                "destination_area": destination_area,
                "partner_type": partner.get("type", ""),
                "tier": "featured" if premium else "regular",
                "has_image": bool(partner.get("image") or partner.get("gallery")),
                "placement": (
                    "featured"
                    if payload.source == "planner"
                    and payload.placement == "featured"
                    and premium
                    else "organic" if payload.source == "planner" else None
                ),
                "relevance_score": (
                    payload.relevance_score if payload.source == "planner" else None
                ),
                "match_factor_codes": (
                    payload.match_factor_codes if payload.source == "planner" else []
                ),
                "anonymous_id_hash": anonymous_hash,
                "user_id": user.get("id") if user else None,
                "created_at": self._now(),
            }
        )
        return {"accepted": True, "duplicate": not created}

    async def create_admin(self, payload: PartnerIn, admin: dict):
        await self._destinations(payload.destination_ids, False)
        now = self._now()
        document = {
            **self._input_changes(payload),
            "whatsapp": normalize_whatsapp(payload.whatsapp),
            "status": "pending",
            "is_active": False,
            "ownership_status": "unclaimed",
            "verification_documents": [],
            "approval_history": [],
            "created_at": now,
            "updated_at": now,
        }
        created = await self.repository.insert(document)
        await self.repository.audit(
            admin,
            "create",
            str(created["_id"]),
            {"business_name": created["business_name"]},
            now,
        )
        return partner_to_admin_response(created)

    async def list_admin(self):
        return [
            partner_to_admin_response(item) for item in await self.repository.list_all()
        ]

    async def admin_page(
        self,
        *,
        query_text: str,
        partner_type: str | None,
        approval: str,
        status: str,
        premium: bool | None,
        destination_id: str | None,
        page: int,
        page_size: int,
        sort: str,
    ):
        page, page_size = max(1, page), max(1, min(page_size, 100))
        clauses = []
        search = query_text.strip()[:100]
        if search:
            pattern = re.escape(search)
            clauses.append(
                {
                    "$or": [
                        {field: {"$regex": pattern, "$options": "i"}}
                        for field in ("business_name", "city", "email", "whatsapp")
                    ]
                }
            )
        if partner_type:
            clauses.append({"type": partner_type})
        if approval != "all":
            clauses.append({"status": approval})
        if status == "active":
            clauses.append({"is_active": {"$ne": False}})
        elif status == "inactive":
            clauses.append({"is_active": False})
        if destination_id:
            self.repository.object_id(destination_id, "Invalid destination id")
            clauses.append({"destination_ids": destination_id})
        if premium is not None:
            now = self._now()
            clauses.append(
                {"premium_until": {"$gt": now}}
                if premium
                else {
                    "$or": [
                        {"premium_until": {"$exists": False}},
                        {"premium_until": None},
                        {"premium_until": {"$lte": now}},
                    ]
                }
            )
        if sort not in ADMIN_SORTS:
            raise PartnerError(400, "Invalid sort field")
        field, direction = ADMIN_SORTS[sort]
        documents, total = await self.repository.page(
            {"$and": clauses} if clauses else {},
            field,
            direction,
            (page - 1) * page_size,
            page_size,
        )
        return PartnerAdminPage(
            items=[partner_to_admin_list_response(item) for item in documents],
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size,
        )

    async def get_admin(self, partner_id: str):
        partner = await self.repository.get(partner_id, "Invalid id")
        if partner is None:
            raise PartnerError(404, "Partner not found")
        return partner_to_admin_response(partner)

    async def update_admin(self, partner_id: str, payload: PartnerIn, admin: dict):
        if await self.repository.get(partner_id, "Invalid id") is None:
            raise PartnerError(404, "Not found")
        await self._destinations(payload.destination_ids, False)
        changes = {
            **self._input_changes(payload),
            "whatsapp": normalize_whatsapp(payload.whatsapp),
            "updated_at": self._now(),
        }
        updated = await self.repository.update(partner_id, changes)
        await self.repository.audit(
            admin,
            "update",
            partner_id,
            {"business_name": updated.get("business_name", "")},
            self._now(),
        )
        return partner_to_admin_response(updated)

    async def assign_owner(
        self, partner_id: str, payload: PartnerOwnerAssignIn, admin: dict
    ):
        partner = await self.repository.get(partner_id)
        if partner is None:
            raise PartnerError(404, "Partner not found")
        owner = await self.repository.user_by_email(str(payload.email))
        if owner is None:
            raise PartnerError(404, "Registered user not found")
        owner_id, now = str(owner["_id"]), self._now()
        previous = partner.get("owner_user_id")
        if previous and previous != owner_id:
            await self.repository.remove_membership(
                partner_id, previous, now, role="owner"
            )
        await self.repository.upsert_membership(partner_id, owner_id, "owner", now)
        updated = await self.repository.update(
            partner_id,
            {
                "owner_user_id": owner_id,
                "ownership_status": "claimed",
                "ownership_migrated_at": now,
                "updated_at": now,
            },
        )
        await self.repository.audit(
            admin,
            "assign_owner",
            partner_id,
            {"owner_user_id": owner_id, "owner_email": owner.get("email", "")},
            now,
        )
        return partner_to_admin_response(updated)

    async def toggle(self, partner_id: str, admin: dict):
        updated = await self.repository.toggle(partner_id, self._now())
        if updated is None:
            raise PartnerError(404, "Not found")
        await self.repository.audit(
            admin,
            "activate" if updated.get("is_active") else "deactivate",
            partner_id,
            {"business_name": updated.get("business_name", "")},
            self._now(),
        )
        return partner_to_admin_response(updated)

    async def status(self, partner_id: str, payload: PartnerStatusIn, admin: dict):
        current = await self.repository.get(partner_id, "Invalid id")
        if current is None:
            raise PartnerError(404, "Not found")
        note = payload.revision_note.strip()
        validate_admin_transition(current.get("status", "draft"), payload.status, note)
        now = self._now()
        history = {
            "status": payload.status,
            "event": "admin_review",
            "reviewed_by": admin["id"],
            "reviewer_email": admin.get("email", ""),
            "reviewed_at": now,
            "revision_note": note,
        }
        updated = await self.repository.update(
            partner_id,
            {
                "status": payload.status,
                "reviewed_by": admin["id"],
                "reviewed_at": now,
                "updated_at": now,
                "is_active": payload.status == "approved",
                "revision_note": (
                    note if payload.status in {"needs_revision", "rejected"} else ""
                ),
            },
            {"approval_history": history},
        )
        owner_id = updated.get("owner_user_id")
        if payload.status == "approved" and owner_id:
            try:
                await self.repository.set_user_partner_role(owner_id, now)
                await self.repository.upsert_membership(
                    partner_id, owner_id, "owner", now
                )
            except Exception:
                pass
        if self.notifications:
            owner = None
            if owner_id:
                owner = (await self.repository.users_by_ids([owner_id])).get(owner_id)
            await self.notifications.status_changed(
                updated, owner, payload.status, note
            )
        await self.repository.audit(
            admin,
            "status_change",
            partner_id,
            {
                "status": payload.status,
                "business_name": updated.get("business_name", ""),
            },
            now,
        )
        return partner_to_admin_response(updated)

    async def delete(self, partner_id: str, admin: dict) -> dict[str, bool]:
        deleted = await self.repository.delete_cascade(partner_id)
        if deleted is None:
            raise PartnerError(404, "Not found")
        paths = [
            item.get("storage_path", "")
            for field in ("verification_documents", "gallery")
            for item in deleted.get(field, [])
            if item.get("storage_path")
        ]
        await self.repository.audit(
            admin,
            "delete",
            partner_id,
            {"business_name": deleted.get("business_name", "")},
            self._now(),
        )
        if self.storage:
            for path in paths:
                try:
                    await self.storage.delete(path)
                except Exception:
                    continue
        return {"ok": True}

    def _storage_required(self):
        if self.storage is None:
            raise RuntimeError("Partner storage gateway is not configured")

    async def upload_document(
        self,
        partner_id: str,
        document_type: str,
        filename: str,
        content_type: str | None,
        data: bytes,
        user: dict,
    ):
        self._storage_required()
        partner, role = await self._access(partner_id, user)
        if (
            role != "admin"
            and partner.get("status", "draft") not in EDITABLE_APPLICATION_STATUSES
        ):
            raise PartnerError(
                409, "Documents are locked while the application is under review"
            )
        document_type = document_type.lower().strip()
        mime = {
            "pdf": "application/pdf",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
        }
        if document_type not in {"ktp", "siup", "npwp", "other"}:
            raise PartnerError(400, "Invalid document type")
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in mime:
            raise PartnerError(400, "Only PDF, JPG, JPEG, or PNG documents are allowed")
        expected = mime[ext]
        if content_type and content_type.lower() != expected:
            raise PartnerError(400, "File content type does not match its extension")
        if not data:
            raise PartnerError(400, "Document is empty")
        if len(data) > 5 * 1024 * 1024:
            raise PartnerError(400, "Maximum document size is 5MB")
        valid = {
            "pdf": data.startswith(b"%PDF-"),
            "jpg": data.startswith(b"\xff\xd8\xff"),
            "jpeg": data.startswith(b"\xff\xd8\xff"),
            "png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        }[ext]
        if not valid:
            raise PartnerError(
                400, "File content is not a valid document of the declared type"
            )
        if len(partner.get("verification_documents", [])) >= 12:
            raise PartnerError(400, "Maximum 12 verification documents per partner")
        item_id = uuid.uuid4().hex
        path = f"{self.storage.app_name}/verification/{partner_id}/{item_id}.{ext}"
        await self.storage.put(path, data, expected)
        now = self._now()
        metadata = {
            "id": item_id,
            "document_type": document_type,
            "filename": filename[:200],
            "content_type": expected,
            "size": len(data),
            "storage_path": path,
            "uploaded_at": now,
            "uploaded_by": user["id"],
        }
        updated = await self.repository.add_embedded(
            partner_id, "verification_documents", metadata, {"updated_at": now}
        )
        await self.repository.record_file(
            {**metadata, "partner_id": partner_id, "sensitive": True}
        )
        if user.get("role") == "admin":
            await self.repository.audit(
                user,
                "document_upload",
                partner_id,
                {"document_type": document_type, "filename": metadata["filename"]},
                now,
            )
        return partner_to_admin_response(updated)

    async def download_document(
        self, partner_id: str, document_id: str, user: dict
    ) -> PartnerFile:
        self._storage_required()
        partner, _ = await self._access(partner_id, user)
        document = next(
            (
                item
                for item in partner.get("verification_documents", [])
                if item.get("id") == document_id
            ),
            None,
        )
        if not document:
            raise PartnerError(404, "Document not found")
        try:
            data, content_type = await self.storage.get(document["storage_path"])
        except Exception as error:
            raise PartnerError(404, "Document file not found") from error
        filename = "".join(
            character
            for character in document.get("filename", "document")
            if character.isalnum() or character in ".-_"
        )
        return PartnerFile(data, content_type, filename or "document")

    async def delete_document(self, partner_id: str, document_id: str, user: dict):
        self._storage_required()
        partner, role = await self._access(partner_id, user)
        if (
            role != "admin"
            and partner.get("status", "draft") not in EDITABLE_APPLICATION_STATUSES
        ):
            raise PartnerError(
                409, "Documents are locked while the application is under review"
            )
        document = next(
            (
                item
                for item in partner.get("verification_documents", [])
                if item.get("id") == document_id
            ),
            None,
        )
        if not document:
            raise PartnerError(404, "Document not found")
        await self.storage.delete(document["storage_path"])
        now = self._now()
        updated = await self.repository.remove_embedded(
            partner_id, "verification_documents", document_id, {"updated_at": now}
        )
        await self.repository.delete_file_record(document["storage_path"])
        if user.get("role") == "admin":
            await self.repository.audit(
                user,
                "document_delete",
                partner_id,
                {
                    "document_type": document.get("document_type", ""),
                    "filename": document.get("filename", ""),
                },
                now,
            )
        return partner_to_admin_response(updated)

    async def upload_gallery(
        self,
        partner_id: str,
        filename: str,
        content_type: str | None,
        data: bytes,
        user: dict,
    ):
        self._storage_required()
        partner, role = await self._access(partner_id, user)
        if role != "admin" and partner.get("status", "draft") not in {
            *EDITABLE_APPLICATION_STATUSES,
            "approved",
        }:
            raise PartnerError(
                409, "Gallery is locked while the application is under review"
            )
        if len(partner.get("gallery", [])) >= 8:
            raise PartnerError(400, "Maximum 8 gallery images per partner")
        mime = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
        }
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in mime:
            raise PartnerError(400, "Only JPG, PNG, or WEBP gallery images are allowed")
        expected = mime[ext]
        if content_type and content_type.lower() != expected:
            raise PartnerError(400, "File content type does not match its extension")
        if not data:
            raise PartnerError(400, "Image is empty")
        if len(data) > 8 * 1024 * 1024:
            raise PartnerError(400, "Maximum gallery image size is 8MB")
        valid = (
            (ext in {"jpg", "jpeg"} and data.startswith(b"\xff\xd8\xff"))
            or (ext == "png" and data.startswith(b"\x89PNG\r\n\x1a\n"))
            or (
                ext == "webp"
                and len(data) >= 12
                and data.startswith(b"RIFF")
                and data[8:12] == b"WEBP"
            )
        )
        if not valid:
            raise PartnerError(
                400, "File content is not a valid image of the declared type"
            )
        image_id = uuid.uuid4().hex
        path = f"{self.storage.app_name}/partner-gallery/{partner_id}/{image_id}.{ext}"
        await self.storage.put(path, data, expected)
        now = self._now()
        metadata = {
            "id": image_id,
            "filename": filename[:200],
            "content_type": expected,
            "size": len(data),
            "storage_path": path,
            "uploaded_at": now,
            "uploaded_by": user["id"],
        }
        changes = {"updated_at": now, "last_profile_reviewed_at": now}
        if not partner.get("image"):
            changes["image"] = f"/api/files/{path}"
        updated = await self.repository.add_embedded(
            partner_id, "gallery", metadata, changes
        )
        await self.repository.record_file(
            {**metadata, "partner_id": partner_id, "sensitive": False}
        )
        return await self._workspace(updated, role)

    async def delete_gallery(self, partner_id: str, image_id: str, user: dict):
        self._storage_required()
        partner, role = await self._access(partner_id, user)
        if role != "admin" and partner.get("status", "draft") not in {
            *EDITABLE_APPLICATION_STATUSES,
            "approved",
        }:
            raise PartnerError(
                409, "Gallery is locked while the application is under review"
            )
        image = next(
            (item for item in partner.get("gallery", []) if item.get("id") == image_id),
            None,
        )
        if not image:
            raise PartnerError(404, "Gallery image not found")
        await self.storage.delete(image.get("storage_path", ""))
        remaining = [
            item for item in partner.get("gallery", []) if item.get("id") != image_id
        ]
        now = self._now()
        changes = {"updated_at": now, "last_profile_reviewed_at": now}
        if partner.get("image") == f"/api/files/{image.get('storage_path', '')}":
            changes["image"] = (
                f"/api/files/{remaining[0]['storage_path']}" if remaining else ""
            )
        updated = await self.repository.remove_embedded(
            partner_id, "gallery", image_id, changes
        )
        await self.repository.delete_file_record(image.get("storage_path", ""))
        return await self._workspace(updated, role)
