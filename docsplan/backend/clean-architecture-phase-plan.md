# Phase Plan Refactor Backend FastAPI ke Modular Clean Architecture

## Status Dokumen

- Status: **Disetujui; Phase 0–8 selesai, Phase 9 belum dimulai**.
- Proyek: Explore Wisata Sumut (EWS).
- Area: `backend/`.
- Pendekatan: **modular monolith, feature-first, dengan prinsip Clean Architecture secara pragmatis**.
- Strategi migrasi: bertahap menggunakan pola strangler; bukan penulisan ulang sekaligus.
- Kontrak publik: seluruh URL `/api`, payload, response, cookie, status code, dan perilaku frontend harus tetap kompatibel selama migrasi.

---

## 1. Latar Belakang

Backend saat ini berpusat pada `backend/server.py` yang memiliki sekitar 7.600 baris dan 139 route FastAPI. Modul tersebut menangani banyak tanggung jawab sekaligus:

- konfigurasi environment;
- inisialisasi aplikasi dan middleware;
- koneksi MongoDB global;
- authentication dan authorization;
- schema request/response Pydantic;
- query database;
- business rules;
- integrasi Google OAuth, LLM, SMTP, media storage, dan Midtrans;
- database indexes, backup, dan lifecycle aplikasi;
- seluruh HTTP endpoint.

Kondisi ini meningkatkan risiko perubahan, menyulitkan unit testing, dan membuat batas kepemilikan setiap fitur tidak jelas. Refactor akan memecah tanggung jawab tersebut sambil menjaga sistem tetap dapat dijalankan dan diuji pada setiap fase.

---

## 2. Tujuan

1. Membuat struktur backend mudah dikembangkan oleh lebih dari satu developer.
2. Memisahkan transport HTTP, aturan bisnis, akses data, dan integrasi eksternal.
3. Menghilangkan ketergantungan business logic terhadap global `db`, `Request`, `Response`, `Depends`, dan `HTTPException`.
4. Membuat service/use case dapat diuji tanpa menjalankan FastAPI atau MongoDB.
5. Mempertahankan perilaku API dan kompatibilitas frontend selama proses migrasi.
6. Mengurangi blocking I/O pada event loop FastAPI.
7. Menyediakan fondasi yang dapat diekstrak ke service terpisah kelak tanpa memulai microservices terlalu dini.

## 3. Non-Goals

Refactor ini tidak mencakup:

- perubahan desain atau alur frontend;
- perubahan URL dan versi API publik;
- migrasi MongoDB ke SQL atau penggunaan SQLAlchemy;
- perubahan format data secara massal kecuali dibutuhkan oleh bug yang terpisah;
- pembuatan microservices;
- penulisan ulang semua fitur dalam satu pull request;
- penambahan fitur bisnis baru selama pemindahan modul;
- perubahan algoritma rekomendasi Planner tanpa rencana produk tersendiri.

---

## 4. Keputusan Arsitektur

### 4.1 Struktur target

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                       # app factory/composition root
│   │
│   ├── core/
│   │   ├── config.py                 # Settings tervalidasi
│   │   ├── security.py               # password, JWT, cookie policy
│   │   ├── exceptions.py             # application/domain errors bersama
│   │   └── logging.py
│   │
│   ├── api/
│   │   ├── router.py                 # agregasi seluruh router
│   │   ├── dependencies.py           # composition/dependency providers
│   │   └── exception_handlers.py     # domain error -> HTTP response
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── mongo.py              # client, database dependency, lifecycle
│   │   │   └── indexes.py
│   │   ├── email/
│   │   │   └── smtp.py
│   │   ├── llm/
│   │   │   └── client.py
│   │   ├── payments/
│   │   │   └── midtrans.py
│   │   └── storage/
│   │       └── media.py
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── destinations/
│   │   ├── wishlist/
│   │   ├── reviews/
│   │   ├── itineraries/
│   │   ├── partners/
│   │   ├── notifications/
│   │   ├── governance/
│   │   ├── admin/
│   │   ├── planner/
│   │   ├── payments/
│   │   └── sharing/
│   │
│   └── shared/
│       ├── pagination.py
│       ├── types.py
│       └── datetime.py
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   └── contract/
│
├── scripts/                          # import, audit, dan migration scripts
├── server.py                         # compatibility shim sementara
├── requirements.txt
├── pytest.ini
└── pyproject.toml
```

Setiap feature module menggunakan file yang diperlukan saja. Bentuk lengkap yang disarankan:

```text
modules/destinations/
├── router.py          # HTTP transport
├── schemas.py         # request/response DTO
├── service.py         # use cases dan business rules
├── repository.py      # MongoDB queries/implementation
├── ports.py           # Protocol/interface jika diperlukan
├── entities.py        # domain object jika memiliki behavior
├── mapper.py          # document MongoDB <-> domain/response
└── exceptions.py
```

CRUD sederhana tidak wajib mempunyai seluruh file tersebut. Abstraction dibuat ketika ada nilai pengujian atau kemungkinan implementasi alternatif, bukan hanya untuk menambah jumlah folder.

### 4.2 Arah dependensi

```text
FastAPI router
    -> application service/use case
        -> repository/gateway port
            <- MongoDB/external service implementation
