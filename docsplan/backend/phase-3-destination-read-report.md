# Phase 3 — Pilot Vertical Slice: Destinations Read API Report

## Status

- Implemented: **2026-09-10 (Asia/Bangkok)**.
- Phase status: **Complete**.
- Public API/OpenAPI change: **None**.
- Runtime entrypoint: `uvicorn server:app` remains compatible.

---

## 1. Outcome

The public destination read surface is now served by the first feature-first vertical slice under `app/modules/destinations`.

The slice owns seven operations:

| Method | Path | Use case |
|---|---|---|
| `GET` | `/api/destinations` | Public list and legacy filters |
| `GET` | `/api/destinations/search` | Search, sort, and pagination |
| `GET` | `/api/destinations/suggestions` | Autocomplete suggestions |
| `GET` | `/api/destinations/locations` | Public location values |
| `POST` | `/api/destinations/batch` | Ordered public batch lookup |
| `GET` | `/api/destinations/trending` | Wishlist-event trending order |
| `GET` | `/api/destinations/{dest_id}` | Public destination detail |

Destination admin and write operations intentionally remain in `server.py` for Phase 5 and Phase 7. They consume the extracted destination schemas and mapper through compatibility aliases.

---

## 2. Module Structure

```text
app/modules/destinations/
├── __init__.py
├── exceptions.py    # typed application errors
├── mapper.py        # Mongo document -> safe public DTO
├── ports.py         # repository Protocol
├── repository.py    # Motor/MongoDB read adapter
├── router.py        # FastAPI HTTP boundary
├── schemas.py       # request/response contracts
└── service.py       # filtering, normalization, pagination, ordering
```

Dependency direction:

```text
FastAPI router
    -> DestinationService
        -> DestinationReadRepository Protocol
            <- MongoDestinationRepository
```

Request composition is provided by `app/api/dependencies.py`:

```text
request.app.state.database
    -> MongoDestinationRepository
        -> DestinationService
            -> route handler
```

The service has no FastAPI, Motor, MongoDB, `ObjectId`, request, response, or `HTTPException` dependency. The router contains no database query.

---

## 3. Contract Compatibility

The following legacy behavior remains unchanged:

- documents with missing `is_active` remain publicly visible; only explicit `false` is hidden;
- `category=all` skips category filtering on the list endpoint;
- list results remain limited to 500 and sorted by newest `created_at`;
- search input is trimmed and capped at 100 characters;
- location input is trimmed and capped at 200 characters;
- search page is clamped to at least 1 and page size to 1–48;
- search sorting options and tie-breakers are unchanged;
- suggestion queries shorter than two characters return an empty list without a repository call;
- suggestion limit remains clamped to 1–10;
- location cleanup, case-sensitive deduplication, and case-insensitive ordering are preserved;
- batch IDs are deduplicated, invalid IDs return HTTP 400, inactive/missing IDs are omitted, and requested order is restored;
- trending order follows wishlist aggregation order and ignores invalid or inactive destination references;
- invalid detail IDs return `400 {"detail": "Invalid id"}`;
- missing/inactive destination detail returns `404 {"detail": "Not found"}`;
- unsafe editorial/media URLs remain removed from public DTOs;
- missing `updated_at` continues to fall back to `created_at`.

Typed application errors are converted to the legacy HTTP error body by handlers registered at the API boundary.

---

## 4. Contract Freeze Assessment

The normalized Phase 0 OpenAPI snapshot remains exactly equal:

- **116** paths;
- **140** operations;
- unchanged operation IDs;
- unchanged request/response schemas;
- unchanged query/path parameters and validation responses;
- no duplicate method/path registrations.

The internal route inventory was intentionally refreshed after review. Its changes are limited to:

- extracted destination schema ownership (`app.modules.destinations.schemas`);
- destination request composition through `get_database`, `get_destination_repository`, and `get_destination_service`.

No public OpenAPI snapshot change was required.

---

## 5. Tests

### Service unit and mapper parity

`tests/unit/test_destination_service.py` uses a fake repository to verify:

- the frozen legacy mapper fixture;
- public list rules;
- input normalization and pagination;
- suggestions and location behavior;
- batch deduplication and ordering;
- trending time-window delegation;
- detail and not-found behavior.

### API boundary

`tests/api/test_destination_read_api.py` uses `app.dependency_overrides` and no database to verify all seven route contracts, FastAPI validation, and typed error translation.

### Architecture

`tests/contract/test_destination_architecture.py` verifies that:

- the router has no MongoDB query or `ObjectId` parsing;
- the service has no FastAPI or database-driver dependency;
- `server.py` no longer registers any Phase 3 public read route.

### MongoDB integration

`tests/integration/test_destination_repository.py` creates an isolated UUID-named test database, verifies public visibility and search behavior, creates the shared index registry, checks the destination index fields, and drops only that isolated database during cleanup. It skips cleanly when MongoDB is unavailable.

---

## 6. Verification Results

Fast architecture and contract gate:

```text
make test-backend-contract
28 passed, 1 dependency warning
```

MongoDB integration gate:

```text
make test-backend-destination-integration
1 passed, 1 dependency warning
```

Selected cross-feature regression suite:

```text
122 passed, 1 dependency warning in 2.59s
```

Static verification:

```text
Black: pass
isort: pass
flake8 on app and Phase 3 tests: pass
mypy app --ignore-missing-imports: pass
compileall: pass
git diff --check: pass
```

Real-process Uvicorn smoke verification passed for health, list, search, suggestions, locations, trending, empty batch, invalid ID (400), missing ID (404), and graceful shutdown.

The remaining warning is Starlette's existing `multipart` import deprecation warning and is outside this refactor.

---

## 7. Transitional Constraints

1. Destination admin and mutations still live in `server.py` and use compatibility aliases.
2. The legacy list endpoint's raw regular-expression search behavior is preserved; hardening it would be a separately reviewed behavior change.
3. Location values that differ only by letter casing remain distinct for contract compatibility.
4. Trending still relies on ISO timestamp strings in `wishlist_events`.
5. Existing single-field destination indexes are preserved; introducing compound search indexes requires production query evidence and a separate migration review.
6. The repository returns persistence documents to the mapper because this read-only slice has no domain behavior that justifies a separate entity.

---

## 8. Exit Criteria

| Exit criterion | Status | Evidence |
|---|---|---|
| All scoped destination reads use the new module | PASS | Seven module routes and static ownership test |
| No MongoDB query in destination router | PASS | Architecture test |
| Response/error contract matches baseline | PASS | Exact OpenAPI equality, mapper fixture, API tests, smoke test |
| Legacy scoped routes removed | PASS | Static test and zero duplicate routes |
| Service testable with fake repository | PASS | Unit suite without FastAPI/MongoDB |
| Important MongoDB queries/indexes tested | PASS | Isolated real-database integration test |

Phase 3 is complete. Phase 4 can use this slice as the reference pattern while extracting authentication and authorization one use case at a time.
