# Phase 7 — Admin, Governance, Settings, Notifications, dan Audit Report

## Status

**Selesai.** Seluruh 38 operasi HTTP dalam scope Phase 7 telah dipindahkan dari `backend/server.py` ke vertical slice administration. Frozen OpenAPI tetap 116 paths/140 operations tanpa duplicate method/path.

## Hasil Implementasi

Feature package baru berada di `backend/app/modules/administration/`:

| File | Tanggung jawab |
|---|---|
| `schemas.py` | DTO admin user, settings, email template, LLM profile, editorial workflow, report, dan moderation |
| `domain.py` | pure policy untuk pagination, feature rollout, governance analytics, planner health summary, dan recursive redaction |
| `mapper.py` | serializer eksplisit untuk user, logs, notifications, email template, LLM profile, dan paged response |
| `repositories.py` | delapan MongoDB adapter yang dipisahkan berdasarkan aggregate/cohesive collection group |
| `service.py` | dashboard, user administration, logs, settings, template, notification, LLM profile, dan governance use cases |
| `gateways.py` | LLM runtime/profile security serta email, SMS, dan in-app notification adapters |
| `dependencies.py` | request-scoped composition dan shared LLM activation lock |
| `router.py` | HTTP transport tipis serta mapping typed administration error |

`backend/server.py` kini mendaftarkan router dan exception handler Phase 7. Schema serta 38 route handler legacy telah dihapus. Compatibility adapter yang masih dibutuhkan planner dan pekerjaan Phase 9 mengarah ke policy, repository, gateway, dan service baru tanpa menduplikasi implementasi.

## Authorization dan User Governance

Seluruh endpoint `/admin/*` menggunakan dependency `require_admin` yang sama dari identity boundary Phase 4. Contract test memeriksa dependency tersebut pada setiap admin route, bukan hanya berdasarkan prefix atau convention nama.

User mutation dipusatkan di `AdminUserService`. Policy mencegah admin menonaktifkan atau menurunkan role akunnya sendiri dan mencegah penghapusan admin aktif terakhir. Filtering, sorting, dan pagination tetap mempertahankan bentuk response lama.

## Settings dan Feature Decisions

General settings mempunyai satu default canonical dan satu service boundary untuk read/update. Setiap update settings menghasilkan audit log dan system log.

Feature decision adalah pure function yang deterministik berdasarkan:

- status feature secara global;
- status dan rollout percentage feature;
- identity/role user;
- kondisi existing partner untuk akses dashboard Mitra;
- bucket rollout stabil yang berasal dari identifier user.

Urutan policy eksplisit memastikan global disable tidak dapat dilewati admin override. Unknown feature juga ditolak secara konsisten.

## Governance dan Notifications

Use case governance mencakup destination/partner preview, overview, editorial workflow, public content report, moderation, partner attention notification, notification monitoring, analytics, dan role preview.

Email, SMS, dan in-app delivery berada di gateway boundary. Inbox hanya mengakses notification milik user aktif, termasuk ketika melakukan `mark read`. Moderation action tetap mengubah visibilitas target sesuai kontrak dan seluruh mutation governance yang sebelumnya diaudit tetap menghasilkan audit record.

## Logs, Secret Redaction, dan LLM Profile Security

Audit, AI, dan system logs memakai pagination/date/search policy bersama tanpa mengubah response contract. Redaction system log dilakukan secara rekursif sebelum persistence, mencakup message, nested object, dan list. Daftar secret berasal dari typed settings, termasuk JWT, database URL, provider key, payment key, OAuth secret, dan Redis URL.

LLM profile administration mempertahankan lifecycle create/read/update/duplicate/test/activate/environment/delete. API key tetap terenkripsi at rest dan tidak pernah dikembalikan dalam response. Base URL melewati validasi SSRF/private-address policy, connection test ditangani gateway, aktivasi memakai process lock, dan active profile tidak dapat dihapus.

## Persistence dan Query Boundaries

Mongo adapter dipisah menjadi:

1. `AuditLogRepository`;
2. `DashboardRepository`;
3. `AdminUserRepository`;
4. `SettingsRepository`;
5. `GovernanceRepository`;
6. `NotificationRepository`;
7. `EmailTemplateRepository`;
8. `LlmProfileRepository`.

Pemisahan ini menghindari generic repository dan menjaga query dashboard/read model terpisah dari transactional use cases. BSON/ObjectId hanya berada di repository layer; service bebas dari FastAPI, HTTP transport, Mongo driver, dan HTTP client.

## Contract dan Test Coverage

Test baru:

- `tests/unit/test_administration_services.py` — deterministic rollout, pagination normalization, recursive redaction, user safety policy, dan planner health policy;
- `tests/api/test_administration_api.py` — representative dashboard/users/logs/settings/notifications/template/LLM/governance contracts melalui dependency override;
- `tests/contract/test_administration_architecture.py` — router purity, service boundaries, cohesive repositories, shared admin dependency, dan legacy cutover;
- `tests/integration/test_administration_repositories.py` — settings, users, templates, moderation, notifications, audit, dan system logs terhadap isolated Mongo database.

Hasil verifikasi:

| Gate | Hasil |
|---|---|
| Frozen OpenAPI | PASS — 116 paths / 140 operations |
| Duplicate method/path | PASS — 0 duplicate |
| Backend contract suite | PASS — 87 tests |
| Phase 7 unit/API/architecture | PASS — 13 tests |
| Phase 7 isolated Mongo integration | PASS — 1 end-to-end repository scenario |
| Planner/governance/LLM compatibility | PASS — 16 tests |
| Real Uvicorn web experience dan admin regression | PASS — 6 scenarios |
| Frontend regression | PASS — 38 suites / 142 tests |
| Black/Flake8 Phase 7 | PASS |

Starlette masih mengeluarkan satu `PendingDeprecationWarning` dari dependency eksternal `multipart`; warning tidak berasal dari implementasi Phase 7.

Seperti pada Phase 6, suite historis `pytest tests` belum menjadi gate aktif yang sepenuhnya hijau karena beberapa iteration tests lama masih mengasumsikan kontrak sebelum Phase 4–5 dan sebagian planner test menggunakan shared seed database. Frozen contract, isolated integration, current web-experience, dan frontend regression adalah baseline aktif. Penyelarasan test historis tetap menjadi cleanup Phase 10 agar tidak mengubah API yang sudah dibekukan.

## Batas Scope yang Dipertahankan

- Planner streaming orchestration, quota, structured hydration, dan generation workflow tetap di Phase 8.
- Backup lifecycle dan endpoint tetap di Phase 9.
- Premium plan, partner payment workspace, dan payment provider workflow tetap di Phase 9.

## Exit Criteria

| Exit criterion | Status | Evidence |
|---|---|---|
| Admin authorization diterapkan konsisten | PASS | shared `require_admin` dan route dependency contract test |
| Mutation yang membutuhkan audit tetap tercatat | PASS | centralized `AuditService`, service assertions, dan Mongo integration |
| Secret redaction regression lulus | PASS | recursive nested redaction unit test dan pre-persistence boundary |
| Governance analytics dan feature rollout deterministik | PASS | pure domain policies dan unit regression tests |

Phase 7 selesai. Phase 8 dapat memakai settings, active LLM profile, governance fairness summary, dan logging boundary yang sudah stabil untuk memecah orchestration planner tanpa menarik administrative workflows kembali ke legacy module.
