# Phase 4 — Authentication, Users, and Authorization Dependencies Report

## Status

- Implemented: **2026-09-10 (Asia/Bangkok)**.
- Phase status: **Complete**.
- Public API/OpenAPI change: **None**.
- Runtime entrypoint: `uvicorn server:app` remains compatible.

---

## 1. Outcome

Authentication, user profile, account privacy operations, and authorization dependencies are now owned by `app/modules/auth`.

The module serves thirteen existing operations:

| Method | Path | Use case |
|---|---|---|
| `POST` | `/api/auth/register` | Password registration and consent |
| `POST` | `/api/auth/login` | Password login |
| `POST` | `/api/auth/logout` | Session-cookie removal |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/auth/google/config` | Public Google GIS configuration |
| `POST` | `/api/auth/google` | Google sign-in and account linking |
| `POST` | `/api/auth/forgot-password` | Enumeration-safe reset request |
| `POST` | `/api/auth/reset-password` | Single-use password reset |
| `POST` | `/api/auth/verify-email` | Email verification |
| `POST` | `/api/auth/verify-email/resend` | Verification token rotation |
| `PUT` | `/api/profile` | Profile update and denormalized-name sync |
| `GET` | `/api/account/export` | Privacy-safe account export |
| `DELETE` | `/api/account` | Account and owned-data cleanup |

`get_current_user`, `get_optional_user`, and `require_admin` are defined by the auth module and are used by protected legacy endpoints as well as new routers. `server.py` imports these dependencies but no longer defines them.

---

## 2. Module Structure

```text
app/modules/auth/
├── __init__.py
├── dependencies.py  # token extraction and authorization dependencies
├── exceptions.py    # typed application/gateway errors
├── gateways.py      # Google token verification and email delivery
├── mapper.py        # user response and authenticated identity redaction
├── ports.py         # repository and gateway Protocols
├── repository.py    # Mongo user, account graph, and rate-limit adapters
├── router.py        # HTTP/cookie/download boundary
├── schemas.py       # auth/profile/account DTOs
├── service.py       # isolated use-case classes
└── tokens.py        # access/action token policy
```

Use cases are separated into:

- `IdentityService`;
- `RegisterUser`;
- `LoginUser`;
- `GoogleLoginUser`;
- `RecoverCredentials`;
- `ManageAccount`;
- `AuthRateLimiter`.

There is no single stateful `AuthService`. Each use case receives only the repository, token policy, limiter, or gateway it needs.

---

## 3. Dependency Direction

```text
FastAPI router/dependency
    -> focused auth use case
        -> UserRepository / RateLimitRepository / gateway Protocol
            <- MongoDB, Google SDK, SMTP/outbox adapters
```

The service layer has no FastAPI, Motor, MongoDB, `ObjectId`, `Request`, `Response`, `Depends`, or `HTTPException` dependency.

Token parsing is handled at the API boundary with the original precedence:

```text
access_token cookie
    -> Authorization: Bearer fallback
        -> access JWT validation
            -> user lookup
                -> active-account check
                    -> auth_session_version check
