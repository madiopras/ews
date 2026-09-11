# Phase 1 — Application Skeleton and Import Strategy Report

## Status

- Implemented: **2026-09-09 (Asia/Bangkok)**.
- Phase status: **Complete**.
- Public API contract change: **None**.
- Business route migration: **None; intentionally deferred**.
- Compatible runtime entrypoint: `uvicorn server:app`.

---

## 1. Outcome

Phase 1 introduces the target `backend/app/` package and transfers application-level FastAPI wiring out of the monolithic module. The 139 `/api` business routes remain defined in `server.py`, allowing existing imports and monkeypatches to keep working while later phases migrate one vertical slice at a time.

The application factory now owns:

- FastAPI instance creation and application metadata;
- startup and shutdown handler registration;
- `/health` route registration;
- top-level feature router aggregation;
- exception-handler registration hook;
- CORS middleware configuration.

`server.py` now supplies its legacy router, lifecycle handlers, health function, and current CORS values to the application factory. It no longer constructs `FastAPI` or installs middleware directly.

---

## 2. Added Structure

```text
backend/app/
├── __init__.py
├── main.py
├── api/
│   ├── __init__.py
│   ├── dependencies.py
│   ├── exception_handlers.py
│   └── router.py
├── core/
│   └── __init__.py
├── infrastructure/
│   └── __init__.py
├── modules/
│   └── __init__.py
└── shared/
    └── __init__.py
```

Empty feature packages were not pre-generated. They will be created only when a vertical slice moves, starting with destination reads in Phase 3. This avoids placeholder structure that has no owner or executable purpose.

---

## 3. Import and Compatibility Strategy

### Current transition state

```text
uvicorn server:app
        |
        v
server.py legacy routes and dependencies
        |
        v
app.main.create_app(...)
        |
        +--> health route
        +--> legacy /api router
        +--> lifecycle handlers
        +--> exception handlers
        +--> CORS middleware
```

The legacy entrypoint remains authoritative during the transition because several existing tests import symbols from `server` and monkeypatch its module globals. Moving those functions into a different module now would cause monkeypatches such as `server.db = fake_db` to stop affecting the function globals.

### Rules for upcoming phases

- New application-level wiring belongs in `app/main.py` or `app/api/`.
- Do not add new FastAPI instance construction to `server.py`.
- Existing business routes remain in `server.py` until their complete vertical slice is migrated.
- A migrated feature router is passed to or registered by the top-level router aggregator.
- Keep `uvicorn server:app` until legacy test and import coupling reaches zero.
- The canonical `app.main:app` entrypoint is intentionally deferred until import direction no longer requires `app` to load `server.py`.

---

## 4. Application Factory Contract

`create_app()` accepts explicit inputs for:

- an ordered sequence of API routers;
- an optional health endpoint;
- startup handlers;
- shutdown handlers;
- exception handler mappings;
- CORS origins;
- application title.

This makes independent application instances possible in tests without connecting to MongoDB or invoking the legacy startup function. Phase 2 will replace environment and database inputs with typed settings and lifespan-owned infrastructure.

---

## 5. Verification Results

### Phase 0 and Phase 1 fast gate

```bash
make test-backend-contract
```

Result:

```text
8 passed
```

Coverage includes:

- normalized OpenAPI equality;
- route inventory equality;
- duplicate method/path detection;
- no new test coupling to `server.py`;
- health and feature-router registration;
- isolated application instances;
- startup/shutdown hook execution;
- unchanged CORS policy.

### Existing unit, contract, and security suite

A selected in-process suite covering planner, saved results, Google auth, LLM security, Partner rules, and public serialization was run serially:

```text
101 passed, 1 warning in 1.74s
```

This includes legacy tests that monkeypatch `server.db` and other `server` symbols, confirming that the transition did not break their import behavior.

### Real process smoke test

The application was launched using:

```bash
cd backend
../.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Observed results:

| Check | Result |
|---|---|
| Application startup | PASS |
| MongoDB startup/index flow | PASS |
| Object storage initialization | PASS |
| `GET /health` | PASS; database connected |
| `GET /api/` | PASS |
| `GET /openapi.json` | PASS; 116 paths |
| Graceful shutdown | PASS |

---

## 6. OpenAPI and Route Contract Assessment

The Phase 0 baselines were not regenerated. `python -m scripts.phase0_contracts --check` passes against the original snapshot, proving that Phase 1 did not change:

- URL paths;
- HTTP methods;
- OpenAPI operation definitions;
- request/response schemas;
- route status codes;
- handler/dependency inventory;
- route registration uniqueness.

---

## 7. Known Transitional Constraints

1. `server.py` remains large and still owns all feature code. This is expected until Phase 3 onward.
2. MongoDB client and environment loading still happen at import time. This is Phase 2 scope.
3. Startup still creates indexes, seeds data/admin, and initializes storage. Phase 2 will introduce lifespan ownership, while later phases separate deployment jobs and storage.
4. Custom domain exception handlers do not exist yet. The registration hook is ready; typed exceptions are introduced with migrated use cases.
5. `app.main:app` is not yet a supported runtime target. Supporting it prematurely would reverse the intended dependency direction back into `server.py`.
6. The known non-green full-suite baseline from Phase 0 remains unchanged technical debt and is not reclassified as a Phase 1 regression.

---

## 8. Exit Criteria Assessment

| Exit criterion | Status | Evidence |
|---|---|---|
| Application factory can create isolated instances | PASS | Phase 1 factory test |
| Root API router aggregation exists | PASS | `app/api/router.py` and feature-router test |
| Exception handler composition point exists | PASS | `app/api/exception_handlers.py` |
| `/health`, `/api/`, and docs/OpenAPI continue working | PASS | Real-process smoke test |
| Compatible `server:app` entrypoint remains | PASS | Uvicorn startup test |
| No duplicate route | PASS | Phase 0 guard |
| OpenAPI public contract remains unchanged | PASS | Original snapshot still matches |
| Existing direct `server` monkeypatch tests remain functional | PASS | 101-test in-process suite |

Phase 1 is complete. Phase 2 can now centralize settings and move MongoDB ownership to a lifespan without combining that work with feature-route migration.
