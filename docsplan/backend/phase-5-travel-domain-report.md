# Phase 5 — Destination Write, Wishlist, Reviews, dan Itineraries Report

## Status

**Selesai — 10 September 2026**

Phase 5 memindahkan seluruh route destination administration, wishlist, reviews, dan saved itineraries dari `backend/server.py` ke vertical slice modular. Public OpenAPI tetap identik dengan baseline, sementara ownership, atomic mutation, active-destination policy, dan public/private serialization sekarang ditegakkan di application service.

## Scope yang Dimigrasikan

| Domain | Route/use case |
|---|---|
| Destination admin | list options, paginated search, detail, create, update, toggle active, delete |
| Wishlist | list active destinations, add, remove |
| Reviews | public list, create, owner update, owner/admin delete |
| Itineraries | create, list, detail, update, duplicate, delete |
| Sharing | share toggle dan public itinerary API |
| Planner result | validasi stored v2, sanitasi partner, hydration destination/partner cards |

Route HTML/social-card di `/api/share/*` tidak termasuk scope ini dan tetap berada di legacy composition module sampai Phase 9.

## Struktur Implementasi

```text
backend/app/modules/
├── destinations/
│   ├── exceptions.py
│   ├── mapper.py
│   ├── ports.py
│   ├── repository.py
│   ├── router.py
│   ├── schemas.py
│   └── service.py
├── wishlist/
│   ├── dependencies.py
│   ├── exceptions.py
│   ├── ports.py
│   ├── repository.py
│   ├── router.py
│   └── service.py
├── reviews/
│   ├── dependencies.py
│   ├── exceptions.py
│   ├── mapper.py
│   ├── ports.py
│   ├── repository.py
│   ├── router.py
│   ├── schemas.py
│   └── service.py
└── itineraries/
    ├── dependencies.py
    ├── exceptions.py
    ├── hydration.py
    ├── mapper.py
    ├── ports.py
    ├── repository.py
    ├── router.py
    ├── schemas.py
    └── service.py
```

`server.py` hanya mengimpor dan mendaftarkan router/exception handler tersebut. Tidak ada decorator route Phase 5 yang tersisa di legacy module.

## Keputusan Arsitektur

### Destination administration

`DestinationAdminService` memiliki aturan normalisasi tag, validasi editorial source URL/tanggal, filter harga, pagination, sort allowlist, dan audit intent. `MongoDestinationRepository` memiliki operasi write dan memakai `find_one_and_update` dengan aggregation update untuk membalik `is_active` secara atomik.

### Wishlist

Wishlist memiliki repository/service terpisah. Penambahan hanya menerima destination yang valid dan aktif. Mutasi user menggunakan MongoDB `$addToSet` dan `$pull`; event trending tetap dicatat setelah add agar perilaku analytics lama dipertahankan.

### Reviews

Service membedakan aturan berikut:

- review hanya dapat dibuat pada destination aktif;
- update hanya dapat dilakukan pemilik review;
- delete dapat dilakukan pemilik atau admin;
- update/delete persistence memakai predicate user yang relevan untuk mencegah bypass setelah ownership check.

### Saved itineraries

`ItineraryService` menjadi satu-satunya pemilik aturan ownership. Repository membedakan lookup biasa, user-scoped mutation, dan public lookup. DTO juga dipisah secara eksplisit:

- `ItineraryIn` untuk persistence input;
- `ItineraryUpdateIn` untuk perubahan metadata trip;
- `ItineraryOut` untuk workspace pemilik;
- `PublicItineraryOut` untuk shared trip.

Public DTO tidak memiliki `id`, `user_id`, `extra_context`, `share_slug`, `is_public`, atau `duplicated_from_id`, sehingga private fields tidak dapat bocor akibat serialisasi document generik.

### Structured planner result v2

`PlannerResultHydrator` mempertahankan dua representasi:

- stored result hanya menyimpan ID/reference dan content terstruktur;
- response menghidrasi destination/partner card dari record aktif saat request dibaca.

Partner yang tidak approved, inactive, tidak menerima kontak, berbeda tipe, atau tidak lagi melayani destination terkait dibuang. Legacy itinerary tanpa `result_version=2` tetap dapat dibuat dan dibuka.

## Atomicity dan Race Safety

| Operasi | Mekanisme |
|---|---|
| Toggle destination | single `find_one_and_update` aggregation pipeline |
| Add wishlist | `$addToSet` |
| Remove wishlist | `$pull` |
| Review update | `_id + user_id` conditional update |
| Itinerary update/share | `_id + user_id` conditional update |
| Itinerary/review delete | conditional delete sesuai authorization |

## Contract dan Test Coverage

Test baru:

- `tests/unit/test_phase5_services.py` — normalization, validation, active destination, review/itinerary cross-account denial, admin delete, public projection;
- `tests/api/test_phase5_api.py` — seluruh HTTP route Phase 5 melalui dependency override;
- `tests/contract/test_phase5_architecture.py` — router bebas query/BSON, service bebas FastAPI/BSON, route legacy hilang, DTO public denylist;
- `tests/integration/test_phase5_repositories.py` — persistence nyata terhadap isolated Mongo database;
- `tests/test_planner_saved_result.py` dimigrasikan dari helper `server.py` ke itinerary service/hydrator.

Hasil verifikasi:

| Gate | Hasil |
|---|---|
| Frozen OpenAPI | PASS — 116 paths / 140 operations, tanpa perubahan |
| Duplicate method/path | PASS — 0 duplicate |
| Backend contract suite | PASS — 62 tests |
| Phase 5 Mongo integration | PASS — 1 end-to-end repository scenario |
| Phase 5 unit/API/architecture + saved result | PASS — 15 tests |
| Real Uvicorn workspace ownership smoke | PASS — 1 scenario |
| Real Uvicorn itinerary/share regression | PASS — 7 tests |
| Frontend regression | PASS — 38 suites / 142 tests |
| Flake8 Phase 5 (`max-line-length=88`) | PASS |

Satu warning dependency eksternal tetap ada: Starlette mengeluarkan `PendingDeprecationWarning` untuk import `multipart`. Warning ini tidak berasal dari implementasi Phase 5.

## Exit Criteria

| Exit criterion | Status | Evidence |
|---|---|---|
| Seluruh scope keluar dari `server.py` | PASS | static architecture test dan zero duplicate route |
| Ownership serta public/private boundary diuji | PASS | negative service test dan real Uvicorn cross-account flow |
| Legacy dan structured v2 dapat dibuka | PASS | saved-result lifecycle test serta legacy API smoke |
| Contract frontend terkait lulus | PASS | seluruh 38 frontend suites lulus |

Phase 5 selesai. Phase 6 dapat menggunakan pola ownership predicate, explicit mapper, dan feature-local dependency composition ini untuk Partners dan Mitra workspace.
