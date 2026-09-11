"""Saved and public itinerary API contracts."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.modules.planner.contract import BudgetStyle
from app.shared.planner_result import PlannerResultV2, PlannerStoredResultV2


class ItineraryIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    days: int = Field(..., ge=1, le=30)
    budget_style: BudgetStyle | None = None
    budget: float | None = Field(default=None, ge=0)
    interests: list[str] = Field(default_factory=list)
    content: str = Field(..., min_length=1)
    lang: Literal["id", "en"] = "id"
    destination_ids: list[str] = Field(default_factory=list, max_length=50)
    extra_context: str = Field(default="", max_length=500)
    result_version: Literal[2] | None = None
    structured_result: PlannerStoredResultV2 | None = None

    @model_validator(mode="after")
    def consistent_structured_result(self):
        if (self.result_version == 2) != (self.structured_result is not None):
            raise ValueError(
                "result_version=2 and structured_result must be provided together"
            )
        if (
            self.structured_result
            and self.destination_ids != self.structured_result.destination_ids
        ):
            raise ValueError("destination_ids must match structured_result")
        return self


class ItineraryUpdateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    days: int = Field(..., ge=1, le=30)
    budget_style: BudgetStyle | None = None
    budget: float | None = Field(default=None, ge=0)
    interests: list[str] = Field(default_factory=list, max_length=30)
    lang: Literal["id", "en"] = "id"
    destination_ids: list[str] = Field(default_factory=list, max_length=50)
    extra_context: str = Field(default="", max_length=500)
    result_version: Literal[2] | None = None
    structured_result: PlannerStoredResultV2 | None = None

    @model_validator(mode="after")
    def consistent_structured_result(self):
        if self.structured_result is not None and self.result_version != 2:
            raise ValueError("result_version=2 is required with structured_result")
        if self.result_version == 2 and self.structured_result is None:
            raise ValueError("structured_result is required with result_version=2")
        if (
            self.structured_result
            and self.destination_ids != self.structured_result.destination_ids
        ):
            raise ValueError("destination_ids must match structured_result")
        return self


class ItineraryDuplicateIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class ItineraryOut(BaseModel):
    id: str
    user_id: str
    title: str
    days: int
    budget: float | None = None
    budget_style: BudgetStyle | None = None
    interests: list[str]
    content: str
    lang: str
    created_at: str
    author_name: str = ""
    is_public: bool = False
    share_slug: str | None = None
    destination_ids: list[str] = Field(default_factory=list)
    extra_context: str = ""
    updated_at: str = ""
    duplicated_from_id: str | None = None
    result_version: Literal[2] | None = None
    structured_result: PlannerResultV2 | None = None


class PublicItineraryOut(BaseModel):
    title: str
    days: int
    budget: float | None = None
    budget_style: BudgetStyle | None = None
    interests: list[str]
    content: str
    lang: str
    created_at: str
    author_name: str
    destination_ids: list[str] = Field(default_factory=list)
    updated_at: str = ""
    result_version: Literal[2] | None = None
    structured_result: PlannerResultV2 | None = None


class ShareIn(BaseModel):
    public: bool
