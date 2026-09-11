"""Administration, governance, configuration, and operational use cases."""

import asyncio
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import Settings
from app.modules.administration.domain import (
    date_range,
    destination_quality,
    feature_decision,
    governance_fairness_summary,
    governance_item,
    paged,
    pagination,
    planner_health_summary,
    redact,
    role_preview,
)
from app.modules.administration.exceptions import AdministrationError
from app.modules.administration.mapper import (
    admin_user,
    admin_user_page,
    ai_log,
    audit_log,
    email_template,
    llm_profile,
    notification_rows,
    page_of,
    system_log,
)
from app.modules.administration.schemas import (
    AdminUserUpdate,
    ContentReportIn,
    EditorialWorkflowIn,
    EmailTemplateIn,
    GeneralSettingsIn,
    LlmProfileCreateIn,
    LlmProfileUpdateIn,
    ModerationActionIn,
)
from app.modules.destinations.mapper import destination_document_to_response
from app.modules.partners.domain import partner_completeness, premium_active
from app.modules.partners.mapper import (
    gallery_to_response,
    offering_to_response,
    partner_to_public_response,
    public_type_details,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_general_settings(settings: Settings) -> dict:
    return {
        "site_name": settings.site_name,
        "support_email": settings.admin_email,
        "default_language": "id",
        "maintenance_mode": False,
        "partner_review_sla_days": 2,
        "planner_enabled": True,
        "planner_guest_trial_enabled": True,
        "planner_guest_generation_limit": 1,
        "planner_guest_identity_ttl_days": 180,
        "planner_guest_ip_daily_limit": 20,
        "planner_authenticated_daily_limit": 20,
        "planner_generation_cooldown_seconds": 5,
        "planner_result_cards_enabled": False,
        "planner_result_cards_rollout_percentage": 0,
        "planner_structured_results_enabled": False,
        "planner_structured_rollout_percentage": 0,
        "planner_culinary_enabled": False,
        "planner_culinary_rollout_percentage": 0,
        "planner_partner_matches_enabled": False,
        "planner_partner_matches_rollout_percentage": 0,
        "mitra_onboarding_enabled": True,
        "mitra_onboarding_rollout_percentage": 100,
        "mitra_dashboard_enabled": True,
        "mitra_dashboard_rollout_percentage": 100,
        "backup_retention_days": 30,
    }


class AuditService:
    def __init__(self, repository: Any, settings: Settings):
        self.repository = repository
        self.settings = settings

    def _secrets(self) -> list[str]:
        return [
            self.settings.jwt_secret.get_secret_value(),
            self.settings.admin_password.get_secret_value(),
            self.settings.mongo_url,
            self.settings.llm_api_key.get_secret_value(),
            self.settings.emergent_llm_key.get_secret_value(),
            self.settings.midtrans_server_key.get_secret_value(),
            self.settings.midtrans_server_key_production.get_secret_value(),
            self.settings.midtrans_client_key,
            self.settings.midtrans_client_key_production,
            self.settings.google_client_secret.get_secret_value(),
            self.settings.redis_url.get_secret_value(),
        ]

    async def audit(
        self,
        actor: dict,
        action: str,
        entity_type: str,
        entity_id: str,
        details: dict | None = None,
    ) -> None:
        await self.repository.audit(
            actor, action, entity_type, entity_id, details or {}, now_iso()
        )

    async def system(
        self, level: str, source: str, message: str, details: dict | None = None
    ) -> None:
        secrets = self._secrets()
        await self.repository.system(
            level,
            source,
            redact(message, secrets),
            redact(details or {}, secrets),
            now_iso(),
        )


class DashboardService:
    def __init__(self, repository: Any):
        self.repository = repository

    async def read(self) -> dict:
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        counts, recent = await self.repository.snapshot(since)
        (
            destinations_total,
            destinations_active,
            partners_total,
            partners_active,
            partners_approved,
            partners_pending,
            users_total,
            users_active,
            users_new,
            itineraries_total,
            planner_requests,
            planner_errors,
        ) = counts
        return {
            "destinations": {
                "total": destinations_total,
                "active": destinations_active,
            },
            "partners": {
                "total": partners_total,
                "active": partners_active,
                "approved": partners_approved,
                "pending": partners_pending,
            },
            "users": {
                "total": users_total,
                "active": users_active,
                "new_30d": users_new,
            },
            "itineraries": {"total": itineraries_total},
            "planner": {
                "requests_30d": planner_requests,
                "errors_30d": planner_errors,
            },
            "recent_activity": [audit_log(row) for row in recent],
        }


class AdminUserService:
    SORTS = {
        "name": ("name", 1),
        "-name": ("name", -1),
        "email": ("email", 1),
        "-email": ("email", -1),
        "role": ("role", 1),
        "-role": ("role", -1),
        "created_at": ("created_at", 1),
        "-created_at": ("created_at", -1),
        "updated_at": ("updated_at", 1),
        "-updated_at": ("updated_at", -1),
    }

    def __init__(self, repository: Any, audit: AuditService):
        self.repository = repository
        self.audit = audit

    async def list(
        self,
        *,
        query_text: str,
        role: str,
        status: str,
        provider: str,
        page: int,
        page_size: int,
        sort: str,
    ):
        page, page_size, offset = pagination(page, page_size, maximum=100)
        query: dict = {}
        search = query_text.strip()[:100]
        if search:
            pattern = re.escape(search)
            query["$or"] = [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"email": {"$regex": pattern, "$options": "i"}},
            ]
        if role != "all":
            query["role"] = role
        if status == "active":
            query["account_active"] = {"$ne": False}
        elif status == "inactive":
            query["account_active"] = False
        if provider == "google":
            query["auth_provider"] = "google"
        elif provider == "password":
            provider_query = {
                "$or": [
                    {"auth_provider": "password"},
                    {"auth_provider": {"$exists": False}},
                ]
            }
            query = {"$and": [query, provider_query]} if query else provider_query
        if sort not in self.SORTS:
            raise AdministrationError(400, "Invalid sort field")
        field, direction = self.SORTS[sort]
        rows, total = await self.repository.page(
            query, field, direction, offset, page_size
        )
        return admin_user_page(rows, total, page, page_size)

    async def update(self, user_id: str, payload: AdminUserUpdate, actor: dict):
        target = await self.repository.get(user_id)
        if target is None:
            raise AdministrationError(404, "User not found")
        changes = payload.model_dump(exclude_none=True)
        if not changes:
            raise AdministrationError(400, "No changes supplied")
        if user_id == actor["id"]:
            if changes.get("account_active") is False:
                raise AdministrationError(400, "You cannot deactivate your own account")
            if changes.get("role") not in (None, "admin"):
                raise AdministrationError(400, "You cannot remove your own admin role")
        removes_active_admin = (
            target.get("role") == "admin"
            and target.get("account_active", True)
            and (
                changes.get("role", "admin") != "admin"
                or changes.get("account_active") is False
            )
        )
        if removes_active_admin and await self.repository.count_active_admins() <= 1:
            raise AdministrationError(400, "At least one active admin is required")
        changes["updated_at"] = now_iso()
        updated = await self.repository.update(user_id, changes)
        await self.audit.audit(
            actor,
            "update",
            "user",
            user_id,
            {"changes": changes, "email": target.get("email", "")},
        )
        return admin_user(updated)


