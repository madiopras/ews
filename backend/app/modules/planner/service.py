"""Application use cases for planner analytics, quota, and generation."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.modules.planner.contract import (
    planner_style_instruction,
    resolved_budget_style,
)
from app.modules.planner.domain import (
    build_legacy_planner_messages,
    build_planner_partner_recommendations,
    group_matchable_partners,
    planner_partner_gap_keys,
    previous_destination_names,
    sanitize_context,
)
from app.modules.planner.exceptions import PlannerError
from app.modules.planner.guard import planner_context_violation, planner_scope_message
from app.modules.planner.schemas import PlannerAnalyticsEventIn, TripPlanIn
from app.modules.planner.sse import PlannerStreamMetrics
from app.modules.planner.structured_engine import (
    PlannerStructuredParseError,
    build_structured_planner_messages,
    destination_catalog_payload,
    hydrate_structured_planner_result,
    normalize_legacy_fallback,
    parse_structured_planner_output,
    select_structured_catalog,
    structured_result_to_markdown,
)
from app.shared.planner_result import planner_error_message

logger = logging.getLogger(__name__)


@dataclass
class PreparedPlannerStream:
    events: AsyncIterator[dict]
    metrics: PlannerStreamMetrics
    cookie_token: str | None
    cookie_ttl_days: int


class PlannerAnalyticsService:
    def __init__(self, repository: Any, identity: Any):
        self.repository = repository
        self.identity = identity

    async def track(
        self, payload: PlannerAnalyticsEventIn, consent_granted: bool
    ) -> dict:
        if not consent_granted:
            return {"accepted": False, "reason": "consent_required"}
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,80}", payload.event_id):
            raise PlannerError(400, "Invalid event id")
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,80}", payload.anonymous_session_id):
            raise PlannerError(400, "Invalid anonymous session id")
        now = datetime.now(timezone.utc)
        inserted = await self.repository.insert_once(
            {
                "event_id": payload.event_id,
                "event_type": payload.event_type,
                "step": payload.step,
                "anonymous_id_hash": self.identity.identity_hash(
                    payload.anonymous_session_id
                ),
                "created_at": now.isoformat(),
                "expires_at": now + timedelta(days=365),
            }
        )
        return {"accepted": True, "duplicate": not inserted}


class PlannerQuotaService:
    def __init__(self, repository: Any, identity: Any):
        self.repository = repository
        self.identity = identity

    @staticmethod
    def _date_key() -> str:
        return datetime.now(timezone.utc).date().isoformat()

    def _user_key(self, user_id: str) -> str:
        return f"planner-user:{user_id}:{self._date_key()}"

    def _guest_key(self, identity: str) -> str:
        return f"planner-guest:{self.identity.identity_hash(identity)}"

    def _ip_key(self, client_ip: str) -> str:
        digest = self.identity.identity_hash(f"{self._date_key()}:{client_ip}")
        return f"planner-ip:{self._date_key()}:{digest}"

    async def status(
        self, user: dict | None, guest_token: str | None, settings: dict
    ) -> tuple[dict, str | None, int]:
        if user:
            limit = int(settings.get("planner_authenticated_daily_limit", 20))
            row = await self.repository.usage(self._user_key(user["id"]))
            used = int(row.get("consumed_count", 0)) + len(row.get("reservations", []))
            return (
                {
                    "authenticated": True,
                    "limit": limit,
                    "remaining": None if limit == 0 else max(0, limit - used),
                    "login_required": False,
                },
                None,
                0,
            )
        ttl_days = int(settings.get("planner_guest_identity_ttl_days", 180))
        identity, cookie_token = self.identity.guest_identity(guest_token, ttl_days)
        row = await self.repository.usage(self._guest_key(identity))
        limit = int(settings.get("planner_guest_generation_limit", 1))
        used = int(row.get("consumed_count", 0)) + len(row.get("reservations", []))
        remaining = (
            max(0, limit - used)
            if settings.get("planner_guest_trial_enabled", True)
            else 0
        )
        return (
            {
                "authenticated": False,
                "limit": limit,
                "remaining": remaining,
                "login_required": remaining == 0,
            },
            cookie_token,
            ttl_days,
        )

    async def reserve(
        self,
        user: dict | None,
        guest_token: str | None,
        client_ip: str,
        settings: dict,
    ) -> dict:
        cooldown = int(settings.get("planner_generation_cooldown_seconds", 5))
        if user:
            limit = int(settings.get("planner_authenticated_daily_limit", 20))
            key = self._user_key(user["id"])
            reservation = await self.repository.reserve(key, limit, 2, cooldown)
            if reservation == "":
                raise PlannerError(
                    429,
                    {
                        "code": "user_planner_limit_reached",
                        "message": (
                            "Daily planner limit reached. Please try again later."
                        ),
                    },
                )
            return {
                "key": key,
                "reservation_id": reservation,
                "ttl_days": 2,
                "guest": False,
            }

        if not settings.get("planner_guest_trial_enabled", True):
            raise PlannerError(
                401,
                {
                    "code": "authentication_required",
                    "message": "Sign in to use AI Planner.",
                },
            )
        ttl_days = int(settings.get("planner_guest_identity_ttl_days", 180))
        identity, cookie_token = self.identity.guest_identity(guest_token, ttl_days)
        key = self._guest_key(identity)
        reservation = await self.repository.reserve(
            key,
            int(settings.get("planner_guest_generation_limit", 1)),
            ttl_days,
            cooldown,
        )
        if reservation == "":
            raise PlannerError(
                401,
                {
                    "code": "guest_trial_used",
                    "message": (
                        "Your free plan has been used. Sign in to create another plan."
                    ),
                },
            )
        ip_key = self._ip_key(client_ip)
        ip_reservation = await self.repository.reserve(
            ip_key,
            int(settings.get("planner_guest_ip_daily_limit", 20)),
            2,
            0,
        )
        if ip_reservation == "":
            await self.repository.refund(key, reservation)
            raise PlannerError(
                429,
                {
                    "code": "guest_network_limit_reached",
                    "message": (
                        "Guest planner limit reached for this network. "
                        "Sign in to continue."
                    ),
                },
            )
        return {
            "key": key,
            "reservation_id": reservation,
            "ttl_days": ttl_days,
            "guest": True,
            "cookie_token": cookie_token,
            "ip_key": ip_key,
            "ip_reservation_id": ip_reservation,
        }

    async def consume(self, quota: dict) -> None:
        await self.repository.consume(
            quota["key"], quota.get("reservation_id"), quota["ttl_days"]
        )
        if quota.get("ip_key"):
            await self.repository.consume(
                quota["ip_key"], quota.get("ip_reservation_id"), 2
            )

    async def refund(self, quota: dict) -> None:
        await self.repository.refund(quota["key"], quota.get("reservation_id"))
        if quota.get("ip_key"):
            await self.repository.refund(
                quota["ip_key"], quota.get("ip_reservation_id")
            )


class PlannerGenerationService:
    def __init__(
        self,
        settings: Any,
        quota: PlannerQuotaService,
        catalog: Any,
        llm: Any,
        logs: Any,
        system_logs: Any,
    ):
        self.settings = settings
        self.quota = quota
        self.catalog = catalog
        self.llm = llm
        self.logs = logs
        self.system_logs = system_logs

    async def prepare(
        self,
        payload: TripPlanIn,
        user: dict | None,
        guest_token: str | None,
        client_ip: str,
    ) -> PreparedPlannerStream:
        settings = await self.settings.read()
        if not settings.get("planner_enabled", True):
            raise PlannerError(503, "AI Planner is temporarily disabled")
        if payload.budget_style is None and payload.budget is None:
            raise PlannerError(422, "Choose a travel style")
        safe_context = sanitize_context(payload.extra_context or "")
        if planner_context_violation(safe_context):
            raise PlannerError(
                422,
                {
                    "code": "planner_out_of_scope",
                    "message": planner_scope_message(payload.lang),
                },
            )
        travel_style = resolved_budget_style(
            payload.budget_style, payload.budget, payload.days
        )
        structured_decision, culinary_decision = await asyncio.gather(
            self.settings.feature("planner_structured_results", user, settings),
            self.settings.feature("planner_culinary", user, settings),
        )
        structured_enabled = structured_decision["enabled"] is True
        destinations, partners = await asyncio.gather(
            self.catalog.destinations(),
            self.catalog.partners(culinary_decision["enabled"] is True),
        )
        if not destinations:
            raise PlannerError(400, "No destinations available")
        partner_ids = [str(row.get("_id") or row.get("id") or "") for row in partners]
        offerings = await self.catalog.offerings(partner_ids)
        partners_by_destination = group_matchable_partners(partners, offerings)
        destinations_by_id = {
            str(row.get("_id") or row.get("id") or ""): row for row in destinations
        }
        preferred_ids = list(dict.fromkeys(payload.preferred_destination_ids))
        if any(value not in destinations_by_id for value in preferred_ids):
            raise PlannerError(
                400, "One or more preferred destinations are unavailable"
            )
        preferred_names = [destinations_by_id[value]["name"] for value in preferred_ids]
        prompt_destinations = (
            select_structured_catalog(
                destinations,
                interests=payload.interests,
                extra_context=safe_context,
                preferred_ids=preferred_ids,
            )
            if structured_enabled
            else destinations
        )
        catalog_items = destination_catalog_payload(prompt_destinations)
        catalog_json = json.dumps(
            catalog_items,
            ensure_ascii=False,
            indent=None if structured_enabled else 2,
        )
        used_names = previous_destination_names(
            payload.previous_content or "", destinations
        )
        if structured_enabled:
            messages = build_structured_planner_messages(
                lang=payload.lang,
                days=payload.days,
                budget_style=travel_style,
                style_instruction=planner_style_instruction(travel_style, payload.lang),
                interests=payload.interests,
                extra_context=safe_context,
                preferred_ids=preferred_ids,
                previous_destination_names=used_names,
                catalog=catalog_items,
            )
        else:
            messages = build_legacy_planner_messages(
                lang=payload.lang,
                days=payload.days,
                travel_style=travel_style,
                interests=payload.interests,
                safe_context=safe_context,
                preferred_names=preferred_names,
                used_names=used_names,
                catalog=catalog_items,
            )
        try:
            active_llm, runtime = await self.llm.runtime()
        except Exception as error:
            raise PlannerError(503, "Active LLM profile could not be loaded") from error
        if not runtime.get("enabled"):
            raise PlannerError(503, "AI Planner LLM is disabled")
        quota = await self.quota.reserve(user, guest_token, client_ip, settings)
        metrics = PlannerStreamMetrics()
        events = self._generate(
            payload=payload,
            user=user,
            travel_style=travel_style,
            structured_enabled=structured_enabled,
            structured_decision=structured_decision,
            culinary_decision=culinary_decision,
            destinations=destinations,
            destinations_by_id=destinations_by_id,
            prompt_destinations=prompt_destinations,
            catalog_json=catalog_json,
            partners=partners,
            partners_by_destination=partners_by_destination,
            preferred_ids=preferred_ids,
            safe_context=safe_context,
            messages=messages,
            active_llm=active_llm,
            runtime=runtime,
            quota=quota,
            metrics=metrics,
        )
        return PreparedPlannerStream(
            events=events,
            metrics=metrics,
            cookie_token=quota.get("cookie_token"),
            cookie_ttl_days=int(quota.get("ttl_days", 0)),
        )

    async def _generate(
        self,
        *,
        payload: TripPlanIn,
        user: dict | None,
        travel_style: str,
        structured_enabled: bool,
        structured_decision: dict,
        culinary_decision: dict,
        destinations: list[dict],
        destinations_by_id: dict,
        prompt_destinations: list[dict],
        catalog_json: str,
        partners: list[dict],
        partners_by_destination: dict,
        preferred_ids: list[str],
        safe_context: str,
        messages: list[dict],
        active_llm: Any,
        runtime: dict,
        quota: dict,
        metrics: PlannerStreamMetrics,
    ) -> AsyncIterator[dict]:
        started_at = datetime.now(timezone.utc)
        log_id = None
        output_chars = 0
        output_parts: list[str] = []
        quota_consumed = False
        final_status = "error"
        error_message = ""
        parse_status = "not_requested"
        fallback_reason = ""
        final_result_format = "legacy"
        unknown_destination_count = 0
        used_destination_ids: list[str] = []
        recommendations: list[dict] = []
        try:
            log_id = await self.logs.start(
                {
                    "status": "processing",
                    "days": payload.days,
                    "budget_style": travel_style,
                    "interests": payload.interests,
                    "lang": payload.lang,
                    "catalog_size": len(destinations),
                    "prompt_catalog_size": len(prompt_destinations),
                    "prompt_catalog_chars": len(catalog_json),
                    "partner_count": len(partners),
                    "result_format_requested": (
                        "structured" if structured_enabled else "legacy"
                    ),
                    "structured_rollout_reason": structured_decision.get("reason"),
                    "culinary_rollout_reason": culinary_decision.get("reason"),
                    "llm_source": runtime["source"],
                    "llm_profile_id": runtime.get("profile_id"),
                    "llm_profile_name": runtime.get("profile_name", ""),
                    "llm_model": runtime.get("model_name", ""),
                    "user_id": user.get("id") if user else None,
                    "guest": user is None,
                    "created_at": started_at.isoformat(),
                }
            )
            progress_at = asyncio.get_running_loop().time()
            if structured_enabled:
                yield {"progress": {"phase": "generating", "format": "structured"}}
            async for content in active_llm.stream(messages):
                if not quota_consumed:
                    await self.quota.consume(quota)
                    quota_consumed = True
                output_chars += len(content)
                output_parts.append(content)
                if not structured_enabled:
                    yield {"text": content}
                elif asyncio.get_running_loop().time() - progress_at >= 2:
                    progress_at = asyncio.get_running_loop().time()
                    yield {
                        "progress": {
                            "phase": "generating",
                            "format": "structured",
                        }
                    }
            if not output_parts:
                raise RuntimeError("LLM provider returned an empty response")
            raw_output = "".join(output_parts)
            if structured_enabled:
                try:
                    yield {"progress": {"phase": "validating", "format": "structured"}}
                    provider_result, unknown_ids = parse_structured_planner_output(
                        raw_output,
                        allowlist=destinations_by_id,
                        requested_days=payload.days,
                    )
                    yield {"progress": {"phase": "hydrating", "format": "structured"}}
                    unknown_destination_count = len(unknown_ids)
                    validated_ids = list(
                        dict.fromkeys(
                            stop.destination_id
                            for day in provider_result.days
                            for stop in day.stops
                        )
                    )
                    match_context = " ".join(
                        [
                            safe_context,
                            *payload.interests,
                            provider_result.summary,
                            *(
                                stop.activity
                                for day in provider_result.days
                                for stop in day.stops
                            ),
                        ]
                    ).strip()
                    used_destination_ids, recommendations = (
                        build_planner_partner_recommendations(
                            provider_result.summary,
                            destinations,
                            partners_by_destination,
                            validated_ids,
                            match_context,
                            payload.lang,
                        )
                    )
                    validated_set = set(validated_ids)
                    used_destination_ids = [
                        value
                        for value in used_destination_ids
                        if value in validated_set
                    ]
                    result = hydrate_structured_planner_result(
                        provider_result,
                        request_days=payload.days,
                        budget_style=travel_style,
                        interests=payload.interests,
                        lang=payload.lang,
                        destinations=destinations,
                        partner_matches=recommendations,
                    )
                    parse_status = (
                        "success_with_unknown_ids_removed" if unknown_ids else "success"
                    )
                    final_result_format = "structured"
                    yield {"text": structured_result_to_markdown(result, payload.lang)}
                    yield {
                        "recommendations": recommendations,
                        "destination_ids": used_destination_ids,
                        "result": result.model_dump(mode="json"),
                        "result_format": "structured",
                    }
                except PlannerStructuredParseError as parse_error:
                    parse_status = "fallback"
                    fallback_reason = parse_error.reason
                    legacy_output = normalize_legacy_fallback(raw_output)
                    if not legacy_output:
                        raise RuntimeError("LLM provider returned an unusable response")
                    used_destination_ids, recommendations = (
                        build_planner_partner_recommendations(
                            legacy_output,
                            destinations,
                            partners_by_destination,
                            preferred_ids,
                            " ".join([safe_context, *payload.interests]).strip(),
                            payload.lang,
                        )
                    )
                    yield {"text": legacy_output}
                    yield {
                        "recommendations": recommendations,
                        "destination_ids": used_destination_ids,
                        "result_format": "legacy",
                        "fallback": True,
                    }
            else:
                used_destination_ids, recommendations = (
                    build_planner_partner_recommendations(
                        raw_output,
                        destinations,
                        partners_by_destination,
                        preferred_ids,
                        " ".join([safe_context, *payload.interests]).strip(),
                        payload.lang,
                    )
                )
                yield {
                    "recommendations": recommendations,
                    "destination_ids": used_destination_ids,
                    "result_format": "legacy",
                }
            final_status = "completed"
            yield {"done": True, "result_format": final_result_format}
        except (asyncio.CancelledError, GeneratorExit):
            final_status = "cancelled"
            error_message = "planner_cancelled"
            raise
        except Exception as error:
            error_message = str(error)[:1000]
            logger.error("Trip planner error: %s", error)
            try:
                await self.system_logs.failure(
                    error_message, payload.days, payload.lang
                )
            except Exception:
                logger.exception("Unable to write planner system log")
            code = (
                "planner_timeout"
                if isinstance(error, (asyncio.TimeoutError, TimeoutError))
                else "planner_provider_unavailable"
            )
            yield {
                "error": planner_error_message(code, payload.lang),
                "code": code,
            }
        finally:
            if not quota_consumed:
                try:
                    await asyncio.shield(self.quota.refund(quota))
                except Exception:
                    logger.exception("Unable to refund planner quota")
            if log_id is not None:
                completed_at = datetime.now(timezone.utc)
                changes = {
                    "status": final_status,
                    "output_chars": output_chars,
                    "response_payload_bytes": metrics.response_payload_bytes,
                    "sse_event_count": metrics.sse_event_count,
                    "parse_status": parse_status,
                    "fallback_reason": fallback_reason,
                    "result_format": final_result_format,
                    "unknown_destination_count": unknown_destination_count,
                    "partner_match_count": len(recommendations),
                    "partner_match_types": sorted(
                        {
                            row.get("type", "")
                            for row in recommendations
                            if row.get("type")
                        }
                    ),
                    "partner_selection_audit": [
                        {
                            "partner_id": row.get("partner_id", ""),
                            "type": row.get("type", ""),
                            "destination_ids": row.get("destination_ids", []),
                            "placement": row.get("placement", "organic"),
                            "relevance_score": row.get("relevance_score", 0),
                            "match_factor_codes": row.get("match_factor_codes", []),
                        }
                        for row in recommendations[:20]
                    ],
                    "partner_gap_keys": planner_partner_gap_keys(
                        used_destination_ids, recommendations, destinations_by_id
                    ),
                    "error": error_message,
                    "duration_ms": int(
                        (completed_at - started_at).total_seconds() * 1000
                    ),
                    "completed_at": completed_at.isoformat(),
                }
                try:
                    await asyncio.shield(self.logs.finish(log_id, changes))
                except Exception:
                    logger.exception("Unable to finalize planner log")
