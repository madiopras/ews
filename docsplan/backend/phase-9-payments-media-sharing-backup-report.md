# Phase 9 — Payments, Media, Sharing, Backup, dan External I/O

## Status

**Selesai.** Seluruh 20 operasi HTTP Phase 9 telah dipindahkan dari `backend/server.py` ke vertical slice modular tanpa perubahan public OpenAPI. Snapshot tetap berisi **116 path / 140 operation**, tanpa route duplikat.

## Hasil Implementasi

| Boundary | Modul | Tanggung jawab |
|---|---|---|
| Billing | `app/modules/billing` | premium plan, order, authorization pemilik Mitra, Midtrans, signature, dan idempotent activation |
| Media | `app/modules/media` | upload image, magic-byte validation, object-key policy, object storage async, dan public file serving |
| Backup | `app/modules/backups` | lifecycle job, Mongo Extended JSON Lines writer, retention, download, dan delete |
| Sharing | `app/modules/sharing` | public itinerary lookup, OG metadata, safe base URL, HTML escaping, dan PNG renderer |

Setiap boundary memiliki router tipis, dependency composition, service/use case, persistence adapter, gateway/renderer, mapper atau domain policy, serta typed application error.

## Payment dan Midtrans

- Network provider menggunakan `httpx.AsyncClient` dengan connect/operation timeout dan error mapping yang tidak membocorkan credential atau provider body.
- Signature SHA-512 diverifikasi dengan `hmac.compare_digest()` sebelum persistence.
- `signature_key` dikeluarkan dari provider payload yang disimpan.
- Aktivasi premium memakai conditional atomic claim `premium_activated_at`; duplicate dan concurrent callback hanya dapat memperpanjang premium satu kali.
- Payment history dan retry mempertahankan owner/admin policy, termasuk explicit owner membership dari Phase 6.
- Provider berada di `MidtransGateway`, sehingga service dan HTTP tests tidak membutuhkan Midtrans nyata.

## Media dan Partner Storage

- Upload publik-admin memvalidasi extension, batas 8 MB, dan magic bytes JPG/PNG/GIF/WEBP.
- Object key menolak absolute path, `..`, backslash, query, dan fragment sebelum local maupun remote I/O.
- Namespace `verification/` tetap tidak dapat dilayani oleh public file endpoint.
- Local filesystem menggunakan `asyncio.to_thread()`; remote object storage menggunakan `httpx.AsyncClient`.
- Gallery dan verification document Mitra menggunakan shared async object-storage gateway. Tidak ada lagi blocking `requests` di application runtime.

## Backup dan Sharing

- Request create backup hanya membuat job 202; dump Mongo sinkron dijalankan di background task dan `asyncio.to_thread()`.
- Operasi filesystem status/read/delete/retention juga dipindahkan keluar event loop.
- Filename backup dibatasi ke basename aman di dalam configured backup directory.
- Renderer Pillow terpisah dari transport HTTP dan dieksekusi melalui `asyncio.to_thread()`.
- Forwarded protocol/host disanitasi, metadata dan redirect target di-escape, dan structured planner summary tidak mengekspos private context.

## Audit External I/O Lain

- SMTP tetap memakai library sinkron, tetapi pengiriman hanya terjadi melalui `asyncio.to_thread()` di auth email gateway.
- Verifikasi Google ID token juga dijalankan melalui `asyncio.to_thread()`.
- Provider LLM tetap berada di gateway Phase 8 dengan async streaming client.

## Verifikasi

| Gate | Hasil |
|---|---:|
| Frozen OpenAPI | 116 path / 140 operation, identik |
| Contract suite | 188 passed |
| Phase 9 unit + architecture | 10 passed |
| Phase 9 API transport | 2 passed |
| Phase 9 Mongo integration | 1 passed |
| Focused live Uvicorn regression | 14 passed |

Live regression mencakup auth-gated upload, valid image upload/serve, social preview/image/404, public dan admin premium plan lifecycle, background backup create/download/delete, serta payment ownership protection. Test-only premium plan, file upload, dan metadata file yang tertinggal dari proses verifikasi telah dihapus kembali.

## Exit Criteria

- [x] Tidak ada blocking HTTP request pada async endpoint.
- [x] Callback payment aman terhadap duplicate/concurrent notification.
- [x] Backup, media filesystem, dan image rendering tidak memblokir event loop.
- [x] Midtrans, object storage, renderer, dan persistence dapat diganti fake pada test.
- [x] Security coverage tersedia untuk signature, secret redaction, traversal, upload spoofing, forwarded-host injection, dan HTML escaping.
- [x] Frozen OpenAPI dan route count dipertahankan.

Phase 10 dapat dimulai untuk cutover composition root, migrasi sisa direct `server` test imports, enforcement batas import, penghapusan compatibility shim/global, dan cleanup akhir legacy module.
