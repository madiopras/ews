"""HTTP and SSE contract coverage for the modular planner router."""

import json

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.modules.auth.dependencies import get_optional_user
from app.modules.planner.dependencies import (
    get_planner_analytics_service,
    get_planner_generation_service,
    get_planner_quota_service,
    get_planner_settings,
)
from app.modules.planner.router import EXCEPTION_HANDLERS, router
from app.modules.planner.service import PreparedPlannerStream
from app.modules.planner.sse import PlannerStreamMetrics


class FakeAnalytics:
    async def track(self, payload, consent):
        return {"accepted": consent, "event": payload.event_type}


class FakeSettings:
    async def read(self):
        return {"planner_guest_trial_enabled": True}


class FakeQuota:
    async def status(self, _user, _token, _settings):
        return (
            {
                "authenticated": False,
                "limit": 1,
                "remaining": 1,
                "login_required": False,
            },
            "signed-guest-token",
            180,
        )


class FakeGeneration:
    async def prepare(self, payload, _user, _token, _ip):
        async def events():
            yield {"text": f"## Hari 1\n{payload.days} hari"}
            yield {
                "recommendations": [],
                "destination_ids": ["dest-1"],
                "result_format": "legacy",
            }
            yield {"done": True, "result_format": "legacy"}

        return PreparedPlannerStream(
            events=events(),
            metrics=PlannerStreamMetrics(),
            cookie_token=None,
            cookie_ttl_days=0,
        )


def make_client():
    application = create_app(
        api_routers=(router,),
        exception_handlers=EXCEPTION_HANDLERS,
        settings=get_settings(),
    )
    application.dependency_overrides.update(
        {
            get_optional_user: lambda: None,
            get_planner_analytics_service: FakeAnalytics,
            get_planner_settings: FakeSettings,
            get_planner_quota_service: FakeQuota,
            get_planner_generation_service: FakeGeneration,
        }
    )
    return TestClient(application)


def analytics_payload():
    return {
        "event_id": "event1234567890123456",
        "event_type": "planner_step_shown",
        "step": "story",
        "anonymous_session_id": "session12345678901234",
    }


def test_analytics_consent_and_quota_cookie_contracts():
    with make_client() as client:
        denied = client.post("/api/analytics/planner-events", json=analytics_payload())
        assert denied.json() == {
            "accepted": False,
            "event": "planner_step_shown",
        }
        accepted = client.post(
            "/api/analytics/planner-events",
            json=analytics_payload(),
            headers={"x-analytics-consent": "granted"},
        )
        assert accepted.json()["accepted"] is True
        quota = client.get("/api/planner/quota")
        assert quota.json()["remaining"] == 1
        assert "planner_guest=signed-guest-token" in quota.headers["set-cookie"]


def test_stream_preserves_sse_event_order_headers_and_legacy_result():
    with make_client() as client:
        response = client.post(
            "/api/trip-planner/stream",
            json={"days": 1, "budget_style": "budget", "interests": ["nature"]},
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["x-accel-buffering"] == "no"
        events = [
            json.loads(line.removeprefix("data: "))
            for line in response.text.splitlines()
            if line.startswith("data: ")
        ]
        assert [next(iter(event)) for event in events] == [
            "text",
            "recommendations",
            "done",
        ]
        assert events[-1] == {"done": True, "result_format": "legacy"}
