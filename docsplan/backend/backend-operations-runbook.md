# Backend Operations Runbook

## Entrypoint dan konfigurasi

Entrypoint deployment kanonis adalah `app.main:app` dari working directory `backend/`:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`server:app` tetap tersedia sementara sebagai shim rollback-compatible, tetapi tidak digunakan oleh Makefile atau test. Konfigurasi berasal dari environment melalui `app.core.config.Settings`; secret tidak boleh dikirim sebagai argumen command atau ditulis ke log.

## Preflight release

1. Jalankan `make backup` dan pastikan file archive gzip yang dilaporkan tidak kosong.
2. Validasi `.env` dengan `make env-check`; perintah ini hanya menampilkan nama key.
3. Jalankan `make qa-phase10` terhadap commit/image kandidat.
4. Jalankan `cd backend && ../.venv/bin/python -m scripts.quick_test` pada environment target.
5. Pastikan `/health` mengembalikan HTTP 200 dan `database: connected`.
6. Jalankan `make test-backend-live` pada environment disposable/staging.
7. Bandingkan OpenAPI dengan baseline melalui `python -m scripts.phase0_contracts --check`.

## Deployment

Gunakan rolling deployment satu worker baru terlebih dahulu. Readiness harus memanggil `GET /health`; jangan kirim traffic sebelum respons 200. Setelah satu instance stabil, lanjutkan rollout dan pertahankan versi sebelumnya sampai smoke test selesai.

Smoke minimum:

```bash
curl --fail --silent http://127.0.0.1:8000/health
curl --fail --silent http://127.0.0.1:8000/api/
curl --fail --silent http://127.0.0.1:8000/api/destinations
```

Pantau startup-to-readiness, p50/p95 endpoint penting, HTTP 5xx, timeout provider, dan jumlah koneksi MongoDB. Baseline lokal Phase 10 satu worker: readiness 1.62 detik; `/health` p95 3.01 ms; `/api/` p95 1.55 ms; `/api/destinations` p95 10.84 ms; 90 request menghasilkan 0% error. Motor menambah tiga koneksi saat worker hidup dan melepas ketiganya saat shutdown pada pengukuran ini. Nilai lokal adalah pembanding regresi, bukan SLO produksi.

## Index dan startup initialization

Index initialization tetap berada di lifespan untuk Phase 10. Operasinya idempotent, memastikan fresh environment siap, dan overhead-nya tercakup dalam baseline readiness. Jangan menjalankan beberapa rollout worker baru serentak jika perubahan index berat sedang diperkenalkan.

Pindahkan index initialization menjadi explicit pre-deploy job setelah platform deployment memiliki job tunggal, locking/serialization, observability, retry, dan failure gate. Setelah itu, aplikasi hanya boleh memvalidasi versi schema/index saat startup. Seed default yang idempotent dapat dipisahkan pada perubahan yang sama.

## Rollback

Phase 10 tidak memperkenalkan perubahan database yang tidak backward-compatible. Jika health, error rate, atau latency memburuk:

1. Hentikan rollout dan keluarkan instance baru dari traffic.
2. Deploy kembali image/commit sebelumnya dengan environment yang sama.
3. Gunakan `server:app` hanya bila command deployment lama belum dapat diperbarui; shim menunjuk aplikasi yang sama.
4. Verifikasi `/health`, root API, destination read, login, dan satu alur write yang aman.
5. Restore backup hanya bila data benar-benar rusak. Cutover kode saja tidak memerlukan restore database.
6. Simpan log dan metrik insiden sebelum menghapus instance gagal.

Rollback dinyatakan selesai setelah endpoint smoke kembali normal, HTTP 5xx kembali ke baseline, dan koneksi MongoDB instance yang dihentikan telah dilepas.

## Suite test

- `make test-backend`: release gate deterministik, termasuk real MongoDB integration.
- `make test-backend-live`: current end-to-end milestone; backend harus berjalan dan database harus disposable.
- `make qa-phase10`: backend gate, architecture/lint/type-check, frontend test/lint/build/budget.
- `make test-backend-legacy-e2e`: suite historis non-gating yang masih mengasumsikan provider, seed, dan kontrak lama. Gunakan hanya untuk investigasi kompatibilitas dan jangan jalankan terhadap data produksi.
