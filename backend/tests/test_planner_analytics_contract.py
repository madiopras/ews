import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server import PlannerAnalyticsEventIn


def valid_event(**overrides):
    payload = {
        "event_id": "event1234567890123456",
        "event_type": "planner_step_shown",
        "step": "story",
        "anonymous_session_id": "session12345678901234",
    }
    payload.update(overrides)
    return payload


def test_planner_analytics_accepts_only_supported_funnel_events():
    for event_type in (
        "planner_story_submitted",
        "planner_step_shown",
        "planner_step_completed",
        "planner_generated",
    ):
        event = PlannerAnalyticsEventIn(**valid_event(event_type=event_type))
        assert event.event_type == event_type

    with pytest.raises(ValidationError):
        PlannerAnalyticsEventIn(**valid_event(event_type="planner_story_saved"))


def test_planner_analytics_rejects_story_and_preference_fields():
    with pytest.raises(ValidationError):
        PlannerAnalyticsEventIn(**valid_event(extra_context="cerita pribadi pengguna"))
    with pytest.raises(ValidationError):
        PlannerAnalyticsEventIn(**valid_event(interests=["nature"]))
