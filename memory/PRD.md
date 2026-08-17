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
- [x] Admin panel: CRUD form (nama ID/EN, kategori, harga, deskripsi ID/EN, images CSV, lat/lng, featured)
- [x] Bilingual toggle (ID/EN) persisted in localStorage
- [x] Neumorphic design: raised/inset/pressed shadows on Warm Sand (#F3F1EC), Playfair Display + Manrope, Sunset Orange accents
- [x] 5 seed destinations, 1 per category (Danau Toba, Pantai Cermin, Istana Maimun, Tip Top Restaurant, Bukit Lawang)

## Testing
- Iteration 1: 100% backend + 100% frontend pass (see /app/test_reports/iteration_1.json)

## Backlog (P1/P2)
- P1: Batak Ulos motif SVG background pattern in footer/empty states
- P1: Multi-image upload via object storage (currently URL-only in admin)
- P2: Rating & user reviews per destination
- P2: Geo-nearby suggestions on detail page
- P2: Trip planner (multi-day itinerary from wishlist)
- P2: Shareable destination link with OG-image previews