class LogService:
    def __init__(self, repository: Any):
        self.repository = repository

    async def list(
        self,
        collection: str,
        *,
        page: int,
        page_size: int,
        limit: int | None,
        skip: int | None,
        query_text: str,
        filters: dict,
        date_from: str | None,
        date_to: str | None,
    ) -> dict:
        page, page_size, offset = pagination(page, page_size, limit=limit, skip=skip)
        query: dict = {}
        search = query_text.strip()
        if search:
            pattern = re.escape(search)
            fields = {
                "audit_logs": ("admin_email", "action", "entity_type", "entity_id"),
                "ai_planner_logs": ("error", "llm_model", "llm_profile_name"),
                "system_logs": ("message", "source"),
            }[collection]
            query["$or"] = [
                {field: {"$regex": pattern, "$options": "i"}} for field in fields
            ]
        query.update({key: value for key, value in filters.items() if value})
        period = date_range(date_from, date_to)
        if period:
            query["created_at"] = period
        rows, total = await self.repository.page(collection, query, offset, page_size)
        serializer = {
            "audit_logs": audit_log,
            "ai_planner_logs": ai_log,
            "system_logs": system_log,
        }[collection]
        return page_of(rows, total, page, page_size, serializer)


class SettingsService:
    def __init__(
        self,
        repository: Any,
        audit: AuditService,
        settings: Settings,
    ):
        self.repository = repository
        self.audit = audit
        self.settings = settings

    async def read(self) -> dict:
        stored = await self.repository.get()
        return {
            **default_general_settings(self.settings),
            **{key: value for key, value in stored.items() if key != "_id"},
        }

    async def update(self, payload: GeneralSettingsIn, actor: dict) -> dict:
        changes = payload.model_dump()
        changes["support_email"] = str(payload.support_email).lower()
        changes.update({"updated_at": now_iso(), "updated_by": actor["id"]})
        await self.repository.update(changes)
        await self.audit.audit(
            actor,
            "update",
            "system_settings",
            "general",
            {"fields": list(payload.model_fields_set)},
        )
        await self.audit.system(
            "info",
            "settings",
            "General settings updated",
            {"admin_email": actor.get("email", "")},
        )
        return await self.read()

    async def feature(self, name: str, user: dict | None) -> dict:
        settings = await self.read()
        existing = bool(
            name == "mitra_dashboard"
            and user
            and await self.repository.has_partner_membership(user["id"])
        )
        return feature_decision(name, settings, user, existing_partner=existing)

    async def features(self, user: dict | None) -> dict:
        names = (
            "mitra_onboarding",
            "mitra_dashboard",
            "planner_result_cards",
            "planner_structured_results",
            "planner_culinary",
            "planner_partner_matches",
        )
        return {name: await self.feature(name, user) for name in names}

    async def integrations(self) -> dict:
        return {
            "database": {
                "configured": True,
                "healthy": await self.repository.ping(),
            },
            "ai_planner": {
                "configured": bool(
                    self.settings.use_llm
                    and self.settings.llm_base_url
                    and self.settings.llm_model_name
                ),
                "enabled": self.settings.use_llm,
            },
            "midtrans": {
                "configured": all(
                    (
                        self.settings.midtrans_server_key.get_secret_value(),
                        self.settings.midtrans_client_key,
                        self.settings.midtrans_merchant_id,
                    )
                ),
                "environment": self.settings.midtrans_env,
            },
            "google_oauth": {
                "configured": bool(
                    self.settings.google_oauth_enabled
                    and self.settings.google_client_id.strip()
                )
            },
            "storage": {
                "configured": True,
                "mode": (
                    "remote"
                    if self.settings.emergent_llm_key.get_secret_value()
                    else "local"
                ),
            },
            "redis": {"configured": bool(self.settings.redis_url.get_secret_value())},
            "secure_cookie": {"configured": self.settings.cookie_secure},
        }


