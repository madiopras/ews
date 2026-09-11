# Phase 8 — Planner dan LLM Report

## Status

**Selesai.** Ketiga operasi HTTP Planner telah dipindahkan dari `backend/server.py` ke vertical slice modular. Frozen OpenAPI tetap 116 paths/140 operations tanpa duplicate method/path dan tanpa perubahan nama maupun urutan event SSE.

## Hasil Implementasi

Feature package baru berada di `backend/app/modules/planner/`:

| File | Tanggung jawab |
|---|---|
| `schemas.py` | request DTO untuk planner generation dan consented funnel analytics |
| `domain.py` | pure policy untuk context sanitization, partner catalog normalization, recommendation ranking, fairness, gap keys, dan legacy prompt |
| `repositories.py` | MongoDB adapter terpisah untuk quota, catalog, analytics, dan operational logs |
| `gateways.py` | identity hashing/signed guest identity, settings/rollout, active LLM runtime, dan redacted system log adapters |
| `service.py` | quota status/reservation serta streaming generation orchestration |
| `sse.py` | satu serializer eksplisit untuk semantic event menjadi SSE wire format |
| `dependencies.py` | request-scoped composition untuk seluruh planner ports |
| `router.py` | HTTP transport tipis untuk analytics, quota, dan generation stream |

`backend/server.py` kini hanya mendaftarkan Planner router dan exception handler serta me-re-export beberapa pure policy/schema untuk compatibility. Seluruh route handler, quota persistence, catalog query, recommendation implementation, dan streaming orchestration legacy sudah dihapus dari file tersebut.

Sesuai strategi migrasi, `planner_contract.py`, `planner_guard.py`, `planner_result_contract.py`, dan `planner_structured_engine.py` tetap menjadi pure modules dan digunakan melalui import compatibility. Pemindahan namespace fisiknya ditunda sampai Phase 10 agar tidak mematahkan consumer/test import yang telah stabil.

## Streaming Orchestration dan SSE Contract

`PlannerGenerationService` menghasilkan semantic events berbentuk dictionary. Hanya `sse.py` yang mengubah event tersebut menjadi `data: <json>\n\n`. Dengan demikian application service dapat diuji tanpa FastAPI, HTTP server, atau provider LLM nyata.

Urutan dan nama event lama dipertahankan:

- structured: `progress/generating`, optional progress, `progress/validating`, `progress/hydrating`, `text`, result/recommendation, lalu `done`;
- legacy: zero atau lebih `text`, recommendation result, lalu `done`;
- provider failure: localized `error` dengan safe error code tanpa raw provider detail;
- malformed structured output: memakai output yang sama sebagai legacy fallback tanpa panggilan LLM atau quota kedua.

Response tetap memakai `text/event-stream`, `Cache-Control: no-cache`, dan `X-Accel-Buffering: no`. Payload byte count dan event count dicatat oleh serializer yang sama dengan response aktual sehingga operational metrics tidak drift dari wire format.

## Quota dan Cancellation Safety

Quota dibagi untuk authenticated user, signed Guest identity, dan coarse daily network guard. Reservation menggunakan conditional Mongo update dengan per-document atomic predicate yang menghitung `consumed_count + active reservations`.

Lifecycle quota:

1. reserve dilakukan sesudah scope guard, feature decision, catalog validation, dan active LLM validation;
2. consume dilakukan tepat satu kali saat chunk provider pertama diterima;
3. failure/timeout/empty response sebelum chunk pertama melakukan refund;
4. guest network rejection mengembalikan reservation identity utama;
5. concurrent tabs dengan identity sama tidak dapat melewati limit;
6. cancellation/disconnect sebelum chunk pertama ditandai `cancelled` dan direfund melalui shielded cleanup;
7. reservation stale tetap dibersihkan setelah lima menit untuk recovery worker/process interruption.

Consume dan refund bersifat conditional/idempotent terhadap reservation ID sehingga pengulangan cleanup tidak menaikkan penggunaan dua kali.

## Structured Result dan Legacy Compatibility

Provider hanya boleh menulis prose dan memilih destination ID dari allowlist. Destination cards, partner identity, contact, premium disclosure, dan public metadata selalu dihydrate dari database.

Structured result v2 mempertahankan:

- bounded destination catalog dengan preferred destination retention;
- schema validation, exact day count, contiguous days, stop deduplication, dan unknown ID removal;
- privacy-safe database hydration;
- deterministic markdown compatibility view;
- single-call legacy fallback untuk malformed JSON;
- persisted result yang hanya menyimpan stable references, bukan partner/contact snapshot.

