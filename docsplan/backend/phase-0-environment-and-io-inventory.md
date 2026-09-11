# Phase 0 — Environment and Blocking I/O Inventory

## Scope

Dokumen ini mencatat environment variable dan synchronous/blocking I/O yang digunakan backend sebelum refactor Clean Architecture. Nilai environment tidak disalin ke dokumen ini.

Status requirement menggunakan definisi berikut:

- **Startup required**: import/start aplikasi gagal jika variable tidak tersedia.
- **Feature required**: hanya wajib saat fitur terkait digunakan atau diaktifkan.
- **Optional**: mempunyai fallback atau hanya mengubah perilaku opsional.
- **Observed only**: saat ini hanya dipakai untuk menampilkan status integrasi.

---

## 1. Environment Variable Matrix

### Core application dan database

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `MONGO_URL` | Startup required | Mongo client dan backup | Tidak ada pada `server.py` | Wajib tervalidasi oleh typed settings |
| `DB_NAME` | Startup required | Async database dan backup | Tidak ada pada `server.py` | Wajib tervalidasi oleh typed settings |
| `JWT_SECRET` | Feature required | Access token, action token, guest identity, LLM key derivation | Tidak ada saat fungsi security dipanggil | Jadikan startup required untuk deployment aplikasi penuh |
| `ENVIRONMENT` | Optional | Proteksi URL LLM | `development` | Gunakan enum environment |
| `APP_NAME` | Optional | General settings dan object storage namespace | Terdapat dua fallback berbeda | Satukan satu makna/default |
| `CORS_ORIGINS` | Optional | CORS middleware | `*` | Parse sebagai list dan validasi kombinasi credentials |
| `COOKIE_SECURE` | Optional | Auth dan guest cookies | `false` | Default production harus aman |
| `PUBLIC_APP_URL` | Optional | Link email dan public share redirect | URL localhost/request base | Validasi absolute public URL |
| `BACKUP_DIR` | Optional | Database backup | `backend/backups` | Validasi path pada startup |
| `REDIS_URL` | Observed only | Admin integration status | Tidak dikonfigurasi | Hapus jika tidak dipakai atau beri owner/use case |

### Bootstrap admin

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `ADMIN_EMAIL` | Optional tetapi sensitif | Startup admin seed dan general settings | Development email bawaan | Jangan gunakan credential default di production |
| `ADMIN_PASSWORD` | Optional tetapi sensitif | Startup admin seed/update | Development password bawaan | Wajib explicit di production; pisahkan bootstrap job |

Startup saat ini dapat membuat admin baru dan juga mengganti password admin yang ada agar sama dengan environment. Behavior ini harus dibekukan oleh test sebelum disentuh dan dipindahkan dari lifecycle aplikasi pada fase lanjutan.

### Google Identity

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `GOOGLE_OAUTH_ENABLED` | Optional | Google config/login | `false` | Typed boolean |
| `GOOGLE_CLIENT_ID` | Feature required | Google token audience | Kosong | Required jika Google OAuth aktif |
| `GOOGLE_CLIENT_SECRET` | Redaction-only | System-log secret redaction list | Tidak memengaruhi Google login saat ini | Tidak diperlukan oleh direct Google Identity flow; pertahankan redaction |

### LLM dan LLM profiles

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `USE_LLM` | Optional | Planner/runtime health | `true` | Typed boolean |
| `LLM_BASE_URL` | Feature required | Environment LLM client | Local OpenAI-compatible URL | Required jika environment LLM aktif |
| `LLM_API_KEY` | Optional/provider-specific | LLM authorization | Kosong | Secret type; jangan log |
| `LLM_MODEL_NAME` | Feature required | LLM request | `dios-chat` | Required jika LLM aktif |
| `LLM_PROFILE_ENCRYPTION_KEY` | Optional tetapi direkomendasikan | Encryption profile API keys | Diturunkan dari `JWT_SECRET` | Gunakan secret terpisah di production |
| `LLM_ALLOW_PRIVATE_URLS` | Optional | SSRF policy untuk profile base URL | `true` di development, `false` di production | Typed boolean dan environment-aware |
| `LLM_ALLOWED_HOSTS` | Optional | Allowlist LLM profile hosts | Kosong | Parse/normalisasi sebagai set host |

