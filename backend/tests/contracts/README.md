# Backend Contract Baselines

Files in this directory freeze the API and legacy test-coupling state recorded during Clean Architecture Phase 0.

- `openapi-baseline.json`: normalized complete OpenAPI contract.
- `routes-baseline.json`: method/path inventory plus handlers, status codes, response models, and dependencies.
- `server-coupling-baseline.json`: maximum approved direct test dependencies on legacy `server.py`.

Regenerate these files only for an intentional, reviewed contract change:

```bash
cd backend
python -m scripts.phase0_contracts --write
pytest -n 0 tests/test_phase0_contracts.py
```

Removing a legacy `server.py` dependency does not require updating the coupling baseline immediately. Adding a new dependency fails the test and is prohibited during the migration.
