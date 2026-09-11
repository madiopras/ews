"""Planner adapters for identity, settings, runtime LLM, and operational logs."""

from typing import Any

import jwt

from app.core import security
from app.core.config import Settings
from app.modules.administration.domain import feature_decision
from app.modules.administration.service import default_general_settings


class PlannerIdentityGateway:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.secret = settings.jwt_secret.get_secret_value()

    def identity_hash(self, value: str) -> str:
        return security.identity_hash(value, self.secret)

    def guest_identity(
        self, token: str | None, ttl_days: int
    ) -> tuple[str, str | None]:
        if token:
            try:
                payload = security.decode_token(token, self.secret)
                if payload.get("type") == "planner_guest" and payload.get("jti"):
                    return str(payload["jti"]), None
            except jwt.InvalidTokenError:
                pass
        return security.create_planner_guest_token(self.secret, ttl_days)


class PlannerSettingsGateway:
    def __init__(self, repository: Any, settings: Settings):
        self.repository = repository
        self.settings = settings

    async def read(self) -> dict:
        stored = await self.repository.get()
        return {
            **default_general_settings(self.settings),
            **{key: value for key, value in stored.items() if key != "_id"},
        }

    async def feature(self, name: str, user: dict | None, values: dict) -> dict:
        return feature_decision(name, values, user)


class PlannerLlmGateway:
    def __init__(self, profile_service: Any):
        self.profile_service = profile_service

    async def runtime(self) -> tuple[Any, dict]:
        return await self.profile_service.runtime()


class PlannerSystemLogGateway:
    def __init__(self, audit_service: Any):
        self.audit_service = audit_service

    async def failure(self, error: str, days: int, lang: str) -> None:
        await self.audit_service.system(
            "error",
            "ai_planner",
            "Trip planner request failed",
            {"error": error, "days": days, "lang": lang},
        )