### Email dan SMS

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `SMTP_HOST` | Optional | Auth email | Outbox berstatus `configuration_required` | Menjadi enablement condition |
| `SMTP_PORT` | Optional | SMTP client | `587` | Typed integer/range validation |
| `SMTP_STARTTLS` | Optional | SMTP transport | `true` | Typed boolean |
| `SMTP_USERNAME` | Optional | SMTP authentication | Kosong/no login | Secret-adjacent |
| `SMTP_PASSWORD` | Feature required | SMTP authentication | Kosong | Secret; required jika username terisi |
| `SMTP_FROM` | Optional | Sender address | Application default | Validasi email |
| `SMS_WEBHOOK_URL` | Optional | Transactional SMS | Outbox berstatus `configuration_required` | Validasi HTTPS/public URL |
| `SMS_WEBHOOK_TOKEN` | Optional | SMS webhook authorization | Tanpa Authorization header | Secret; jangan log |

### Object storage

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `INTEGRATION_PROXY_URL` | Optional | Remote object storage base URL | Emergent integration URL | Validasi HTTPS dan SSRF policy |
| `EMERGENT_LLM_KEY` | Optional | Remote object storage initialization | Local storage mode | Nama variable mencampur concern LLM/storage; pertahankan dahulu untuk kompatibilitas |
| `STORAGE_DIR` | Optional | Local object storage | `backend/storage` | Validasi path dan permission |

### Midtrans

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan Phase 2 |
|---|---|---|---|---|
| `MIDTRANS_ENV` | Optional | Pemilihan sandbox/production | `sandbox` | Enum `sandbox`/`production` |
| `MIDTRANS_MERCHANT_ID` | Feature required (sandbox) | Payment config | Tidak ada | Required saat sandbox payment digunakan |
| `MIDTRANS_CLIENT_KEY` | Feature required (sandbox) | Frontend Snap config | Tidak ada | Public key tetapi tetap dikelola settings |
| `MIDTRANS_SERVER_KEY` | Feature required (sandbox) | Snap API/signature | Tidak ada | Secret; jangan log |
| `MIDTRANS_MERCHANT_ID_PRODUCTION` | Feature required (production) | Payment config | Tidak ada | Required jika `MIDTRANS_ENV=production` |
| `MIDTRANS_CLIENT_KEY_PRODUCTION` | Feature required (production) | Frontend Snap config | Tidak ada | Required jika `MIDTRANS_ENV=production` |
| `MIDTRANS_SERVER_KEY_PRODUCTION` | Feature required (production) | Snap API/signature | Tidak ada | Secret; required jika production |

### Test/runtime harness

| Variable | Status saat ini | Consumer | Fallback/perilaku tanpa nilai | Catatan |
|---|---|---|---|---|
| `REACT_APP_BACKEND_URL` | Optional | Backend web-experience tests | `http://127.0.0.1:8000` atau runtime test server | Bukan backend production setting |

### Gap `.env.example`

`.env.example` saat Phase 0 hanya mendokumentasikan core database/JWT, Google, SMTP, dan SMS. Variable LLM, storage, Midtrans, admin bootstrap, backup, CORS, environment, serta test runtime belum tercakup. File contoh akan diselaraskan ketika typed settings diperkenalkan pada Phase 2 agar tidak mendahului keputusan validasi/default yang baru.

---

## 2. Synchronous/Blocking I/O Inventory

### Direct blocking calls pada async lifecycle/endpoint

