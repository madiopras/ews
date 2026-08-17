# Explore Wisata Sumut — PRD

## Original Problem Statement
Buat aplikasi web direktori wisata Sumatera Utara bernama Explore Wisata Sumut. Fitur: database destinasi (nama, lokasi, kategori, harga, deskripsi), halaman detail per destinasi, filter berdasarkan kategori dan budget, dan halaman utama yang menampilkan destinasi unggulan. Desain modern dengan foto besar.

## User Choices
- Data destinasi via admin panel + 5 seed samples (1 per kategori)
- Kategori: Alam, Pantai, Budaya & Sejarah, Kuliner, Petualangan
- Fitur tambahan: search, wishlist (perlu login), peta lokasi
- Desain: Tropical modern neumorphism
- Bilingual ID/EN

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT auth via httpOnly cookies, bcrypt hashing
- Frontend: React (CRA) + Tailwind + shadcn primitives + Leaflet (OpenStreetMap) + sonner toasts
- Routing: /, /explore, /destination/:id, /login, /register, /wishlist (auth), /admin (admin-only)

## Personas
- **Wisatawan**: browse destinasi, filter, view detail + peta, simpan favorit (login)
- **Admin**: CRUD destinasi (seeded: admin@wisatasumut.id / admin123)

## Core Requirements — Implemented (2026-02-17)
- [x] Homepage: hero besar (Danau Toba), 5 category tiles, 4 destinasi unggulan
- [x] Directory: search bar, filter kategori (pill neumorphic), filter budget (max_price)
- [x] Detail page: gallery thumbnails, price/category info cards, Leaflet map, wishlist toggle
- [x] Auth: register, login, logout, /me — cookie-based JWT (7-day access)
- [x] Wishlist: add/remove/list (protected)
- [x] Admin panel: CRUD form
- [x] Bilingual toggle (ID/EN) persisted in localStorage
- [x] Neumorphic design (Warm Sand + Sunset Orange + Playfair Display + Manrope)
- [x] 5 seed destinations, 1 per category

## Iteration 2 — Implemented (2026-02-17)
- [x] AI Trip Planner (Claude Sonnet 4.6 via Emergent LLM key) — SSE streaming, uses ONLY DB destinations, bilingual output
- [x] Multi Image Upload (Emergent Object Storage) — drag-and-drop in admin panel
- [x] User Reviews — 1-5 stars + comment, requires login, avg rating displayed on detail page
- [x] Batak Ulos SVG pattern backdrop on home + planner hero + footer

## Iteration 3 — Implemented (2026-02-17)
- [x] Local Partners directory `/partners` — guide/rental mobil/homestay, public registration form, admin approval workflow, filter by type
- [x] Partners on Destination Detail — approved partners appear with WhatsApp click-to-chat button
- [x] Admin Partners tab — Approve/Reject/Delete actions
- [x] Planner Save — signed-in users save AI itinerary with a title
- [x] Wishlist tabs — "Destinations" + "Trip Plans" with expand & delete
- [x] Trending Destinations — top wishlist-saved of last 30 days on homepage

## Iteration 4 — Implemented (2026-02-17)
- [x] Trip Planner injects approved partners per destination (`> **Mitra Lokal:**` block with business_name, type, city, WhatsApp) — only shown when partners exist; capped at 5 per destination
- [x] Optional `extra_context` field (max 200 chars) under Interests — adjusts AI tone/priority (e.g. "liburan bareng anak umur 5 tahun"), sanitized server-side, resistant to prompt injection (still limited to DB destinations)
- [x] Character counter UI + hard client cap
- [x] Blockquote (`>`) support in Planner markdown renderer for the Mitra Lokal section visual styling

## Iteration 5 — Redesign Flat Modern + Mobile-First (2026-06-17)
Frontend-only. Neumorphism dihapus total.
- [x] Design token baru (tailwind.config.js + index.css): cream #F5F1E8, surface #FFFDF7, line #DDD6C5, ink #1A1A18, inkSoft #5A5A52, toba #0F3D3E, tobaDeep, brick #C4472B (HANYA tombol aksi utama), moss #8B9D83 (badge/status)
- [x] Utility flat: `.card-flat` (border 1px, radius 12px, shadow halus), `.btn-primary/.btn-dark/.btn-outline/.btn-ghost/.btn-onteal` (min-h 44px, radius 8px), `.input-flat` (border tipis), `.chip/.chip-active`, `.badge-moss`, `.scroll-x`, `.eyebrow`, `.section-title`
- [x] Tipografi: heading Playfair Display (serif), body Manrope; body 15px, min 13px, judul ≥22px di mobile
- [x] Hero teal gelap + teks krem pada Home, Planner, Partners, Directory (Ulos pattern cream/7%)
- [x] Mobile-first: basis 390px, semua form 1 kolom di mobile, chips scroll horizontal, touch target ≥44px, jarak antar elemen ≥8px
- [x] BottomNav baru (`components/BottomNav.jsx`) — Beranda/Destinasi/Mitra/Profil, `md:hidden` (mobile-only), safe-area inset
- [x] Halaman Profil baru `/profile` (`pages/Profile.jsx`) — state guest & login, link Favorit/Trip Plans/Daftar Mitra/Admin, toggle bahasa, logout
- [x] Planner: CTA "Buat Itinerary" sticky di bawah layar pada mobile (`planner-generate-btn-mobile`, di atas bottom nav)
- [x] Performa gambar: semua `<img>` lazy + `decoding=async`; ImageDropzone kompres client-side (resize max 1600px → WebP q0.82) sebelum upload
- [x] Wishlist mendukung deep link `?tab=trips`
- [x] Fix: warning hydration `<span> in <option>` di Directory budget select

