#!/usr/bin/env bash
set -eu

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

echo "LLM configuration verification"

python - <<'PY'
from urllib.parse import urlsplit

from app.core.config import load_settings

settings = load_settings()
endpoint = urlsplit(settings.llm_base_url)
print(f"configuration: ok ({settings.environment})")
print(f"LLM enabled: {settings.use_llm}")
print(f"LLM endpoint: {endpoint.scheme}://{endpoint.hostname or 'invalid'}")
print(f"LLM model configured: {bool(settings.llm_model_name.strip())}")
print(f"LLM credential configured: {bool(settings.llm_api_key.get_secret_value())}")
PY

python - <<'PY'
from app.main import app
from app.modules.planner.gateways import PlannerLlmGateway

assert app.title
assert PlannerLlmGateway
print("application and planner gateway imports: ok")
PY

echo "Use the planner contract tests for provider-free verification:"
echo "python -m pytest -n 0 tests/test_llm_security_unit.py tests/unit/test_planner_services.py -q"
