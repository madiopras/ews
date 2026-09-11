# Phase 6 — Partners dan Mitra Workspace Report

## Status

**Selesai.** Seluruh 33 operasi HTTP dalam scope Partner/Mitra telah dipindahkan dari `backend/server.py` ke vertical slice modular. Frozen OpenAPI tetap 116 paths/140 operations tanpa duplicate method/path.

## Hasil Implementasi

Feature package baru berada di `backend/app/modules/partners/`:

| File | Tanggung jawab |
|---|---|
| `schemas.py` | DTO public, admin, onboarding, workspace, offering, member, status, dan analytics |
| `domain.py` | pure policy untuk normalization, completeness, submission, premium, role, dan state transition |
| `mapper.py` | serializer eksplisit public/admin/workspace, gallery, offering, dan member |
| `repository.py` | MongoDB adapter untuk partner, membership, offering, file metadata, analytics, audit, dan cascade delete |
| `service.py` | lifecycle Partner, authorization, workspace, discovery, media, insights, dan administration use cases |
| `gateways.py` | object storage dan lifecycle notification adapters |
| `dependencies.py` | komposisi repository, gateway, settings, dan service dari application state |
| `router.py` | HTTP transport tipis dan mapping typed domain error |

`backend/server.py` sekarang hanya mendaftarkan router dan exception handler Phase 6. Deklarasi schema Partner legacy juga sudah dihapus; compatibility helpers yang masih dipakai planner, governance, dan payment menggunakan schema canonical dari package Partner.

## Lifecycle dan Authorization

State transition admin dipusatkan dalam satu policy:

| Current state | Target yang diperbolehkan |
|---|---|
| `draft` | `pending`, `needs_revision`, `rejected` |
| `pending` | `pending`, `approved`, `needs_revision`, `rejected` |
| `needs_revision` | `pending`, `needs_revision`, `rejected` |
| `rejected` | `pending`, `needs_revision`, `rejected` |
| `approved` | `pending`, `needs_revision`, `rejected` |

Approval hanya dapat dilakukan dari `pending`. Transisi `needs_revision` mewajibkan catatan minimal lima karakter. Aktivasi public partner hanya terjadi pada status `approved`.

Policy akses diterapkan di service boundary:

| Aktor | Akses |
|---|---|
| Public | Hanya partner `approved` dan aktif melalui DTO public |
| Staff | Read workspace, profile/availability/freshness, offering, gallery; tidak dapat submit/resubmit atau mengelola member |
| Owner | Seluruh operasi workspace serta staff membership dan submit/resubmit |
| Admin | Review, status, owner assignment, toggle, delete, dan override workspace yang memang didukung kontrak |

Legacy owner tanpa membership record memperoleh backfill membership `owner` saat akses tervalidasi. Cross-account access tetap menghasilkan `403`.

## Public/Private Data Boundary

Public listing/detail memakai mapper dan DTO khusus. Field berikut tidak dapat muncul pada response public:

- email dan alamat jalan;
- owner/membership data;
- verification document metadata dan storage path;
- approval history, reviewer, dan revision note.

Nomor WhatsApp juga disembunyikan ketika partner tidak menerima kontak. Media URL melewati sanitizer yang sudah tersedia, dan premium placement selalu membawa disclosure `unggulan_berbayar`.

## Storage dan Notifications

Verification document dan gallery sekarang menggunakan storage gateway. Boundary tersebut:

- menolak absolute path, traversal, backslash, query, dan fragment pada object path;
- memvalidasi extension, MIME, magic bytes, ukuran, dan jumlah file di application service;
- menjalankan local/network storage I/O melalui `asyncio.to_thread` agar event loop tidak terblokir;
- mempertahankan metadata file sensitif/non-sensitif dan cascade cleanup;
- mempertahankan email serta in-app notification pada perubahan status.

## Persistence dan Race Safety

Mongo adapter mempertahankan operasi atomic/conditional yang relevan:

- unique active membership melalui upsert dan index `(partner_id, user_id)`;
- atomic partner toggle melalui aggregation update pipeline;
- offering update/delete selalu dipredikatkan dengan `partner_id`;
- analytics event idempotent melalui unique `event_id` dan duplicate handling;
- partner delete membersihkan membership, offering, analytics, serta file metadata.

Analytics hanya diterima ketika header consent bernilai `granted`. Anonymous session disimpan sebagai keyed HMAC, bukan identifier mentah.

## Contract dan Test Coverage

Test baru:

- `tests/unit/test_partner_services.py` — state transition, ownership matrix, public privacy, completeness, dan storage path traversal;
- `tests/api/test_partner_api.py` — onboarding/workspace, public/admin, consent analytics, dan private media melalui dependency override;
- `tests/contract/test_partner_architecture.py` — router bebas database/storage, service bebas FastAPI/BSON/transport, schema/route legacy hilang, dan DTO public denylist;
- `tests/integration/test_partner_repository.py` — lifecycle, membership, approval, offering, public projection, idempotent analytics, dan cascade delete terhadap isolated Mongo database.

Hasil verifikasi:

| Gate | Hasil |
|---|---|
| Frozen OpenAPI | PASS — 116 paths / 140 operations |
| Duplicate method/path | PASS — 0 duplicate |
| Backend contract suite | PASS — 74 tests |
| Phase 6 unit/API/architecture/integration | PASS — 13 tests |
| Real Uvicorn Mitra ownership/workflow regression | PASS — 2 end-to-end scenarios |
| Existing partner/admin/governance compatibility | PASS — 17 tests |
| Frontend regression | PASS — 38 suites / 142 tests |
| Black/Flake8 Phase 6 | PASS |

Starlette masih mengeluarkan satu `PendingDeprecationWarning` dari dependency eksternal `multipart`; warning tidak berasal dari implementasi Phase 6.

Suite historis `pytest tests` belum menjadi gate yang sepenuhnya hijau: beberapa iteration tests lama masih mengasumsikan `POST /api/partners` tanpa autentikasi dan bentuk kontrak payment/admin sebelum Phase 4–5, sementara kelompok planner bergantung pada seed database global. Gate frozen contract, isolated integration, current web-experience, dan frontend di atas adalah baseline aktif yang dipakai untuk Phase 6. Penyelarasan test historis menjadi pekerjaan cleanup Phase 10 agar tidak mengubah kontrak yang sudah dibekukan.

## Batas Scope yang Dipertahankan

- Governance preview dan partner notification endpoints tetap di Phase 7.
- Mitra payment workspace dan premium lifecycle tetap di Phase 9.
- Planner-specific partner matching dan analytics tetap di Phase 8.

## Exit Criteria

| Exit criterion | Status | Evidence |
|---|---|---|
| Semua perubahan status melalui policy/use case tervalidasi | PASS | `validate_admin_transition` dan service status test |
| Tidak ada document privat pada public response | PASS | explicit public DTO, mapper, dan denylist test |
| Negative ownership tests lulus | PASS | unit matrix dan real Uvicorn cross-account checks |
| Fitur Mitra/admin partner kompatibel dengan frontend | PASS | current web-experience dan seluruh frontend regression |

Phase 6 selesai. Phase 7 dapat menggunakan Partner repository/query boundary dan notification composition yang telah stabil tanpa mengambil kembali lifecycle Partner ke legacy module.
