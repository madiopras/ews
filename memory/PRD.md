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
- [x] Multi Image Upload (Emergent Object Storage) — drag-and-drop in admin panel, replaces URL input
- [x] User Reviews — 1-5 stars + comment, requires login, avg rating displayed on detail page
- [x] Batak Ulos SVG pattern backdrop on home categories, home footer, planner hero

## Testing
- Iteration 1: 100% backend + 100% frontend pass
- Iteration 2: 100% backend + 100% frontend pass (see `/app/test_reports/iteration_2.json`)

## Backlog (P1/P2)
- P1: Batak Ulos motif SVG background pattern in footer/empty states
- P1: Multi-image upload via object storage (currently URL-only in admin)
- P2: Rating & user reviews per destination
- P2: Geo-nearby suggestions on detail page
- P2: Trip planner (multi-day itinerary from wishlist)
- P2: Shareable destination link with OG-image previews
