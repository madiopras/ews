# Phase 10 — Cutover, Architecture Enforcement, dan Cleanup

Status: **selesai** pada 10 September 2026.

## Hasil cutover

- Composition root dan seluruh router production berada di `app.main:create_application`; entrypoint resmi adalah `app.main:app`.
- `server.py` tinggal compatibility shim lima baris dan tidak memiliki route, state database, startup hook, atau business logic.
- Seluruh direct import/monkeypatch `server` pada test telah dihapus. Coupling baseline sekarang kosong.
- Startup initialization dipindahkan ke `app/infrastructure/database/startup.py`; root dan health endpoint dipindahkan ke `app/api/system.py`.
- Lifecycle MongoDB mendukung handler yang menerima application instance, memiliki satu client per lifespan, dan selalu menutup client pada shutdown/failure.
- Planner contract/guard/structured engine dipindahkan ke module target. Utility root dipindahkan ke `backend/scripts/`; duplicate `minimal_server.py` dihapus.
- Skrip importer/migrasi/audit memakai typed application settings. Hard-coded Mongo credential dan output parsial API key di utility telah dihapus.

## Enforcement permanen

`tests/contract/test_clean_architecture.py` menegakkan:

- compatibility shim tetap minimal;
- tidak ada test yang coupled ke global `server`;
- service bebas FastAPI, BSON, PyMongo, dan Motor;
- service tidak mengimpor implementation layer feature lain;
- router tidak mengeksekusi query database/provider;
- infrastructure tidak mengimpor API/feature router;
- legacy root modules dan duplicate top-level definitions tidak kembali;
- tidak ada duplicate `method + path`.

OpenAPI snapshot dan route inventory Phase 0 tetap identik: 116 path dan 140 operation.

## Runtime baseline

Pengukuran lokal dilakukan dengan satu Uvicorn worker, MongoDB lokal, 30 request sequential per endpoint:

| Metrik | Hasil Phase 10 |
|---|---:|
| Startup sampai `/health` siap | 1,621.77 ms |
| `/health` p50 / p95 | 2.34 / 3.01 ms |
| `/api/` p50 / p95 | 1.10 / 1.55 ms |
| `/api/destinations` p50 / p95 | 10.05 / 10.84 ms |
| Error rate 90 request | 0% |
| Koneksi Mongo sebelum / saat hidup / setelah shutdown | 3 / 6 / 3 |

Phase 0 tidak memiliki instrumentation timing yang dapat direproduksi, sehingga angka pre-cutover tidak direka. Perbandingan strukturalnya terukur: `server.py` berubah dari composition/business monolith 7.619 baris menjadi shim lima baris; perilaku HTTP dibandingkan melalui snapshot contract, bukan angka performa historis yang tidak tersedia. Angka Phase 10 menjadi baseline regresi berikutnya.

## Keputusan index initialization

Index creation tetap idempotent di application lifespan. Deployment repository saat ini belum memiliki primitive single-run pre-deploy job, locking, retry, dan observability yang diperlukan untuk memindahkannya dengan aman. Kriteria pemindahan ke explicit deployment job dicatat di operations runbook.

## Quality gate

- Phase 0 OpenAPI/route contract: lulus.
- Backend contract/unit/API: 194 lulus.
- Repository integration dengan MongoDB: 7 lulus.
- Architecture suite: 36 lulus.
- Current live API milestones: 12 lulus.
- Black, isort, flake8 fatal checks: lulus.
- Scoped mypy untuk composition/foundation: lulus, 14 source files.
- Frontend: 38 suite / 142 test lulus; ESLint lulus; production build dan bundle budget lulus.
- Deployment smoke melalui `app.main:app`: lulus.

Suite `test_iteration*` dan `backend_test.py` diklasifikasikan sebagai legacy/provider-dependent E2E dan dipindahkan ke target eksplisit `make test-backend-legacy-e2e`. Suite tersebut mengasumsikan anonymous partner registration, response shape lama, seed tertentu, dan output provider LLM tertentu; karena itu tidak layak menjadi release gate deterministik. Current live milestones tetap menjadi gate end-to-end.

## Operasional dan rollback

README root, backend README, Makefile, command local/deployment, dan operations runbook telah diperbarui. Rollback menggunakan versi aplikasi sebelumnya karena seluruh perubahan database Phase 10 backward-compatible. Detail preflight, smoke, monitoring, index rollout, dan rollback ada di `docsplan/backend/backend-operations-runbook.md`.

## Exit criteria

- `server.py` hanya compatibility shim: terpenuhi.
- Tidak ada test yang mengimpor/monkeypatch global `server`: terpenuhi.
- Contract, integration, architecture, lint, type-check, frontend build, dan smoke: terpenuhi.
- Rollback deployment: terdokumentasi dengan checklist verifikasi.
