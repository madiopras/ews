# Phase 2 — Configuration, Database Lifecycle, and Shared Security Report

## Status

- Implemented: **2026-09-10 (Asia/Bangkok)**.
- Phase status: **Complete**.
- Public API/OpenAPI change: **None**.
- Runtime entrypoint: `uvicorn server:app` remains compatible.

---

## 1. Outcome

Phase 2 replaces scattered environment access with typed settings, moves MongoDB client ownership into the FastAPI lifespan, extracts shared security primitives, and moves all existing MongoDB index declarations into an idempotent registry.

The backend retains compatibility with legacy functions in `server.py`:

- `server.db` and `server.client` still exist, but are `None` after import;
- lifespan creates the Mongo client and binds the database before legacy startup runs;
- lifespan closes the client and clears the legacy bindings during shutdown;
- tests can still monkeypatch `server.db` when invoking legacy functions directly;
- legacy helper names such as `hash_password`, `verify_password`, and `create_access_token` remain available.

---

## 2. Typed Settings

Implementation: `backend/app/core/config.py`.

The `Settings` model groups:

- MongoDB and JWT;
- runtime environment, application name, CORS, cookies, public URL, and backup path;
- admin bootstrap configuration;
- Google Identity;
- LLM environment client, encrypted profiles, host allowlist, and private-network policy;
- SMTP and SMS;
- local/remote object storage;
- sandbox and production Midtrans credentials;
- reserved Redis configuration.

Key properties:

- the backend `.env` location is resolved relative to the package rather than the process working directory;
- unknown environment fields are ignored during transition;
- boolean, integer, `Path`, enum, and secret values are parsed into typed fields;
- secrets use `SecretStr` and are masked in model representations;
- Google Client ID is required only when Google OAuth is enabled;
- LLM endpoint/model are required only when LLM is enabled;
- SMTP password is required when SMTP username authentication is configured;
- Midtrans credentials are selected and validated only when the payment feature requests them;
- private LLM URLs default to allowed outside production and denied in production;
- `load_settings()` provides a fresh snapshot for explicitly runtime-sensitive validation, while `get_settings()` provides the cached process configuration.

`backend/server.py` no longer calls `os.environ` or `load_dotenv` directly. `backend/.env.example` now documents every application configuration group without real credentials.

---

## 3. MongoDB Lifespan

Implementation: `backend/app/infrastructure/database/mongo.py`.

Lifecycle sequence:

```text
FastAPI lifespan starts
    -> create AsyncIOMotorClient
    -> select configured database
    -> bind client/database to app.state
    -> bind temporary legacy server.client/server.db aliases
    -> run legacy startup/index/seed flow
    -> serve requests
    -> run registered shutdown handlers
    -> close Mongo client
    -> clear legacy aliases
```

Benefits delivered:

- importing `app` does not import Motor or `server.py`;
- importing `server.py` no longer constructs a Mongo client;
- each application instance owns its Mongo client;
- startup failure still closes the client through the lifespan `finally` block;
- test applications can inject a fake client factory;
- request-scoped code can use `get_database()` instead of a global.

Application state now exposes:

- `request.app.state.database`;
- `request.app.state.mongo_client`;
- `request.app.state.settings`.

Providers are available in `backend/app/api/dependencies.py`.

---

## 4. Index Registry

Implementation: `backend/app/infrastructure/database/indexes.py`.

- Registered indexes: **67**.
- Collections covered: **23**.
- Index creation remains idempotent through MongoDB `create_index`.
- Legacy startup calls one `ensure_indexes(database)` operation.
- An automated parity check against the pre-refactor `server.py` confirmed **67/67 exact matches**, including order, compound keys, uniqueness, sparse indexes, partial filters, and TTL options.

Index creation remains part of application startup for compatibility. Moving it to a deployment/migration job remains a Phase 10 operational improvement.

---

## 5. Shared Security

Implementation: `backend/app/core/security.py`.

Extracted primitives:

- bcrypt password hashing and verification;
- generic JWT encode/decode;
- access token creation;
- deterministic HMAC identity hashing;
- Planner guest identity/token creation;
- access-token security cookie;
- Planner guest security cookie;
- shared token/cookie constants.