class EmailTemplateService:
    def __init__(self, repository: Any, audit: AuditService):
        self.repository = repository
        self.audit = audit

    async def list(
        self,
        *,
        page: int,
        page_size: int,
        query_text: str,
        status: str | None,
        sort: str,
    ) -> dict:
        page, page_size, offset = pagination(page, page_size, maximum=100)
        query: dict = {}
        if query_text.strip():
            pattern = re.escape(query_text.strip())
            query["$or"] = [
                {field: {"$regex": pattern, "$options": "i"}}
                for field in ("key", "name", "subject_id", "subject_en")
            ]
        if status:
            query["enabled"] = status == "enabled"
        descending = sort.startswith("-")
        field = sort.lstrip("-")
        if field not in {"key", "name", "updated_at"}:
            field, descending = "key", False
        rows, total = await self.repository.page(
            query, field, -1 if descending else 1, offset, page_size
        )
        return paged([email_template(row) for row in rows], total, page, page_size)

    async def get(self, identifier: str) -> dict:
        row = await self.repository.get(identifier)
        if row is None:
            raise AdministrationError(404, "Email template not found")
        return email_template(row)

    async def create(self, payload: EmailTemplateIn, actor: dict) -> dict:
        if await self.repository.by_key(payload.key):
            raise AdministrationError(409, "Template key already exists")
        now = now_iso()
        row = await self.repository.insert(
            {**payload.model_dump(), "created_at": now, "updated_at": now}
        )
        await self.audit.audit(
            actor,
            "create",
            "email_template",
            str(row["_id"]),
            {"key": payload.key},
        )
        return email_template(row)

    async def update(
        self, identifier: str, payload: EmailTemplateIn, actor: dict
    ) -> dict:
        if await self.repository.get(identifier) is None:
            raise AdministrationError(404, "Email template not found")
        if await self.repository.by_key(payload.key, identifier):
            raise AdministrationError(409, "Template key already exists")
        row = await self.repository.update(
            identifier, {**payload.model_dump(), "updated_at": now_iso()}
        )
        await self.audit.audit(
            actor,
            "update",
            "email_template",
            identifier,
            {"key": payload.key},
        )
        return email_template(row)

    async def delete(self, identifier: str, actor: dict) -> dict:
        current = await self.repository.get(identifier)
        if current is None:
            raise AdministrationError(404, "Email template not found")
        await self.repository.delete(identifier)
        await self.audit.audit(
            actor,
            "delete",
            "email_template",
            identifier,
            {"key": current.get("key", "")},
        )
        return {"ok": True}


