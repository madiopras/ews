# Explore Wisata Sumut

Aplikasi wisata Sumatera Utara dengan backend FastAPI modular, MongoDB, dan frontend React. Backend menggunakan vertical slices dengan batas Clean/Layered Architecture; composition root produksinya adalah `app.main:app`.

## Menjalankan secara lokal

Prasyarat: Python 3.10+, Node.js/npm, Docker, dan Docker Compose.

```bash
cp backend/.env.example backend/.env
make docker-up
make install-backend
make install-frontend
make dev-backend
```

Jalankan `make dev-frontend` di terminal lain. API tersedia di `http://localhost:8000`, dokumentasi OpenAPI di `/docs`, dan frontend di `http://localhost:3000`.

Jangan memakai nilai contoh untuk secret atau kredensial pada staging/production. Konfigurasi runtime dibaca oleh `backend/app/core/config.py`; nilai secret tidak boleh dicetak ke log.

## Quality gate

```bash
make test-backend
make test-backend-live       # backend harus sedang berjalan
make qa-phase10
```

`make test-backend` adalah gate deterministik: contract/unit/API dan integration MongoDB. `make test-backend-legacy-e2e` hanya untuk suite historis yang membutuhkan state serta provider lama dan bukan release gate.

Panduan backend ada di [backend/README.md](backend/README.md), sedangkan prosedur deployment dan rollback ada di [backend operations runbook](docsplan/backend/backend-operations-runbook.md).