The dummy login hash is now a static valid bcrypt hash. This preserves timing work for unknown-account login attempts without generating a new bcrypt hash during module import.

Compatibility retained:

- JWT algorithm and claims;
- seven-day access-token lifetime;
- cookie names;
- `HttpOnly`, `Secure`, and `SameSite` behavior;
- access cookie path `/`;
- Planner guest cookie path `/api`;
- invalid password hashes return `False` instead of exposing bcrypt errors.

---

## 6. Dependency and Configuration Changes

Added runtime dependency:

```text
pydantic-settings>=2.2.1,<3.0.0
```

The local environment resolved version `2.15.0`. The version range remains compatible with Pydantic v2 and prevents an unreviewed major-version upgrade.

`make test-backend-contract` now runs Phase 0, Phase 1, and Phase 2 foundation tests.

---

## 7. Verification Results

### Fast architecture/contract gate

```bash
make test-backend-contract
```

Result:

```text
Phase 0 API baselines match.
18 passed, 1 dependency warning
```

### In-process regression suite

The selected suite includes application foundation, auth, Google identity, LLM security, Planner contracts/stream orchestration, saved results, Partner rules, and public serialization:

```text
112 passed, 1 dependency warning in 2.32s
```

### Static verification

```text
Black: pass
isort: pass
flake8 on app/foundation tests: pass
mypy app --ignore-missing-imports: pass
compileall: pass
git diff --check: pass
```

### Real-process smoke test

| Check | Result |
|---|---|
| `uvicorn server:app` startup | PASS |
| Mongo client creation during lifespan | PASS |
| Index/startup initialization | PASS |
| `GET /health` | PASS; database connected |
| `GET /api/` | PASS |
| Google config endpoint | PASS |
| Invalid login security path | PASS; HTTP 401 |
| Graceful shutdown/client close | PASS |

The remaining warning comes from Starlette importing the deprecated `multipart` module name and is outside this refactor.

---

## 8. Contract Assessment

The Phase 0 OpenAPI and route baselines were not regenerated. The original snapshot still matches:

- 116 OpenAPI paths;
- 140 OpenAPI operations;
- existing methods and status codes;
- request/response schemas;
- route dependencies and handler names;
- zero duplicate method/path registrations.

The `PUBLIC_APP_URL` read used by share metadata remains fresh per invocation so existing tests that temporarily override the environment retain their behavior. Process-level configuration remains cached for normal application use.

---

## 9. Known Transitional Constraints

1. Legacy endpoints still access `server.db`; new modules must use injected repositories or `get_database()`.
2. Startup still creates indexes and seeds/mutates default data for compatibility.
3. Object storage initialization still performs synchronous I/O during startup.
4. LLM client and activation lock remain process-global until Planner extraction.
5. Existing full integration suite technical debt documented in Phase 0 remains outside this phase.
6. Admin bootstrap defaults are preserved for backward compatibility; production deployment must provide explicit credentials.
7. `server.py` continues to expose configuration aliases required by legacy tests; new code must depend on `Settings` instead.

---

## 10. Exit Criteria Assessment

| Exit criterion | Status | Evidence |
|---|---|---|
| Typed settings implemented | PASS | Pydantic Settings model and tests |
| Feature-conditional validation | PASS | Google, LLM, SMTP, and Midtrans tests |
| Mongo client owned and closed by lifespan | PASS | Fake-client lifecycle test and real smoke test |
| Database dependency available | PASS | Request dependency integration test |
| Shared password/JWT/cookie utilities extracted | PASS | Security primitive regression tests |
| Index definitions centralized and idempotent | PASS | Registry test and 67/67 parity check |
| Importing application package has no DB side effect | PASS | Clean subprocess import test |
| New code has no direct `os.environ` access | PASS | Source audit |
| Health contract remains compatible | PASS | OpenAPI gate and real smoke test |

Phase 2 is complete. Phase 3 can introduce the first feature module using typed settings, injected MongoDB access, repository boundaries, and the existing contract safety net.
