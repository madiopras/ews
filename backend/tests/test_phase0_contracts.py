"""Architecture migration safety nets captured in Phase 0."""

from __future__ import annotations

import json
from pathlib import Path

from app.main import app
from scripts import phase0_contracts as contracts


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_openapi_contract_matches_phase0_baseline():
    assert contracts.normalized_openapi(app) == load_json(contracts.OPENAPI_BASELINE), (
        "The public OpenAPI contract changed. If intentional, review the change and run "
        "`python -m scripts.phase0_contracts --write` from backend/."
    )


def test_route_inventory_matches_phase0_baseline():
    assert contracts.route_inventory(app) == load_json(contracts.ROUTES_BASELINE), (
        "Route metadata changed. Preserve the Phase 0 contract or regenerate the baseline "
        "only after an intentional API review."
    )


def test_application_has_no_duplicate_method_path_pairs():
    assert contracts.duplicate_routes(app) == {}


def test_no_tests_couple_to_legacy_server_module():
    actual = contracts.scan_server_coupling()
    assert (
        actual == load_json(contracts.COUPLING_BASELINE) == {}
    ), "Tests must target canonical modules or public APIs, never the server.py shim."