## Iteration 6 — Share Itinerary + Reroll Plan + Offline Ringan (2026-06-17)
- [x] **Bagikan Itinerary**: `PATCH /api/itineraries/{id}/share` (owner-only, 403/404/400 tervalidasi) membuat `share_slug` 12-hex; `GET /api/public/itineraries/{slug}` publik tanpa auth (tidak membocorkan user_id); mematikan share → 404
- [x] Halaman publik `/trip/:slug` (`pages/PublicTrip.jsx`) dengan nama pembuat, hari, budget, itinerary ter-render + CTA "Buat rencana Anda sendiri"
- [x] ShareBox di Wishlist: aktifkan/matikan link, copy link, tombol Bagikan ke WhatsApp, badge "Link publik aktif"
- [x] **Acak Ulang (reroll)**: `TripPlanIn.previous_content`; backend mendeteksi destinasi yang sudah dipakai dan menyuruh AI membuat versi berbeda (urutan, kombinasi, tips). Tombol `planner-reroll-btn` / `-mobile` muncul setelah ada output; hasil lama ditimpa
- [x] **Mode Offline Ringan**: `lib/offline.js` (localStorage + savedAt), `OfflineBanner`, service worker `public/sw.js` (cache-first gambar & app shell, `/api/*` tidak di-intercept), cache wishlist + itinerary + detail destinasi + sesi user (AuthContext) → halaman Favorit & detail tetap terbuka offline dengan banner "Mode offline — data terakhir disimpan {waktu}"
- [x] Renderer markdown dipakai bersama (`lib/markdown.jsx`) oleh Planner, Wishlist, PublicTrip
- [x] Fix: axios error tanpa catch (Reviews, wishlist check, PartnerRegister) yang memicu overlay error saat offline

## Iteration 7 — Kartu Preview Share (OG) + Mitra Unggulan Berbayar (Midtrans) (2026-06-17)
- [x] **OG share card**: `GET /api/share/{slug}` mengembalikan HTML meta OG/Twitter (title, description "X hari · Rp budget · Rencana oleh Nama", og:image absolut) lalu redirect ke `/trip/{slug}`; `GET /api/share/{slug}/image.png` men-generate kartu 1200x630 dengan PIL (bg teal, motif ulos, aksen brick, brand). Link bagikan di Wishlist kini memakai `{BACKEND}/api/share/{slug}` + pratinjau kartu.
- [x] **Mitra Unggulan (Midtrans Snap, sandbox aktif)**: koleksi `premium_plans` (seed 1 bulan Rp99k / 3 bulan Rp249k / 12 bulan Rp799k) dengan CRUD admin di tab **Paket Unggulan**; `POST /api/payments/snap-token`, webhook `POST /api/payments/midtrans/notification` (verifikasi SHA512, idempoten via `premium_activated_at`, perpanjang dari `premium_until` bila masih aktif), `GET /api/payments/{order_id}/status`, `GET /api/payments/config`.
- [x] Mitra premium tampil paling atas (section "Mitra Unggulan") dengan badge Unggulan + garis aksen di halaman Mitra dan di daftar mitra pada halaman destinasi; premium kedaluwarsa otomatis dianggap non-premium.
- [x] Env: `MIDTRANS_ENV` (sandbox/production) + kredensial sandbox & production di `backend/.env`.

## Testing
- Iteration 7: backend 18/18 PASS, frontend 100% (share OG, admin plans, dialog premium + snap sandbox nyata, mobile 390px) — `/app/test_reports/iteration_7.json`; isu minor `/api/payments/{order_id}/status` sudah diperbaiki & diverifikasi
- Iteration 6: backend 10/10 PASS; share/public/reroll PASS; bug offline-banner diperbaiki & diverifikasi — `/app/test_reports/iteration_6.json`
- Iteration 5: 100% frontend (13/13 area) di viewport 390x844 + 1920x1080 — `/app/test_reports/iteration_5.json`
- Iteration 1: 100% backend + 100% frontend pass
- Iteration 2: 100% backend + 100% frontend pass
- Iteration 3: 100% backend + 100% frontend pass
- Iteration 4: 100% backend (13/13 pytest) + 100% frontend pass (see `/app/test_reports/iteration_4.json`)

## Backlog (P1/P2)
- P1: Batak Ulos motif SVG background pattern in footer/empty states
- P1: Multi-image upload via object storage (currently URL-only in admin)
- P2: Rating & user reviews per destination
- P2: Geo-nearby suggestions on detail page
- P2: Trip planner (multi-day itinerary from wishlist)
- P2: Shareable destination link with OG-image previews
