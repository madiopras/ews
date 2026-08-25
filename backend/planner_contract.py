"""Pure travel-style rules shared by the AI Planner API and its tests."""

from typing import Literal, Optional

BudgetStyle = Literal["budget", "mid_range", "luxury"]
BUDGET_STYLES = ("budget", "mid_range", "luxury")

BUDGET_STYLE_COPY = {
    "budget": {
        "id": "Hemat — prioritaskan pilihan praktis dan efisien.",
        "en": "Budget — prioritize practical and efficient options.",
    },
    "mid_range": {
        "id": "Nyaman — seimbangkan kenyamanan dan fleksibilitas.",
        "en": "Mid-range — balance comfort and flexibility.",
    },
    "luxury": {
        "id": "Mewah — utamakan kenyamanan dan pengalaman yang lebih premium.",
        "en": "Luxury — prioritize comfort and more premium experiences.",
    },
}


def legacy_budget_style(budget: Optional[float], days: int) -> BudgetStyle:
    """Map legacy numeric values only so old clients and records remain usable."""
    per_day = float(budget or 0) / max(1, days)
    if per_day <= 500000:
        return "budget"
    if per_day <= 1125000:
        return "mid_range"
    return "luxury"


def resolved_budget_style(style: Optional[BudgetStyle], budget: Optional[float], days: int) -> BudgetStyle:
    return style or legacy_budget_style(budget, days)


def style_label(style: Optional[str], lang: str) -> str:
    if style in BUDGET_STYLE_COPY:
        return BUDGET_STYLE_COPY[style]["en" if lang == "en" else "id"].split(" — ", 1)[0]
    return "Legacy travel preference" if lang == "en" else "Preferensi perjalanan lama"


def planner_style_instruction(style: BudgetStyle, lang: str) -> str:
    locale = "en" if lang == "en" else "id"
    if locale == "en":
        return f"Travel style: {BUDGET_STYLE_COPY[style][locale]} Do not provide prices or cost estimates."
    return f"Gaya perjalanan: {BUDGET_STYLE_COPY[style][locale]} Jangan memberikan harga atau estimasi biaya."
