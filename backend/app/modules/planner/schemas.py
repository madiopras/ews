"""HTTP DTOs owned by the AI Trip Planner feature."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.modules.destinations.schemas import Category
from app.modules.planner.contract import BudgetStyle


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


class TripPlanIn(BaseModel):
    days: int = Field(..., ge=1, le=14)
    budget_style: Optional[BudgetStyle] = None
    budget: Optional[float] = Field(default=None, ge=0)
    interests: List[Category] = Field(default_factory=list, max_length=14)
    lang: Literal["id", "en"] = "id"
    extra_context: Optional[str] = Field(default="", max_length=200)
    previous_content: Optional[str] = Field(default="", max_length=20000)
    preferred_destination_ids: List[str] = Field(default_factory=list, max_length=10)
