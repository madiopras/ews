"""HTTP contracts for premium plans and payments."""

from typing import Literal

from pydantic import BaseModel, Field

DEFAULT_PLANS = [
    {
        "code": "1m",
        "label_id": "Unggulan 1 Bulan",
        "label_en": "Featured 1 Month",
        "months": 1,
        "price": 99000,
        "active": True,
        "order": 1,
    },
    {
        "code": "3m",
        "label_id": "Unggulan 3 Bulan",
        "label_en": "Featured 3 Months",
        "months": 3,
        "price": 249000,
        "active": True,
        "order": 2,
    },
    {
        "code": "12m",
        "label_id": "Unggulan 1 Tahun",
        "label_en": "Featured 1 Year",
        "months": 12,
        "price": 799000,
        "active": True,
        "order": 3,
    },
]


class PlanIn(BaseModel):
    code: str = Field(
        ..., min_length=1, max_length=20, pattern=r"^[a-z0-9][a-z0-9_-]*$"
    )
    label_id: str = Field(..., min_length=1, max_length=100)
    label_en: str = Field(..., min_length=1, max_length=100)
    months: int = Field(..., ge=1, le=36)
    price: int = Field(..., ge=0)
    active: bool = True
    order: int = Field(1, ge=1, le=999)


class PlanOut(PlanIn):
    id: str
    created_at: str = ""
    updated_at: str = ""


class PlanAdminPage(BaseModel):
    items: list[PlanOut]
    total: int
    page: int
    page_size: int
    pages: int


class SnapTokenIn(BaseModel):
    partner_id: str
    plan_code: str


PlanStatus = Literal["all", "active", "inactive"]