Legacy numeric budget dan `budget_style` baru tetap didukung. Scope guard masih berjalan sebelum quota reservation dan memblokir prompt injection serta permintaan non-travel yang eksplisit.

## Partner Recommendation dan Governance

Recommendation ranking sekarang pure dan dapat menerima `rotation_day` eksplisit dalam test. Sinyal ranking tetap terbatas pada destination coverage, requested service type, service tag match, multi-destination coverage, dan daily rotation tiebreaker.

Premium status tidak menambah relevance score. Featured placement dibatasi satu per type, maksimum dua listing per type dan delapan secara global, serta slot organic dipertahankan ketika kandidat dengan relevance setara tersedia. Hanya partner approved, active, accepting contacts, dan memiliki nomor WhatsApp valid yang dapat dihydrate ke response.

Planner log menyimpan aggregate-safe audit fields: selected partner IDs/types, placement, relevance, factor codes, destination-area/type gaps, parse status, fallback reason, result format, duration, event count, dan payload size. Cerita atau `extra_context` user tidak disimpan.

## Contract dan Test Coverage

Test baru:

- `tests/unit/test_planner_services.py` — concurrent reservation, idempotent consume, network refund, timeout, disconnect, safe error, dan deterministic fairness;
- `tests/api/test_planner_api.py` — analytics consent, Guest cookie, SSE headers, event order, dan legacy result contract melalui dependency override;
- `tests/contract/test_planner_architecture.py` — router/service purity, single SSE serializer, repository boundaries, exact route ownership, dan legacy cutover;
- `tests/integration/test_planner_repositories.py` — real Mongo concurrent reservation, consume/refund, analytics idempotency, catalog filtering, dan log persistence.

Hasil verifikasi:

| Gate | Hasil |
|---|---|
| Frozen OpenAPI | PASS — 116 paths / 140 operations |
| Duplicate method/path | PASS — 0 duplicate |
| Backend contract suite | PASS — 176 tests |
| Phase 8 unit/API/architecture | PASS — 13 tests |
| Phase 8 isolated Mongo integration | PASS — 1 scenario |
| Existing planner/LLM/structured compatibility | PASS — 81 tests |
| Partner recommendation security regression | PASS — 5 tests |
| Real Uvicorn Guest quota/partner/planner regression | PASS — 1 end-to-end scenario |
| Real Uvicorn admin LLM lifecycle/planner regression | PASS — 4 scenarios |
| Frontend regression | PASS — 38 suites / 142 tests |
| Black/Flake8 Phase 8 | PASS |

Starlette masih mengeluarkan satu `PendingDeprecationWarning` dari dependency eksternal `multipart`; warning tidak berasal dari implementasi Phase 8.

Seperti fase sebelumnya, suite historis `pytest tests` bukan gate aktif karena sejumlah iteration tests lama mengasumsikan kontrak autentikasi sebelum Phase 4–5 atau shared seed database. Frozen contract, isolated integration, current web-experience, targeted planner regressions, dan frontend regression tetap menjadi baseline aktif sampai cleanup Phase 10.

## Batas Scope yang Dipertahankan

- LLM profile administration tetap dimiliki module Administration Phase 7; Planner hanya mengonsumsi runtime gateway-nya.
- Premium plans, payment order, Midtrans callback, dan payment workspace tetap di Phase 9.
- Upload/file serving, share image/page, dan backup lifecycle tetap di Phase 9.
- Physical namespace move untuk empat pure Planner modules dan cleanup compatibility import tetap di Phase 10.

## Exit Criteria

| Exit criterion | Status | Evidence |
|---|---|---|
| Application logic dapat diuji tanpa HTTP server/LLM nyata | PASS | fake LLM/service tests dan dependency-overridden API tests |
| SSE contract lama tetap lulus | PASS | single serializer, explicit order assertions, structured regression, dan real Uvicorn tests |
| Quota concurrency/reserve/consume/refund lulus | PASS | unit atomic fake, real Mongo race test, dan concurrent Guest E2E |
| Structured result v2 dan legacy fallback kompatibel | PASS | structured engine/service regression tanpa second generation |
| Recommendation governance/fairness lulus | PASS | deterministic rotation, equal-score, premium-neutral, limits, dan security tests |

Phase 8 selesai. Phase 9 dapat memindahkan payment, media, sharing, backup, dan provider I/O lain tanpa menyentuh Planner orchestration atau SSE contract yang sekarang sudah terisolasi.