class NotificationService:
    def __init__(self, repository: Any):
        self.repository = repository

    async def list_mine(self, user: dict) -> list[dict]:
        rows = await self.repository.inbox(user["id"])
        return [
            {
                **{key: value for key, value in row.items() if key != "_id"},
                "id": str(row["_id"]),
            }
            for row in rows
        ]

    async def mark_read(self, identifier: str, user: dict) -> dict:
        if not await self.repository.mark_read(identifier, user["id"], now_iso()):
            raise AdministrationError(404, "Notification not found")
        return {"ok": True}

    async def delivery_logs(self) -> list[dict]:
        emails, sms, in_app = await self.repository.delivery_logs()
        combined = (
            notification_rows("email", emails)
            + notification_rows("sms", sms)
            + notification_rows("in_app", in_app)
        )
        combined.sort(key=lambda row: row["created_at"], reverse=True)
        return combined[:200]


class LlmProfileService:
    def __init__(
        self,
        repository: Any,
        gateway: Any,
        audit: AuditService,
        activation_lock: asyncio.Lock,
    ):
        self.repository = repository
        self.gateway = gateway
        self.audit = audit
        self.activation_lock = activation_lock

    async def runtime(self) -> tuple[Any, dict]:
        row = await self.repository.active()
        if row is None:
            return (
                self.gateway.environment_client(),
                self.gateway.environment_metadata(),
            )
        return self.gateway.client(row), {
            "source": "profile",
            "profile_id": str(row["_id"]),
            "profile_name": row.get("name", ""),
            "base_url": row.get("base_url", ""),
            "model_name": row.get("model_name", ""),
            "enabled": True,
            "configured": True,
            "health_status": row.get("health_status", "untested"),
            "latency_ms": row.get("latency_ms"),
        }

    async def runtime_status(self) -> dict:
        try:
            _, metadata = await self.runtime()
            return metadata
        except Exception:
            return {
                "source": "profile",
                "profile_id": None,
                "profile_name": "Unavailable profile",
                "base_url": "",
                "model_name": "",
                "enabled": False,
                "configured": False,
                "health_status": "error",
                "latency_ms": None,
            }

    async def list(self, query_text: str) -> list[dict]:
        query: dict = {}
        if query_text.strip():
            pattern = re.escape(query_text.strip())
            query["$or"] = [
                {field: {"$regex": pattern, "$options": "i"}}
                for field in ("name", "model_name", "base_url")
            ]
        return [llm_profile(row) for row in await self.repository.list(query)]

    async def get(self, identifier: str) -> dict:
        row = await self.repository.get(identifier)
        if row is None:
            raise AdministrationError(404, "LLM profile not found")
        return llm_profile(row)

    async def create(self, payload: LlmProfileCreateIn, actor: dict) -> dict:
        name = payload.name.strip()
        if await self.repository.by_name(name.lower()):
            raise AdministrationError(409, "Profile name already exists")
        now = now_iso()
        row = {
            "name": name,
            "name_normalized": name.lower(),
            "base_url": await self.gateway.validate_base_url(payload.base_url),
            "model_name": payload.model_name.strip(),
            "enabled": payload.enabled,
            "active": False,
            "health_status": "untested",
            "created_at": now,
            "updated_at": now,
        }
        if payload.api_key:
            row["api_key_ciphertext"], row["api_key_nonce"] = self.gateway.encrypt(
                payload.api_key
            )
        row = await self.repository.insert(row)
        await self.audit.audit(
            actor,
            "create",
            "llm_profile",
            str(row["_id"]),
            {
                "name": name,
                "model_name": row["model_name"],
                "api_key_configured": bool(payload.api_key),
            },
        )
        return llm_profile(row)

    async def update(
        self, identifier: str, payload: LlmProfileUpdateIn, actor: dict
    ) -> dict:
        current = await self.repository.get(identifier)
        if current is None:
            raise AdministrationError(404, "LLM profile not found")
        name = payload.name.strip()
        if await self.repository.by_name(name.lower(), identifier):
            raise AdministrationError(409, "Profile name already exists")
        if payload.api_key_action == "replace" and not payload.api_key:
            raise AdministrationError(
                400, "A new API key is required when replacing the key"
            )
        if payload.api_key_action != "replace" and payload.api_key:
            raise AdministrationError(
                400, "Set API key action to replace before sending a new key"
            )
        changes = {
            "name": name,
            "name_normalized": name.lower(),
            "base_url": await self.gateway.validate_base_url(payload.base_url),
            "model_name": payload.model_name.strip(),
            "enabled": payload.enabled,
            "health_status": "untested",
            "latency_ms": None,
            "last_error": "",
            "updated_at": now_iso(),
        }
        if current.get("active"):
            changes["active"] = False
        update: dict = {"$set": changes}
        if payload.api_key_action == "replace":
            changes["api_key_ciphertext"], changes["api_key_nonce"] = (
                self.gateway.encrypt(payload.api_key)
            )
        elif payload.api_key_action == "remove":
            update["$unset"] = {"api_key_ciphertext": "", "api_key_nonce": ""}
        updated = await self.repository.update(identifier, update)
        await self.audit.audit(
            actor,
            "update",
            "llm_profile",
            identifier,
            {
                "name": name,
                "model_name": changes["model_name"],
                "api_key_action": payload.api_key_action,
            },
        )
        return llm_profile(updated)

    async def duplicate(self, identifier: str, actor: dict) -> dict:
        source = await self.repository.get(identifier)
        if source is None:
            raise AdministrationError(404, "LLM profile not found")
        base_name = f"{source.get('name', 'Profile')} copy"
        name, suffix = base_name, 2
        while await self.repository.by_name(name.lower()):
            name = f"{base_name} {suffix}"
            suffix += 1
        now = now_iso()
        row = {
            "name": name,
            "name_normalized": name.lower(),
            "base_url": source["base_url"],
            "model_name": source["model_name"],
            "enabled": source.get("enabled", True),
            "active": False,
            "health_status": "untested",
            "created_at": now,
            "updated_at": now,
        }
        secret = self.gateway.decrypt(source)
        if secret:
            row["api_key_ciphertext"], row["api_key_nonce"] = self.gateway.encrypt(
                secret
            )
        row = await self.repository.insert(row)
        await self.audit.audit(
            actor,
            "duplicate",
            "llm_profile",
            str(row["_id"]),
            {"source_id": identifier},
        )
        return llm_profile(row)

    async def test(self, identifier: str, actor: dict) -> dict:
        row = await self.repository.get(identifier)
        if row is None:
            raise AdministrationError(404, "LLM profile not found")
        started = datetime.now(timezone.utc)
        success, error = await self.gateway.probe(row)
        latency = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        tested_at = now_iso()
        await self.repository.update(
            identifier,
            {
                "$set": {
                    "health_status": "healthy" if success else "error",
                    "latency_ms": latency,
                    "last_tested_at": tested_at,
                    "last_error": error,
                    "updated_at": tested_at,
                }
            },
        )
        await self.audit.audit(
            actor,
            "test",
            "llm_profile",
            identifier,
            {"success": success, "latency_ms": latency},
        )
        return {
            "success": success,
            "health_status": "healthy" if success else "error",
            "latency_ms": latency,
            "error": error,
        }

    async def activate(self, identifier: str, actor: dict) -> dict:
        async with self.activation_lock:
            row = await self.repository.get(identifier)
            if row is None:
                raise AdministrationError(404, "LLM profile not found")
            if not row.get("enabled", True):
                raise AdministrationError(409, "Enable the profile before activation")
            if row.get("health_status") != "healthy":
                raise AdministrationError(
                    409, "Test the connection successfully before activation"
                )
            previous = await self.repository.active_any()
            await self.repository.deactivate_all()
            changed = await self.repository.activate(
                identifier,
                {
                    "active": True,
                    "activated_at": now_iso(),
                    "activated_by": actor["id"],
                },
            )
            if not changed and not row.get("active"):
                if previous:
                    await self.repository.activate(
                        str(previous["_id"]), {"active": True}
                    )
                raise AdministrationError(500, "Could not activate profile")
        await self.audit.audit(
            actor,
            "activate",
            "llm_profile",
            identifier,
            {"name": row.get("name", "")},
        )
        return llm_profile(await self.repository.get(identifier))

    async def use_environment(self, actor: dict) -> dict:
        async with self.activation_lock:
            previous = await self.repository.active_any()
            await self.repository.deactivate_all()
        await self.audit.audit(
            actor,
            "activate",
            "llm_environment",
            "environment",
            {
                "previous_profile_id": str(previous["_id"]) if previous else None,
                "model_name": self.gateway.settings.llm_model_name,
            },
        )
        _, metadata = await self.runtime()
        return metadata

    async def delete(self, identifier: str, actor: dict) -> dict:
        row = await self.repository.get(identifier)
        if row is None:
            raise AdministrationError(404, "LLM profile not found")
        if row.get("active"):
            raise AdministrationError(409, "Active profile cannot be deleted")
        await self.repository.delete(identifier)
        await self.audit.audit(
            actor,
            "delete",
            "llm_profile",
            identifier,
            {"name": row.get("name", "")},
        )
        return {"ok": True}