```

Aturan wajib:

- Router boleh mengimpor FastAPI dan Pydantic API schema.
- Service tidak boleh mengimpor `Request`, `Response`, `Depends`, atau `HTTPException`.
- Business rule tidak boleh mengakses collection MongoDB secara langsung.
- Repository tidak memutuskan authorization atau aturan bisnis.
- Infrastructure tidak boleh mengimpor router.
- Error bisnis diterjemahkan menjadi HTTP response di API exception handler.
- Integrasi eksternal selalu dibungkus gateway/client agar dapat diganti dengan fake pada unit test.
- Import lint/architecture test akan menjaga aturan ini setelah fondasi stabil.

### 4.3 MongoDB, schema, dan entity

- Tetap menggunakan Motor/PyMongo; tidak menambahkan SQLAlchemy.
- Pydantic digunakan untuk kontrak request/response dan validasi di boundary.
- MongoDB document tidak diekspos langsung sebagai response.
- Konversi `_id`/`ObjectId` ditempatkan pada repository atau mapper.
- Domain entity dibuat hanya untuk area dengan aturan bisnis kompleks, misalnya Planner, Partner approval, quota, dan payment state.
- Timestamp tetap mengikuti format API saat ini sampai ada keputusan migrasi kontrak terpisah.

### 4.4 Composition root dan dependency injection

- `app/main.py` membuat aplikasi melalui `create_app()`.
- Mongo client dibuat dan ditutup melalui FastAPI lifespan.
- Database, repository, service, dan gateway dirakit melalui provider di `app/api/dependencies.py`.
- Hindari service locator dan singleton mutable tersembunyi.
- Gunakan `app.dependency_overrides` untuk API test.
- `backend/server.py` sementara hanya mengekspor `app` dan simbol kompatibilitas yang masih diperlukan test lama.

---

## 5. Guardrails Selama Refactor

1. Satu fase harus dapat di-merge dan di-deploy secara independen.
2. Jangan mencampur refactor dengan perubahan business behavior.
3. Jangan memindahkan semua module sekaligus.
4. Route lama tidak dihapus sebelum router baru terbukti terdaftar dan contract test lulus.
5. Satu endpoint hanya boleh terdaftar satu kali; validasi duplicate route pada test.
6. Jangan mengubah `backend/pytest.ini` `addopts`; eksekusi serial menggunakan `-n 0` jika memang diperlukan.
7. Pertahankan `uvicorn server:app` selama masa transisi.
8. Setiap pemindahan fitur harus disertai unit test service dan regression/API test yang relevan.
9. Tidak boleh ada credential atau nilai `.env` di test fixture dan dokumentasi.
10. Perubahan data/index harus idempoten dan mempunyai rollback atau recovery note.

---

## 6. Definition of Done Global

Refactor dianggap selesai jika:

- `server.py` hanya menjadi compatibility shim atau telah dihapus pada major cutover yang disetujui;
- tidak ada route bisnis yang didefinisikan di `server.py`;
- tidak ada business service yang menggunakan FastAPI object atau `HTTPException`;
- tidak ada akses `db.<collection>` dari router;
- settings tervalidasi dan terpusat;
- Mongo client lifecycle dikelola aplikasi dan ditutup dengan benar;
- seluruh endpoint lama tetap tersedia dengan kontrak yang sama;
- backend test suite lulus;
- frontend contract/integration suite yang memakai API lulus;
- blocking network/file operations sudah dibuat async atau dipindahkan dari event loop;
- dokumentasi startup, testing, dan struktur arsitektur telah diperbarui.

---

## 7. Phase Plan

## Phase 0 — Baseline, Inventory, dan Contract Freeze

### Sasaran

Membuat safety net sebelum memindahkan kode.

### Pekerjaan

- Inventaris seluruh route, method, dependency, response model, dan status code.
- Kelompokkan route berdasarkan domain: auth, destination, partner, itinerary, planner, admin, payment, media, dan sharing.
- Catat seluruh simbol `server` yang diimpor atau di-monkeypatch oleh test.
- Simpan snapshot OpenAPI yang telah dinormalisasi sebagai contract baseline.
- Tambahkan test yang mendeteksi duplicate `method + path`.
- Rekam baseline hasil backend test suite dan waktu eksekusinya.
- Dokumentasikan environment variable berdasarkan kategori dan tandai required/optional tanpa menyimpan nilainya.
- Catat endpoint yang melakukan synchronous/blocking I/O.

### Deliverable

- Route inventory.
- OpenAPI contract snapshot.
- Environment variable matrix.
- Dependency/coupling inventory test terhadap `server.py`.
- Baseline test report.

### Exit criteria

- Semua route yang ada terwakili dalam inventory.
- Contract test mampu mendeteksi route hilang atau berubah.
- Backend test suite memiliki baseline yang dapat diulang.
- Tidak ada perubahan perilaku production.

---

## Phase 1 — Application Skeleton dan Import Strategy

### Sasaran

Membuat package target tanpa memindahkan business logic terlebih dahulu.

### Pekerjaan

- Buat package `app/`, `core/`, `api/`, `infrastructure/`, `modules/`, dan `shared/`.
- Tambahkan `create_app()` pada `app/main.py`.
- Pindahkan pembuatan FastAPI, CORS, health route, router aggregation, dan exception handler registration ke skeleton baru.
- Pertahankan prefix `/api` dan urutan middleware.
- Ubah `server.py` secara minimal agar mengekspor aplikasi dari composition root baru.
- Pastikan entrypoint lama `uvicorn server:app` tetap bekerja.
- Tambahkan smoke test startup, `/health`, `/api/`, dan OpenAPI.

### Deliverable

- Application factory yang dapat dibuat pada test.
- Root API router.
- Compatibility entrypoint.
- Smoke tests untuk lifecycle dan routing.

### Exit criteria

- Aplikasi dapat start/stop tanpa error.
- `/health`, `/api/`, dan `/docs` tetap bekerja.
- Tidak ada duplicate route.
- OpenAPI contract tidak berubah di luar metadata yang disetujui.

---

## Phase 2 — Configuration, Database Lifecycle, dan Shared Security

### Sasaran

Menghilangkan import-time infrastructure side effects dan menyatukan konfigurasi.

### Pekerjaan

- Tambahkan `pydantic-settings` dan buat typed `Settings`.
- Kelompokkan setting MongoDB, JWT/cookie, CORS, Google, LLM, SMTP, storage, backup, dan Midtrans.
- Validasi setting required sesuai fitur yang aktif, bukan memaksa semua integrasi tersedia.
- Buat Mongo client pada lifespan dan tutup client saat shutdown.
- Sediakan database dependency tanpa global mutable `db` untuk kode baru.
- Pisahkan password hashing, JWT encode/decode, dan cookie configuration ke `core/security.py`.
- Pisahkan index definitions ke `infrastructure/database/indexes.py`.
- Pertahankan pembuatan index saat startup untuk sementara, tetapi buat idempoten dan dapat dipindah menjadi deployment job.
- Tambahkan fake/test settings agar import test tidak membutuhkan service eksternal.

### Deliverable

- Typed settings.
- Mongo lifecycle manager.
- Database dependency provider.
- Shared security utilities.
- Index registry.

### Exit criteria

- Mengimpor package aplikasi tidak langsung membutuhkan koneksi MongoDB.
- Mongo client selalu ditutup pada shutdown.
- Kode baru tidak membaca `os.environ` secara langsung.
- Unit test config, JWT, password, dan lifecycle lulus.
- Health response tetap kompatibel.

---

## Phase 3 — Pilot Vertical Slice: Destinations Read API

### Sasaran

Membuktikan pola router-service-repository pada domain yang cukup representatif tetapi berisiko rendah.

### Scope awal

- List destination publik.
- Search dan suggestions.
- Locations dan trending.
- Destination batch.
- Detail destination publik.

### Pekerjaan

- Pindahkan schema destination ke module.
- Buat mapper document MongoDB ke response schema.
- Buat `DestinationRepository` untuk read queries.
- Buat `DestinationService` untuk filter, pagination, visibility, dan sanitasi data publik.
- Buat router baru dengan URL dan response model yang identik.
- Tambahkan unit test service dengan fake repository.
- Tambahkan integration test query/index penting terhadap database test.
- Bandingkan response lama dan baru menggunakan fixture yang sama.

### Exit criteria

- Seluruh destination read route dilayani module baru.
- Tidak ada query MongoDB pada destination router.
- Response dan error contract sama dengan baseline.
- Route lama untuk scope ini telah dilepas tanpa duplicate registration.

---

## Phase 4 — Authentication, Users, dan Authorization Dependencies

### Sasaran

Membangun fondasi identity yang akan digunakan module protected berikutnya.

### Scope

- Register, login, logout, dan current user.
- Google authentication.
- Email verification dan password reset.
- Profile, account export, dan account deletion.
- `get_current_user`, `get_optional_user`, dan `require_admin`.
- Auth rate limiting dan session revocation.

### Pekerjaan

- Pisahkan API schemas dari persisted user document.
- Buat `UserRepository` dan repository rate-limit/token bila diperlukan.
- Buat use case per alur penting, bukan satu `AuthService` berukuran besar.
- Letakkan parsing bearer token/cookie pada API dependency.
- Letakkan validasi token dan aturan session pada service/security layer.
- Ganti `HTTPException` di service dengan typed application exception.
- Bungkus Google token verification dan email delivery sebagai gateway.
- Pertahankan nama cookie, flags, token claims, expiration, dan response lama.
- Migrasikan unit test yang saat ini melakukan monkeypatch `server.db` menjadi fake repository/gateway.

### Exit criteria

- Protected endpoint dapat memakai dependency identity baru.
- Service auth dapat diuji tanpa FastAPI dan MongoDB.
- Cookie dan security regression tests lulus.
- Google OAuth dapat diuji tanpa network.
- Seluruh auth/account contract tetap kompatibel.

---

## Phase 5 — Destination Write, Wishlist, Reviews, dan Itineraries

### Sasaran

Memindahkan domain perjalanan inti yang bergantung pada identity dan destination.

### Scope

- Admin destination CRUD/toggle.
- Wishlist add/list/delete.
- Review list/create/update/delete.
- Itinerary CRUD, duplicate, share toggle, dan public itinerary.
- Hydration structured planner result pada saved trip.

### Pekerjaan

- Tambahkan write methods pada destination repository.
- Buat repository/service terpisah untuk wishlist dan reviews.
- Tegakkan ownership melalui service, bukan router atau query tersebar.
- Pisahkan persisted itinerary, public itinerary response, dan update DTO.
- Pertahankan validasi destination aktif dan structured result version.
- Buat atomic update bila operasi read-modify-write berisiko race condition.
- Tambahkan negative tests untuk cross-account access.
- Pastikan sanitasi public itinerary tidak membocorkan field privat.

### Exit criteria

- Seluruh scope tidak lagi didefinisikan di `server.py`.
- Ownership dan public/private boundary memiliki unit test.
- Saved legacy itinerary dan structured result v2 tetap dapat dibuka.
- Contract test frontend terkait wishlist, review, dan saved trip lulus.

---

## Phase 6 — Partners dan Mitra Workspace

### Sasaran

Memisahkan lifecycle Partner/Mitra yang besar menjadi use case yang jelas.

### Scope

- Public partner list/detail.
- Mitra onboarding dan draft.
- Submit/resubmit workflow.
- Membership dan owner assignment.
- Profile, availability, freshness, offerings, dan insights.
- Gallery dan verification documents.
- Admin approval/status/toggle/delete.
- Partner analytics event ingestion.

### Pekerjaan

- Definisikan state transition Partner secara eksplisit.
- Pisahkan authorization policy: owner, member, admin, dan public.
- Buat repository untuk partner, membership, offering, gallery/document metadata, dan analytics.
- Jadikan completeness, submission validation, premium status, dan public sanitization sebagai pure domain functions bila memungkinkan.
- Bungkus media/document storage sebagai gateway.
- Pastikan file path dan URL divalidasi pada infrastructure boundary.
- Tambahkan test state transition dan ownership matrix.

### Exit criteria

- Semua perubahan status melewati satu policy/use case yang tervalidasi.
- Tidak ada akses partner document privat dari public response.
- Semua negative ownership tests lulus.
- Fitur Mitra dan admin partner tetap kompatibel dengan frontend.

---

## Phase 7 — Admin, Governance, Settings, Notifications, dan Audit

### Sasaran

Memisahkan administrative workflows dan cross-cutting operational concerns.

### Scope

- Admin dashboard dan user management.
- Governance preview, overview, report moderation, dan analytics.
- General settings dan experience feature decisions.
- LLM profile administration.
- Email template administration.
- Notification inbox.
- Audit, AI, dan system logs.

### Pekerjaan

- Pisahkan query/read model dashboard dari transactional use cases.
- Buat policy admin terpusat.
- Buat repository per aggregate atau cohesive collection group; hindari satu generic repository.
- Pertahankan redaction sebelum data masuk system log.
- Jadikan feature decision deterministic dan unit-testable.
- Bungkus email/SMS notification delivery sebagai gateway.
- Tetapkan pagination contract bersama untuk endpoint admin tanpa mengubah response existing.

### Exit criteria

- Admin authorization diterapkan konsisten.
- Audit log tercatat untuk seluruh mutation yang saat ini membutuhkannya.
- Secret redaction regression tests lulus.
- Governance analytics dan feature rollout tetap deterministik.

---

## Phase 8 — Planner dan LLM

### Sasaran

Memindahkan domain paling kompleks setelah fondasi repository, identity, partner, destination, dan settings stabil.

### Scope

- Planner request/response schemas.
- Scope guard dan preference handling.
- Guest/user quota reserve, consume, dan refund.
- Catalog selection dan prompt construction.
- LLM streaming client.
- Structured output parsing/hydration.
- Partner recommendation dan fairness.
- Planner analytics dan operational logging.

### Pekerjaan

- Pertahankan `planner_contract.py`, `planner_guard.py`, `planner_result_contract.py`, dan `planner_structured_engine.py` sebagai pure modules pada tahap awal; pindahkan namespace setelah import compatibility tersedia.
- Pecah streaming orchestration menjadi use case yang menerima ports untuk LLM, quota, catalogs, analytics, dan logs.
- Pisahkan SSE serialization dari generation workflow.
- Pastikan quota transaction aman terhadap concurrent tabs dan cancellation.
- Pastikan refund terjadi pada failure yang memenuhi aturan lama.
- Jadikan partner recommendation pure/deterministic sejauh memungkinkan.
- Buat fake streaming LLM untuk test sukses, malformed result, timeout, disconnect, dan fallback.
- Jangan mengubah SSE event names/order tanpa versi contract baru.

### Exit criteria

- Planner application logic dapat diuji tanpa HTTP server dan LLM nyata.
- SSE contract lama tetap lulus.
- Quota concurrency/reserve/consume/refund tests lulus.
- Structured result v2 dan legacy fallback tetap kompatibel.
- Recommendation governance/fairness tests lulus.

---

## Phase 9 — Payments, Media, Sharing, Backup, dan External I/O

### Sasaran

Mengisolasi integrasi berisiko dan menghilangkan blocking I/O dari event loop.

### Scope

- Premium plans dan payment orders.
- Midtrans config, Snap token, notification, dan status.
- Upload, file serving, gallery/document I/O.
- Social share image dan preview page.
- Database backup/download/delete.
- SMTP dan synchronous external calls yang masih tersisa.

### Pekerjaan

- Buat `PaymentGateway` dengan implementasi Midtrans.
- Verifikasi signature notification dan idempotency order update di service.
- Ganti `requests` dengan `httpx.AsyncClient` untuk network path async.
- Jalankan library/file/image/SMTP sinkron melalui worker queue atau `asyncio.to_thread()` sebagai langkah transisi.
- Jangan menjalankan backup berat sebagai pekerjaan langsung di request event loop.
- Pisahkan renderer share card dari HTTP response construction.
- Pastikan gateway memiliki timeout, error mapping, log redaction, dan fake test implementation.

### Exit criteria

- Tidak ada blocking HTTP request pada async endpoint.
- Payment callback aman terhadap duplicate notification.
- Backup dan media processing tidak memblokir request worker.
- Integrasi dapat diuji tanpa menghubungi provider eksternal.
- Security tests untuk SSRF, path traversal, upload, dan payment signature lulus.

---

## Phase 10 — Cutover, Enforcement, dan Cleanup

### Sasaran

Mengakhiri masa transisi dan memastikan batas arsitektur bertahan.

### Pekerjaan

- Migrasikan seluruh test dari import langsung `server` ke module target atau public API.
- Sisakan `server.py` hanya sebagai `from app.main import app`, atau ubah entrypoint ke `app.main:app` pada release terencana.
- Pindahkan utility scripts ke `backend/scripts/` dan perbarui importnya.
- Hapus compatibility re-export yang tidak lagi digunakan.
- Tambahkan architecture tests/import rules.
- Jalankan dead-code dan duplicate-definition audit.
- Perbarui README, Makefile, deployment command, local setup, dan runbook.
- Ukur startup time, request latency penting, error rate, dan Mongo connection behavior sebelum/sesudah.
- Pertimbangkan memindahkan index initialization ke explicit deployment job setelah deployment flow mendukungnya.

### Exit criteria

- `server.py` maksimal menjadi compatibility shim.
- Tidak ada test yang monkeypatch global `server.db`.
- Seluruh Definition of Done global terpenuhi.
- Test, lint, type check, build frontend, dan smoke test deployment lulus.
- Rollback deployment telah diuji atau didokumentasikan.

---

## 8. Testing Strategy

### Unit tests

Menguji service, use case, policy, mapper, dan pure domain function menggunakan fake repository/gateway. Tidak memerlukan FastAPI, MongoDB, SMTP, LLM, atau Midtrans.

### Repository integration tests

Menguji query, index assumption, atomic update, sorting, pagination, dan konversi `ObjectId` terhadap database test yang terisolasi.

### API tests

Menguji routing, dependency wiring, authorization, cookie/header, HTTP status, streaming, upload, dan response serialization melalui aplikasi hasil `create_app()`.

### Contract tests

Menguji:

- `method + path`;
- request/response schema penting;
- SSE event names dan urutan;
- error `status/detail` yang dipakai frontend;
- cookie name dan flags;
- public/private field boundaries;
- OpenAPI snapshot yang dinormalisasi.

### Architecture tests

Minimal rules:

- `modules/*/service.py` tidak mengimpor FastAPI;
- router tidak mengakses `db`/Motor collection;
- module tidak mengimpor implementation module lain secara silang;
- infrastructure tidak mengimpor API router;
- tidak ada route bisnis baru di compatibility `server.py`.

### Quality gate setiap fase

```bash
make test-backend
make qa-milestone7
```

Tambahkan lint, formatting, type checking, dan OpenAPI contract check ke quality gate setelah konfigurasinya stabil. Test yang memerlukan eksekusi serial harus memakai opsi xdist `-n 0`, bukan mengubah konfigurasi global `pytest.ini`.

---

## 9. Migration Pattern per Endpoint Group

Checklist berikut diulang untuk setiap kelompok endpoint:

1. Bekukan behavior melalui regression/contract test.
2. Pindahkan schema dan pure helper terlebih dahulu.
3. Buat repository dan gateway port yang diperlukan.
4. Pindahkan business rule ke service/use case.
5. Buat router tipis dan dependency provider.
6. Daftarkan router baru dengan path yang sama.
7. Lepaskan route lama agar tidak terjadi duplicate registration.
8. Jalankan unit, integration, API, dan contract tests terkait.
9. Jalankan full backend suite sebelum merge.
10. Hapus compatibility export hanya setelah seluruh pemanggil dimigrasikan.

---

## 10. Observability dan Operational Safety

Setiap fase yang memindahkan runtime behavior harus menjaga atau menambahkan:

- structured log dengan request/correlation ID bila tersedia;
- redaction credential dan data sensitif;
- durasi external calls dan timeout;
- error category tanpa membocorkan secret;
- health/readiness distinction untuk aplikasi dan database;
- jumlah kegagalan LLM, payment, notification, upload, dan backup;
- startup/shutdown log yang memastikan resource dilepas.

Refactor tidak boleh meningkatkan jumlah data pribadi yang disimpan pada analytics atau log.

---

## 11. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Big-bang rewrite | Regression luas dan sulit di-review | Migrasi per vertical slice dengan route contract tetap |
| Duplicate route saat transisi | Handler yang aktif tidak jelas | Test uniqueness `method + path` dan lepaskan handler lama pada commit yang sama |
| Test lama bergantung pada `server` | Banyak test gagal sekaligus | Compatibility exports sementara dan migrasi test per module |
| Perubahan response tidak disengaja | Frontend rusak | OpenAPI snapshot dan fixture parity tests |
| Global DB diganti terlalu cepat | Startup/test instability | Introduksi lifespan/provider dulu, migrasi pemakai bertahap |
| Abstraction berlebihan | Kode makin sulit dipahami | Hanya gunakan port/entity ketika ada business value atau test seam |
| Circular imports antar fitur | Startup failure dan coupling baru | Router aggregator tunggal; komunikasi lintas fitur melalui service/port yang jelas |
| Blocking I/O tetap berada di async path | Latency dan throughput buruk | Async client, bounded timeout, thread offload, atau background worker |
| Index creation dijalankan tiap worker | Startup lambat/race | Idempoten dahulu, kemudian pindahkan ke deployment job |
| Perubahan auth/payment tersembunyi | Risiko keamanan | Pindahkan setelah foundation stabil dan wajibkan negative/security tests |

---

## 12. Urutan Dependensi Fase

```text
Phase 0: Baseline & contracts
    -> Phase 1: App skeleton
        -> Phase 2: Config, DB, security
            -> Phase 3: Destination read pilot
                -> Phase 4: Auth & users
                    -> Phase 5: Destination write, wishlist, reviews, itineraries
                        -> Phase 6: Partners
                            -> Phase 7: Admin & governance
                                -> Phase 8: Planner & LLM
                                    -> Phase 9: Payments & external I/O
                                        -> Phase 10: Cutover & cleanup
```

Phase dapat dipecah menjadi beberapa pull request kecil, tetapi tidak boleh melewati exit criteria fase yang menjadi dependensinya.

---

## 13. Pull Request dan Release Strategy

- Satu PR idealnya memindahkan satu cohesive endpoint group atau satu fondasi teknis.
- Hindari PR yang memindahkan lebih dari satu domain besar.
- Setiap PR mencantumkan route yang dipindahkan, contract impact, migration note, test evidence, dan rollback note.
- Deploy dapat dilakukan setelah setiap fase atau subfase yang memenuhi quality gate.
- Tidak diperlukan feature flag hanya untuk perubahan internal yang contract-compatible.
- Gunakan feature flag jika refactor juga mengubah runtime path eksternal atau business behavior.
- Rollback dilakukan pada aplikasi/code version; perubahan database yang tidak backward-compatible dilarang selama fase transisi.

---

## 14. Checklist Eksekusi Ringkas

- [x] Phase 0 — Baseline, inventory, dan contract freeze.
- [x] Phase 1 — Application skeleton dan import strategy.
- [x] Phase 2 — Configuration, database lifecycle, dan shared security.
- [x] Phase 3 — Pilot destination read vertical slice.
- [x] Phase 4 — Authentication, users, dan authorization dependencies.
- [x] Phase 5 — Destination write, wishlist, reviews, dan itineraries.
- [x] Phase 6 — Partners dan Mitra workspace.
- [x] Phase 7 — Admin, governance, settings, notifications, dan audit.
- [x] Phase 8 — Planner dan LLM.
- [x] Phase 9 — Payments, media, sharing, backup, dan external I/O.
- [x] Phase 10 — Cutover, architecture enforcement, dan cleanup.

---

## 15. Rekomendasi Titik Mulai

Phase 0–10 telah selesai. Safety net kontrak, application factory, typed settings, lifespan-owned MongoDB client, shared security, seluruh vertical slice bisnis, external I/O, cutover composition root, dan architecture enforcement sekarang tersedia tanpa mengubah public OpenAPI.

Entrypoint resmi adalah `app.main:app`; `server.py` hanya compatibility shim. Quality gate, operations runbook, runtime baseline, dan rollback procedure menjadi baseline pemeliharaan berikutnya. Perubahan arsitektur selanjutnya wajib mempertahankan contract dan import rules Phase 10.
