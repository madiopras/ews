import sys
from pathlib import Path

import pytest
from pydantic import TypeAdapter, ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from planner_contract import BUDGET_STYLES, BudgetStyle, planner_style_instruction, resolved_budget_style, style_label


def test_budget_style_schema_allows_only_the_three_supported_values():
    schema = TypeAdapter(BudgetStyle)
    assert [schema.validate_python(style) for style in BUDGET_STYLES] == list(BUDGET_STYLES)
    with pytest.raises(ValidationError):
        schema.validate_python("premium")


def test_every_travel_style_has_localized_label_and_price_free_instruction():
    expected_id = {"budget": "Hemat", "mid_range": "Nyaman", "luxury": "Mewah"}
    expected_en = {"budget": "Budget", "mid_range": "Mid-range", "luxury": "Luxury"}

    for style in BUDGET_STYLES:
        assert style_label(style, "id") == expected_id[style]
        assert style_label(style, "en") == expected_en[style]
        assert "estimasi biaya" in planner_style_instruction(style, "id")
        assert "cost estimates" in planner_style_instruction(style, "en")


def test_legacy_numeric_payloads_still_resolve_to_a_travel_style():
    assert resolved_budget_style(None, 500000, 1) == "budget"
    assert resolved_budget_style(None, 1500000, 2) == "mid_range"
    assert resolved_budget_style(None, 3000000, 1) == "luxury"
    assert resolved_budget_style("luxury", 0, 3) == "luxury"
