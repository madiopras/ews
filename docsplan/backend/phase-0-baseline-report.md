# Phase 0 — Baseline Test Report

## Status

- Recorded: **2026-09-09 (Asia/Bangkok)**.
- Phase 0 contract gate: **PASS**.
- Existing full backend suite: **NOT GREEN at baseline**.
- Production behavior changed by Phase 0: **No**.

Dokumen ini merekam kondisi test sebelum pemindahan arsitektur dimulai. Kegagalan existing tidak diperbaiki dalam Phase 0 agar refactor dan behavior change tidak tercampur.

---

## 1. Runtime Baseline

| Item | Observed value |
|---|---|
| Python | 3.10.12 |
| Pytest | 9.1.1 |
| Pytest workers | 2 (`--dist loadscope`, dari `pytest.ini`) |
| Collected backend tests | 182 |
| MongoDB | MongoDB 7 container, healthy |
| API server | Uvicorn, `server:app`, `127.0.0.1:8000` |
| OpenAPI paths | 116 |
| OpenAPI operations | 140 |
| OpenAPI component schemas | 74 |
| Legacy-coupled test files | 10, termasuk test Phase 0 yang memuat `server.app` |

Jumlah operation berbeda dari jumlah path karena beberapa path memiliki lebih dari satu HTTP method.

---

## 2. Executable Phase 0 Contract Gate

Command dijalankan dari `backend/`:

```bash
../.venv/bin/python -m scripts.phase0_contracts --check
../.venv/bin/python -m pytest -n 0 tests/test_phase0_contracts.py -q
```

Hasil:

```text
Phase 0 API baselines match.
4 passed, 5 warnings in 1.42s
```

Empat guard yang aktif:

1. OpenAPI harus sama dengan normalized Phase 0 snapshot.
2. Route metadata harus sama dengan Phase 0 inventory.
3. Tidak boleh ada duplicate `method + path`.
4. Test baru tidak boleh menambah coupling terhadap legacy `server.py`.

Warnings berasal dari dependency `python_multipart` serta penggunaan FastAPI `on_event` startup/shutdown yang sudah deprecated. Migrasi lifespan memang direncanakan pada Phase 2.

---

## 3. Full Suite tanpa API Server

Command:

```bash
cd backend
../.venv/bin/python -m pytest tests/ -v
```

Hasil:

```text
40 failed, 100 passed, 1 skipped, 10 warnings, 41 errors in 9.94s
real 10.36s
```

Mayoritas failure/error adalah `Connection refused` ke `127.0.0.1:8000`. Sebagian besar integration/web-experience tests menggunakan `requests` terhadap server eksternal dan tidak menyalakan aplikasi melalui fixture. Dengan demikian, menjalankan `make test-backend` tanpa server bukan gate yang self-contained pada baseline.

---

## 4. Full Suite dengan MongoDB dan API Server Aktif

Prasyarat:

1. MongoDB yang sesuai `backend/.env` aktif dan healthy.
2. Port `8000` tidak sedang dipakai proses lain.
3. Backend dijalankan dari `backend/` agar `.env` dan import path sama dengan penggunaan development saat ini.

Terminal server:

```bash
cd backend
../.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Terminal test:

```bash
cd backend
/usr/bin/time -p ../.venv/bin/python -m pytest tests/ -q
```

Hasil:

```text
15 failed, 153 passed, 1 skipped, 10 warnings, 13 errors in 157.24s
real 175.49s
```

### Known baseline failure groups

| Group | Evidence observed | Classification |
|---|---|---|
| Destination fixture | `test_iteration4.py` mengharapkan key persis `Danau Toba`, tetapi dataset aktif saat run tidak memilikinya | Shared test-data/environment assumption |
| Legacy public Partner creation | Sejumlah test mengharapkan `POST /api/partners` tanpa login mengembalikan 200; runtime saat ini mengembalikan 401 | Stale API behavior expectation |
| Payment fixtures | Partner setup memakai request tanpa authenticated session sehingga menerima 401 | Test fixture/session issue |
| Midtrans config | Test mengharapkan sandbox client-key prefix tertentu; environment berisi placeholder | Environment/config assumption |
| Admin plan response | Test lama mengharapkan list, route saat ini mengembalikan paginated object | Stale response expectation |
| Unknown plan ID | Test mengharapkan 404, runtime mengembalikan 400 pada ID tertentu | Existing contract mismatch |
| Unknown share slug | Test mengharapkan 404, runtime menghasilkan 500 | Existing runtime bug |
| Planner destination assertions | Daftar nama yang diharapkan test tidak sama dengan katalog aktif/hasil planner | Shared data/provider assumption |
| Planner English stream | External/local LLM stream melewati read timeout | External integration instability |

Kegagalan di atas adalah kondisi existing yang terlihat saat baseline dan bukan akibat generator/test Phase 0. Sebelum menjadikan seluruh suite sebagai blocking CI gate, test-data isolation, server lifecycle fixture, provider fakes, dan stale expectations perlu ditangani sebagai pekerjaan stabilisasi terpisah atau pada fase domain terkait.

---

## 5. Repeatability Rules

- Selalu laporkan apakah API server aktif ketika suite dijalankan.
- Gunakan database test khusus; suite integrasi melakukan mutation dan cleanup tidak selalu lengkap.
- Jangan menjalankan integration suite terhadap production database.
- Pertahankan `pytest.ini` dengan dua xdist workers; gunakan `-n 0` hanya untuk diagnosis serial.
- Rekam commit SHA, timestamp, environment category, pass/fail/error/skip count, dan durasi untuk baseline berikutnya.
- Jangan memperbarui OpenAPI/route snapshot hanya agar test hijau. Review diff kontrak terlebih dahulu.
- Jalankan contract gate yang cepat sebelum dan sesudah setiap phase/PR.

---

## 6. Phase 0 Exit Criteria Assessment

| Exit criterion | Status | Evidence |
|---|---|---|
| Semua route terwakili dalam inventory | PASS | 140 operations pada route JSON dan Markdown inventory |
| Contract test mendeteksi route hilang/berubah | PASS | OpenAPI dan route baseline equality tests |
| Duplicate method/path dideteksi | PASS | Dedicated duplicate route test |
| Coupling legacy tercatat dan tidak boleh bertambah | PASS | AST inventory baseline untuk 10 test files |
| Backend suite mempunyai baseline yang dapat diulang | PASS | Prasyarat, command, hasil, dan known failures tercatat |
| Tidak ada perubahan production behavior | PASS | Hanya generator, test, snapshots, dan dokumentasi ditambahkan |

Phase 0 dinyatakan **selesai dengan known existing test debt terdokumentasi**. Contract gate Phase 0 adalah green gate wajib untuk Phase 1; angka full-suite menjadi pembanding dan tidak boleh memburuk akibat refactor.