| Runtime path | Blocking operation | Current protection | Risiko | Target phase |
|---|---|---|---|---|
| Application startup -> `init_storage()` | `requests.post` hingga 30 detik | Tidak ada thread offload | Startup event loop tertahan | Phase 9 |
| `POST /api/upload` | Local file write atau `requests.put` hingga 120 detik | Tidak ada thread offload | Worker tidak melayani request lain selama upload storage | Phase 9 |
| `GET /api/files/{path}` | Local file read atau `requests.get` hingga 60 detik | Tidak ada thread offload | Worker tertahan oleh file/network I/O | Phase 9 |
| Partner document upload | `put_object()` local/synchronous HTTP | Tidak ada thread offload | Worker tertahan | Phase 6/9 |
| Partner document download | `get_object()` local/synchronous HTTP | Tidak ada thread offload | Worker tertahan | Phase 6/9 |
| Partner document delete | `delete_object()` local/synchronous HTTP | Tidak ada thread offload | Worker tertahan | Phase 6/9 |
| Partner gallery upload/delete | `put_object()`/`delete_object()` | Tidak ada thread offload | Worker tertahan | Phase 6/9 |
| Partner deletion cleanup | Beberapa `delete_object()` berurutan | Tidak ada thread offload | Latency bertambah sesuai jumlah aset | Phase 6/9 |
| `GET /api/share/{slug}/image.png` | Pillow image rendering/PNG compression | Tidak ada thread/process offload | CPU work memblokir event loop | Phase 9 |
| Backup status/delete paths | Directory create/stat/unlink | Tidak ada offload | Risiko rendah per operasi, tetapi tetap sinkron | Phase 9 |

### Blocking implementation yang sudah di-offload

| Runtime path | Blocking operation | Current protection | Catatan |
|---|---|---|---|
| Auth email delivery | `smtplib.SMTP` | `asyncio.to_thread()` | Sudah tidak langsung memblokir event loop; masih perlu gateway/queue |
| Database backup generation | Sync `MongoClient`, gzip, dan file writes | `asyncio.to_thread()` | Event loop aman, tetapi job masih hidup di process aplikasi dan tidak durable |

### Async external I/O yang tetap perlu gateway

- LLM streaming menggunakan `httpx.AsyncClient` dengan timeout.
- SMS webhook menggunakan `httpx.AsyncClient` dengan timeout dan redirect disabled.
- Midtrans Snap/status menggunakan `httpx.AsyncClient` dengan timeout.
- DNS lookup pada validasi LLM URL memakai executor.

Call tersebut tidak dikategorikan sebagai blocking event-loop issue, tetapi tetap perlu dipindahkan ke infrastructure gateway agar error mapping, retry policy, observability, dan unit test konsisten.

---

## 3. Import-Time dan Startup Side Effects

| Side effect | Waktu terjadi | Risiko | Target phase |
|---|---|---|---|
| Membaca `.env` | Import `server.py` | Configuration tersembunyi dari composition root | Phase 2 |
| Membuat `AsyncIOMotorClient` dan global `db` | Import `server.py` | Test perlu environment dan monkeypatch global | Phase 2 |
| Membuat dummy bcrypt hash | Import `server.py` | Menambah biaya import/startup | Phase 2/4 |
| Membuat LLM client global dan asyncio lock | Import `server.py` | Lifecycle/test isolation tidak eksplisit | Phase 2/8 |
| Membuat banyak MongoDB index | Startup | Setiap worker/pod menjalankan pekerjaan serupa | Phase 2 lalu deployment job |
| Mutasi/seeding admin dan data default | Startup | Startup mengubah data dan credential | Phase 2/10 |
| Remote/local storage initialization | Startup | Dapat melakukan network/file I/O | Phase 9 |
| Membuat backup directory dan system log | Startup | Filesystem/database mutation saat boot | Phase 2/9 |

---

## 4. Verification

Inventaris ini bersifat dokumentasi baseline. Verifikasi executable untuk route/OpenAPI dan coupling test berada di:

- `backend/tests/test_phase0_contracts.py`;
- `backend/tests/contracts/openapi-baseline.json`;
- `backend/tests/contracts/routes-baseline.json`;
- `backend/tests/contracts/server-coupling-baseline.json`.

Environment values tidak pernah dibaca atau ditulis oleh generator Phase 0. Generator hanya mengimpor aplikasi untuk memperoleh metadata route/OpenAPI.
