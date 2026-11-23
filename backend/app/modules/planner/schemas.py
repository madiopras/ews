"""HTTP DTOs owned by the AI Trip Planner feature."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.modules.destinations.schemas import Category
from app.modules.planner.contract import BudgetStyle
from app.modules.planner.geo import StartingPoint, TravelPace


class PlannerAnalyticsEventIn(BaseModel):
    """Minimal, consented planner-funnel event. It deliberately has no story field."""

    model_config = {"extra": "forbid"}

    event_id: str = Field(..., min_length=16, max_length=80)
    event_type: Literal[
        "planner_story_submitted",
        "planner_step_shown",
        "planner_step_completed",
        "planner_generated",
    ]
    step: Literal["story", "basics", "interests", "result"]
    anonymous_session_id: str = Field(..., min_length=16, max_length=80)


class PlannerFeedbackIn(BaseModel):
    """Privacy-safe thumbs up/down itinerary feedback; no free-text or story field."""

    model_config = {"extra": "forbid"}

    generation_id: str = Field(..., min_length=8, max_length=80)
    rating: Literal["up", "down"]
    reason_code: Optional[
        Literal[
            "route_too_far",
            "mismatch_interests",
            "too_packed",
            "great_route",
            "helpful_partners",
            "other",
        ]
    ] = None
    lang: Literal["id", "en"] = "id"


class TripPlanIn(BaseModel):
    days: int = Field(..., ge=1, le=14)
    budget_style: Optional[BudgetStyle] = None
    budget: Optional[float] = Field(default=None, ge=0)
    interests: List[Category] = Field(default_factory=list, max_length=14)
    lang: Literal["id", "en"] = "id"
    extra_context: Optional[str] = Field(default="", max_length=500)
    previous_content: Optional[str] = Field(default="", max_length=20000)
    preferred_destination_ids: List[str] = Field(default_factory=list, max_length=10)
    starting_point: Optional[StartingPoint] = None
    travel_pace: Optional[TravelPace] = None
    refinement_instruction: Optional[str] = Field(default="", max_length=240)
    target_day: Optional[int] = Field(default=None, ge=1, le=14)