class GovernanceService:
    def __init__(
        self,
        repository: Any,
        audit: AuditService,
        notifications: Any,
        rate_limiter: Any,
    ):
        self.repository = repository
        self.audit = audit
        self.notifications = notifications
        self.rate_limiter = rate_limiter

    async def destination_preview(self, identifier: str):
        try:
            document = await self.repository.destination(identifier)
        except AdministrationError:
            document = None
        if document is None:
            raise AdministrationError(404, "Destination not found")
        return destination_document_to_response(document)

    async def partner_preview(self, identifier: str) -> dict:
        try:
            partner = await self.repository.partner(identifier)
        except AdministrationError:
            partner = None
        if partner is None:
            raise AdministrationError(404, "Partner not found")
        offerings, destinations = await self.repository.partner_preview_data(
            identifier, partner.get("destination_ids", [])
        )
        return {
            **partner_to_public_response(partner).model_dump(),
            "gallery": [
                item.model_dump()
                for item in gallery_to_response(partner.get("gallery", []))
            ],
            "offerings": [
                offering_to_response(item).model_dump() for item in offerings
            ],
            "destinations": [
                {
                    "id": str(item["_id"]),
                    "name": item.get("name", ""),
                    "name_en": item.get("name_en", ""),
                    "location": item.get("location", ""),
                }
                for item in destinations
            ],
            "type_details": public_type_details(partner),
            "last_profile_reviewed_at": partner.get("last_profile_reviewed_at")
            or partner.get("updated_at"),
        }

    async def overview(self) -> dict:
        destinations, partners, offering_counts, open_reports = (
            await self.repository.overview_data()
        )
        quality_items = []
        for document in destinations:
            completeness, missing, stale = destination_quality(document)
            if completeness < 100 or stale:
                quality_items.append(
                    governance_item(
                        "destination", document, completeness, missing, stale
                    )
                )
        now = datetime.now(timezone.utc)
        partner_queue = []
        for document in partners:
            completeness, missing = partner_completeness(
                document, offering_counts.get(str(document["_id"]), 0)
            )
            reviewed = document.get("last_profile_reviewed_at") or document.get(
                "updated_at"
            )
            try:
                reviewed_at = datetime.fromisoformat(reviewed) if reviewed else None
                if reviewed_at and not reviewed_at.tzinfo:
                    reviewed_at = reviewed_at.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                reviewed_at = None
            stale = reviewed_at is None or reviewed_at < now - timedelta(days=90)
            if completeness < 100 or stale:
                quality_items.append(
                    governance_item("partner", document, completeness, missing, stale)
                )
            due_value = document.get("review_due_at")
            try:
                due = datetime.fromisoformat(due_value) if due_value else None
                if due and not due.tzinfo:
                    due = due.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                due = None
            if (
                document.get("status") == "pending" and due and due < now
            ) or document.get("status") == "needs_revision":
                owner = (
                    await self.repository.owner_email(document["owner_user_id"])
                    if document.get("owner_user_id")
                    else None
                )
                partner_queue.append(
                    {
                        "id": str(document["_id"]),
                        "business_name": document.get("business_name", ""),
                        "status": document.get("status", ""),
                        "review_due_at": document.get("review_due_at"),
                        "revision_note": document.get("revision_note", ""),
                        "owner_email": (owner or {}).get("email", ""),
                    }
                )
        quality_items.sort(
            key=lambda item: (
                not item["stale"],
                item["completeness"],
                item["updated_at"],
            )
        )
        return {
            "summary": {
                "quality_queue": len(quality_items),
                "stale": sum(1 for item in quality_items if item["stale"]),
                "partner_attention": len(partner_queue),
                "open_reports": open_reports,
            },
            "quality_queue": quality_items[:200],
            "partner_queue": partner_queue[:200],
        }

    async def update_workflow(
        self, identifier: str, payload: EditorialWorkflowIn, actor: dict
    ) -> dict:
        current = await self.repository.destination(identifier)
        if current is None:
            raise AdministrationError(404, "Destination not found")
        note = payload.note.strip()
        if payload.status == "needs_revision" and len(note) < 5:
            raise AdministrationError(
                400, "Revision note must contain at least 5 characters"
            )
        now = now_iso()
        changes = {
            "editorial_status": payload.status,
            "editorial_note": note,
            "editorial_workflow_updated_at": now,
            "editorial_workflow_updated_by": actor["id"],
            "updated_at": now,
        }
        if payload.status == "published":
            changes.update(
                {
                    "editorial_reviewed_at": now,
                    "editorial_reviewed_by": actor["id"],
                    "is_active": True,
                }
            )
        else:
            changes["is_active"] = False
        await self.repository.update_destination(identifier, changes)
        await self.audit.audit(
            actor,
            "editorial_workflow",
            "destination",
            identifier,
            {"status": payload.status},
        )
        return {"ok": True, "status": payload.status, "updated_at": now}

    async def create_report(
        self,
        payload: ContentReportIn,
        client_ip: str,
        user: dict | None,
    ) -> dict:
        await self.rate_limiter.enforce("content_report_ip", client_ip, 10, 3600)
        if not await self.repository.report_target_exists(
            payload.target_type, payload.target_id
        ):
            raise AdministrationError(404, "Report target not found")
        now = now_iso()
        identifier = await self.repository.insert_report(
            {
                **payload.model_dump(mode="json"),
                "reporter_user_id": user.get("id") if user else None,
                "status": "open",
                "created_at": now,
                "updated_at": now,
            }
        )
        return {"id": identifier, "status": "open"}

    async def reports(self, status: str) -> list[dict]:
        return [
            {
                **{key: value for key, value in row.items() if key != "_id"},
                "id": str(row["_id"]),
            }
            for row in await self.repository.reports(status)
        ]

    async def moderate(
        self, identifier: str, payload: ModerationActionIn, actor: dict
    ) -> dict:
        report = await self.repository.report(identifier)
        if report is None:
            raise AdministrationError(404, "Report not found")
        if payload.action == "hide":
            await self.repository.moderate_target(report)
        changes = {
            "status": payload.status,
            "action": payload.action,
            "admin_note": payload.admin_note.strip(),
            "moderated_by": actor["id"],
            "updated_at": now_iso(),
        }
        await self.repository.update_report(identifier, changes)
        await self.audit.audit(
            actor,
            "moderate",
            "content_report",
            identifier,
            {"status": payload.status, "action": payload.action},
        )
        return {"ok": True, **changes}

    async def notify_partner(self, identifier: str, actor: dict) -> dict:
        try:
            partner = await self.repository.partner(identifier)
        except AdministrationError:
            partner = None
        if partner is None:
            raise AdministrationError(404, "Partner not found")
        owner = (
            await self.repository.owner_email(partner["owner_user_id"])
            if partner.get("owner_user_id")
            else None
        )
        if not owner or not owner.get("email"):
            raise AdministrationError(409, "Partner owner contact is unavailable")
        deliveries = await self.notifications.partner_attention(
            partner, owner, identifier
        )
        await self.audit.audit(
            actor, "notify", "partner", identifier, {"deliveries": deliveries}
        )
        return {"deliveries": deliveries}

    async def analytics(self, days: int) -> dict:
        days = max(7, min(days, 365))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        analytics, planner_analytics, planner_logs, partner_catalog = (
            await self.repository.analytics_data(since)
        )
        event_counts = {
            event: 0
            for event in (
                "directory_impression",
                "ai_impression",
                "profile_click",
                "profile_view",
                "whatsapp_click",
            )
        }
        exposure: dict = {}
        match_audit: dict = {}
        for event in analytics:
            event_type = event.get("event_type")
            if event_type in event_counts:
                event_counts[event_type] += 1
            partner_id = event.get("partner_id")
            if not partner_id:
                continue
            row = exposure.setdefault(
                partner_id,
                {key: 0 for key in event_counts},
            )
            if event_type in row:
                row[event_type] += 1
            if event_type == "ai_impression":
                entry = match_audit.setdefault(
                    partner_id, {"relevance_score": 0, "factor_codes": set()}
                )
                entry["relevance_score"] = max(
                    entry["relevance_score"], event.get("relevance_score") or 0
                )
                entry["factor_codes"].update(event.get("match_factor_codes") or [])
        catalog_by_id = {str(row["_id"]): row for row in partner_catalog}
        missing = [value for value in exposure if value not in catalog_by_id]
        deleted = await self.repository.partners_by_ids(missing)
        by_id = {
            **catalog_by_id,
            **{str(row["_id"]): row for row in deleted},
        }
        exposure_rows = []
        for partner_id, counts in exposure.items():
            partner = by_id.get(partner_id, {})
            impressions = counts["directory_impression"] + counts["ai_impression"]
            exposure_rows.append(
                {
                    "partner_id": partner_id,
                    "business_name": partner.get("business_name", "Deleted partner"),
                    "type": partner.get("type", ""),
                    "tier": "featured" if premium_active(partner) else "regular",
                    **counts,
                    "contact_rate": (
                        round(100 * counts["whatsapp_click"] / impressions, 2)
                        if impressions
                        else 0
                    ),
                    "last_relevance_score": match_audit.get(partner_id, {}).get(
                        "relevance_score", 0
                    ),
                    "match_factor_codes": sorted(
                        match_audit.get(partner_id, {}).get("factor_codes", set())
                    ),
                }
            )
        exposure_rows.sort(
            key=lambda row: row["directory_impression"] + row["ai_impression"],
            reverse=True,
        )
        tiers = {}
        for row in exposure_rows:
            tier = tiers.setdefault(
                row["tier"], {"partners": 0, "impressions": 0, "contacts": 0}
            )
            tier["partners"] += 1
            tier["impressions"] += row["directory_impression"] + row["ai_impression"]
            tier["contacts"] += row["whatsapp_click"]
        planner_funnel = {
            event: 0
            for event in (
                "planner_story_submitted",
                "planner_step_shown",
                "planner_step_completed",
                "planner_generated",
            )
        }
        for event in planner_analytics:
            if event.get("event_type") in planner_funnel:
                planner_funnel[event["event_type"]] += 1
        return {
            "days": days,
            "funnel": event_counts,
            "planner_funnel": planner_funnel,
            "tiers": tiers,
            "exposure": exposure_rows[:200],
            "fairness": governance_fairness_summary(
                analytics, exposure_rows, partner_catalog, planner_logs
            ),
            "planner_health": planner_health_summary(planner_logs),
        }

    @staticmethod
    def role(role: str) -> dict:
        return role_preview(role)
