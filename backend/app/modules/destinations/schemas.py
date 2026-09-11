"""Destination API request and response contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Category = Literal[
    "adventure",
    "beach",
    "camping",
    "culinary",
    "culture",
    "hotel",
    "hotspring",
    "island",
    "lake",
    "mountain",
    "nature",
    "tea",
    "viewpoint",
    "waterfall",
]

DestinationSort = Literal["updated", "name", "-name", "location", "-location"]


class DestinationIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    name_en: str | None = Field(default="", max_length=150)
    location: str = Field(..., min_length=2, max_length=200)
    category: Category
    price: float | None = Field(default=None, ge=0)
    description: str = Field(..., min_length=10, max_length=5000)
    description_en: str | None = Field(default="", max_length=5000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    source_label: str = Field(default="Explore Wisata Sumut", max_length=200)
    source_url: str | None = Field(default="", max_length=1000)
    editorial_reviewed_at: str | None = Field(default="", max_length=40)
    images: list[str] = Field(default_factory=list, max_length=10)
    video: str | None = Field(default="", max_length=1000)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    featured: bool = False
    is_active: bool = True


class DestinationOut(DestinationIn):
    id: str
    created_at: str
    updated_at: str = ""


class DestinationAdminPage(BaseModel):
    items: list[DestinationOut]
    total: int
    page: int
    page_size: int
    pages: int


class DestinationPublicPage(BaseModel):
    items: list[DestinationOut]
    total: int
    page: int
    page_size: int
    pages: int


class DestinationSuggestion(BaseModel):
    id: str
    name: str
    name_en: str = ""
    location: str
    category: str
    image: str = ""


class DestinationBatchIn(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=50)
