# Backend Explore Wisata Sumut

Entrypoint kanonis backend adalah:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`server.py` hanya compatibility shim untuk deployment lama. Kode baru dan test tidak boleh mengimpor `server`.

## Struktur

```text
app/
├── api/                         HTTP lintas-domain dan exception handler
├── core/                        settings dan security primitives
├── infrastructure/database/     lifecycle MongoDB, index, startup initialization
├── modules/<feature>/           router, dependencies, schema, service, repository/gateway
├── shared/                      kontrak murni lintas fitur
└── main.py                      application factory dan composition root
scripts/                         utility dan contract tooling
tests/{unit,api,integration,contract}/
```

Alur dependensi yang diharapkan adalah router → service/domain port → repository/gateway adapter. Router tidak menjalankan query/database atau provider I/O. Service tidak bergantung pada FastAPI, Motor, PyMongo, atau BSON. Wiring lintas fitur hanya diletakkan pada composition/dependency provider.

## Setup

Salin `.env.example` ke `.env`, isi seluruh nilai wajib, lalu dari root repository jalankan:

```bash
make docker-up
make install-backend
make dev-backend
```

Verifikasi cepat tanpa menampilkan secret:

```bash
cd backend
../.venv/bin/python -m scripts.quick_test
```

## Test dan pemeriksaan arsitektur

```bash
make test-backend
make test-backend-architecture
make lint-backend
make typecheck-backend
make qa-phase10
```

OpenAPI dan route inventory dibekukan di `tests/contracts/`. Perubahan public contract harus disengaja dan direview; jangan memperbarui snapshot hanya untuk membuat test hijau.

## Utility

- `python -m scripts.audit_culinary_partners`: audit read-only kandidat partner kuliner.
- `python -m scripts.migrate_is_active`: migrasi idempotent field aktif.
- `python -m scripts.import_destinations`: mengganti koleksi destination dari dataset JSON; backup dan review target database sebelum menjalankan.
- `scripts/test_llm_router.sh`: memeriksa konfigurasi/import tanpa mencetak API key.

Lihat [runbook](../docsplan/backend/backend-operations-runbook.md) untuk preflight, observability, rollback, dan keputusan lifecycle index.