```

Typed `AuthError` instances are translated to the existing `{"detail": ...}` response by the registered API exception handler.

---

## 4. Security Contract Preserved

- access tokens retain HS256, existing claims, and seven-day expiry;
- access cookie remains `HttpOnly`, uses path `/`, and preserves environment-driven `Secure`/`SameSite` behavior;
- logout, reset, and account deletion clear the same cookie/path;
- unknown-account login still verifies against a static valid dummy bcrypt hash;
- bcrypt hashing and verification run in worker threads for auth requests;
- inactive accounts remain HTTP 403;
- stale `auth_session_version` remains HTTP 401 with `Session has been revoked`;
- non-admin access to admin dependencies remains HTTP 403;
- registration consent and duplicate-email errors are unchanged;
- email verification tokens retain a 24-hour lifetime and version rotation;
- password reset tokens retain a 30-minute lifetime and single-use version check;
- password reset atomically checks the stored version, increments session version, and deletes stored sessions;
- forgot-password responses remain account-enumeration safe;
- Google linking preserves existing role, password hash, and non-empty user name;
- Google verification remains isolated behind a gateway and runs outside the event loop;
- account export removes password/token version fields and Midtrans/Snap secrets;
- account deletion retains password confirmation, admin protection, anonymization, ownership release, and related-data cleanup.

All original rate-limit action names, thresholds, windows, normalized identifiers, bucket calculation, and TTL behavior remain intact.

---

## 5. Compatibility Adapters

Three flows outside the Phase 4 route scope already depended on auth infrastructure:

- content report rate limiting;
- Partner/governance email delivery;
- Partner workspace frontend links.

`server.py` temporarily retains thin adapters named `enforce_auth_rate_limit`, `deliver_auth_email`, and `auth_frontend_url`. They delegate to the new rate limiter/email gateway or typed settings and contain no duplicate auth policy. They can be removed when governance and notifications migrate.

Shared compatibility aliases for password/JWT helpers remain available because startup and existing non-auth tests still consume them.

---

## 6. Contract Freeze Assessment

The normalized Phase 0 OpenAPI snapshot remains exactly equal:

- **116** paths;
- **140** operations;
- unchanged operation IDs and summaries;
- unchanged request/response schemas;
- unchanged validation responses;
- zero duplicate method/path registrations.

The internal route inventory was intentionally refreshed because auth route ownership and authorization dependency callables moved to `app.modules.auth`. This affects internal dependency metadata across protected endpoints, but not the public API.

The legacy-coupling baseline improved from ten test files to nine: `test_google_auth_direct.py` no longer imports or monkeypatches `server.py`.

---

## 7. Tests

### Framework-free service tests

`tests/unit/test_auth_services.py` verifies identity redaction, session revocation, rate limits, consent, registration, dummy-hash login behavior, inactive accounts, Google failure handling, password/token version rotation, profile normalization, export redaction, and account deletion using fake repositories/gateways.

### Google gateway tests

`tests/test_google_auth_direct.py` now tests Google audience/claim normalization and account linking without `server.py`, MongoDB, or network access.

### HTTP boundary tests

`tests/api/test_auth_api.py` uses FastAPI dependency overrides to verify all auth/profile/account response, cookie, validation, download, and error contracts without external services.

### Architecture tests

`tests/contract/test_auth_architecture.py` verifies that the router has no database/provider SDK calls, the service is framework/database-driver independent, legacy auth route decorators are absent, and authorization dependency ownership moved out of `server.py`.

### MongoDB integration

`tests/integration/test_auth_repository.py` uses a UUID-named isolated database to verify user lookup, active filtering, unique email index, atomic password-reset version checks, profile denormalization, and rate-limit increments. Cleanup drops only the database created by the test.

---

## 8. Verification Results

Fast contract/foundation gate:

```text
make test-backend-contract
47 passed, 1 dependency warning
```

Auth MongoDB integration gate:

```text
make test-backend-auth-integration
1 passed, 1 dependency warning
```

Selected cross-feature regression suite:

```text
136 passed, 1 dependency warning in 5.91s
```

Static verification:

```text
Black: pass
isort: pass
flake8 on app and Phase 4 tests: pass
mypy app --ignore-missing-imports: pass
compileall: pass
git diff --check: pass
```

Real-process Uvicorn smoke verification passed for Google config, register, current user, profile update, account export/redaction, admin denial, forgot password, invalid reset token, logout, password login, session revocation, login after revocation, account deletion, and graceful shutdown. The isolated smoke account and email outbox records were removed.

The remaining warning is Starlette's existing `multipart` import deprecation warning and is outside this refactor.

---

## 9. Transitional Constraints

1. Account deletion spans multiple collections without a MongoDB transaction, preserving the previous behavior; compensating/transactional deletion should be assessed separately.
2. Email outbox and SMTP implementation currently live behind the auth gateway and can move to `infrastructure/email` when notifications migrate.
3. Protected legacy route functions remain in `server.py`, but their identity and authorization decisions now use the extracted dependency.
4. User documents remain dictionaries because this phase has no domain behavior requiring a separate entity model.
5. Redis remains reserved; rate limiting continues to use atomic MongoDB bucket documents.
6. Compatibility password/JWT helpers in `server.py` should be removed only after startup and remaining tests migrate.

---

## 10. Exit Criteria

| Exit criterion | Status | Evidence |
|---|---|---|
| Protected endpoints use the new identity foundation | PASS | Module-owned dependencies and route inventory |
| Auth services test without FastAPI/MongoDB | PASS | Fake repository/gateway unit suite |
| Cookie and security contracts preserved | PASS | API tests, security regression, real smoke test |
| Google OAuth tests require no network | PASS | Fake gateway and patched SDK boundary |
| Session revocation remains enforced | PASS | Unit and real-process test |
| Auth/account routes removed from `server.py` | PASS | Architecture test and duplicate-route gate |
| Public API remains compatible | PASS | Exact OpenAPI equality and contract gate |

Phase 4 is complete. Phase 5 can now depend on the extracted identity boundary while migrating destination mutations, wishlist, reviews, and itineraries.
