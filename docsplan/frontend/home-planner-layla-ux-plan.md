# Plan Penyegaran UX Home dan AI Planner

## Status Dokumen

- Status: **Phase 1–5 selesai; smoke test visual pada Safari/iPhone fisik tetap direkomendasikan sebelum rilis**.
- Tanggal: 12 September 2026.
- Proyek: Explore Wisata Sumut (EWS).
- Area utama: `frontend/`.
- Referensi arah visual: komposisi hero dan prompt composer Layla.ai, disesuaikan dengan identitas EWS.
- Prinsip: mengambil pola interaksi dan hierarki visual, bukan menyalin merek, warna, konten, atau elemen kepercayaan milik Layla.ai.

## 1. Latar Belakang

Home akan menjadi pintu masuk utama untuk menyusun perjalanan Sumatera Utara dengan AI. Pengguna cukup menceritakan rencana perjalanan satu kali di Home. Setelah menekan tombol utama, Planner harus langsung memproses cerita tersebut tanpa meminta pengguna menekan tombol kirim kedua kali.

Tampilan menggunakan karakter EWS: cream, hijau Toba, terracotta, dan motif Ulos tipis. Pencarian destinasi biasa tidak lagi muncul di Home dan tetap tersedia melalui halaman Destinasi/Jelajahi.

## 2. Keputusan Produk yang Sudah Disepakati

1. Banner Planner lama dan pencarian destinasi di Home dihapus.
2. Home menggunakan satu prompt composer besar seperti pola Layla.ai.
3. Composer tidak mempunyai fitur atau ikon lampiran file.
4. Composer menyediakan input suara pada browser yang mendukungnya.
5. Prompt dari Home diproses oleh Planner dalam satu kali aksi pengguna.
6. Placeholder Home menggunakan efek mengetik bergantian (`typewriter placeholder`).
7. Hero Home hanya menampilkan dua kalimat utama.
8. Input composer tidak boleh menyebabkan browser mobile melakukan zoom otomatis.
9. Bottom navigation mobile tidak lagi menampilkan AI Planner; posisinya digantikan menu Panduan/Docs.
10. Saat Home masih berada di posisi paling atas, background navbar menyatu dengan background hero. Setelah halaman digulir, navbar berubah menjadi permukaan solid yang tetap mudah dibaca.
11. Menu AI Planner di navigasi desktop tetap tersedia.

## 3. Sasaran

- Menghilangkan submit ganda antara Home dan Planner.
- Menjadikan AI Planner sebagai aksi utama Home tanpa menghilangkan akses katalog destinasi.
- Membuat pengalaman Home dan Planner terasa sebagai satu alur yang berkesinambungan.
- Menjaga tampilan nyaman di layar kecil dan tidak memicu zoom otomatis pada iPhone/Safari.
- Menyederhanakan bottom navigation mobile.
- Menyatukan navbar Home dengan hero sebelum pengguna mulai menggulir.
- Menjaga dukungan bahasa Indonesia dan Inggris serta aksesibilitas keyboard/screen reader.

## 4. Non-Goals

- Tidak mengubah API atau algoritma rekomendasi backend.
- Tidak menambahkan unggahan file pada prompt.
- Tidak menghapus route `/planner`.
- Tidak menghapus tombol Planner dari kartu atau halaman detail destinasi.
- Tidak menghapus AI Planner dari navigasi desktop.
- Tidak memindahkan pencarian destinasi dari halaman `/explore`.
- Tidak menambahkan angka perjalanan, ulasan, Trustpilot, atau logo media yang tidak didukung data nyata.

## 5. Spesifikasi Pengalaman

### 5.1 Hero Home

Hero mempertahankan latar terang EWS dengan motif Ulos beropacity rendah. Konten utama dipusatkan seperti referensi, tetapi memakai tipografi dan warna EWS.

Copy utama terdiri dari tepat dua kalimat:

> Rencanakan perjalananmu dengan AI.
>
> Jelajahi Sumatera Utara dengan lebih bermakna.

Ketentuan:

- Kalimat pertama menggunakan hijau Toba.
- Kalimat kedua menggunakan terracotta.
- Tidak ada paragraf deskripsi ketiga di antara headline dan composer.
- Eyebrow/tagline di atas headline dihapus agar area hero benar-benar hanya memiliki dua kalimat utama sebelum composer.
- Line wrapping boleh menyesuaikan lebar perangkat, tetapi struktur semantiknya tetap dua kalimat.
- Composer ditempatkan langsung di bawah headline dengan jarak yang lapang.

### 5.2 Prompt Composer

Composer yang sama dipakai pada Home dan langkah cerita di Planner agar pengalaman visual konsisten.

Elemen composer:

- textarea multi-line;
- tombol input suara jika browser mendukung;
- tombol `Mulai merencanakan` di Home;
- tombol submit yang sesuai konteks di Planner;
- tanpa tombol atau ikon lampiran;
- tombol utama menggunakan terracotta;
- permukaan composer menggunakan cream/surface dengan bayangan hijau lembut.

Ketentuan input:

- Prompt kosong tidak dapat dikirim.
- Batas karakter tetap mengikuti kontrak Planner saat ini.
- Fokus keyboard mempunyai indikator yang jelas.
- Input suara tidak menjadi persyaratan untuk menggunakan Planner.
- Jika speech recognition tidak didukung, kontrol suara dinonaktifkan atau disembunyikan dengan penjelasan yang dapat diakses.

### 5.3 Typewriter Placeholder

Animated placeholder hanya berjalan ketika input Home masih kosong. Contoh teks Indonesia yang diputar:

1. `Liburan 3 hari bersama keluarga di Danau Toba...`
2. `Perjalanan anniversary yang tenang dan romantis...`
3. `Petualangan alam, kuliner Medan, dan budaya Batak...`

Versi Inggris harus mempunyai contoh setara, bukan terjemahan kata per kata yang terasa kaku.

Perilaku animasi:

- mengetik karakter secara bertahap;
- berhenti sejenak setelah satu contoh selesai;
- menghapus karakter lalu berpindah ke contoh berikutnya;
- berhenti segera setelah pengguna mulai mengetik;
- dapat dimulai kembali ketika input dikosongkan dan tidak sedang difokuskan;
- timer dibersihkan saat komponen dilepas;
- jika `prefers-reduced-motion: reduce` aktif, tampilkan satu placeholder statis tanpa animasi;
- teks placeholder tidak diumumkan berulang-ulang oleh screen reader.

Kecepatan awal yang disarankan:

- ketik: 55–70 ms per karakter;
- jeda kalimat: 1.600–2.000 ms;
- hapus: 30–40 ms per karakter.

Nilai tersebut boleh disesuaikan setelah pengujian visual agar terasa natural dan tidak mengganggu.

### 5.4 Satu Klik dari Home ke Proses Planner

Alur target:

```text
Pengguna menulis prompt di Home
    -> menekan "Mulai merencanakan"
    -> berpindah ke Planner
    -> Planner langsung menampilkan "Memahami perjalanan Anda..."
    -> preferensi diekstrak
        -> informasi cukup: itinerary langsung dibuat
        -> informasi belum cukup: tanyakan hanya data yang masih kurang
```

Pengguna tidak boleh kembali melihat prompt yang sama lalu diwajibkan menekan `Bantu rencanakan` untuk kedua kalinya.

Rancangan handoff:

- Home menyimpan prompt bersama penanda satu kali seperti `autoStart: true` dan ID handoff unik.
- Planner membaca dan menandai handoff sebagai telah dikonsumsi sebelum memulai proses async.
- Planner memanggil fungsi pemrosesan cerita yang sama dengan submit manual; jangan mensimulasikan klik DOM.
- Guard berbasis `useRef`/ID konsumsi mencegah proses ganda akibat React Strict Mode, render ulang, atau efek yang berjalan kembali.
- Setelah dikonsumsi, flag `autoStart` dihapus atau diubah menjadi `consumed` sebelum request dimulai.
- Refresh setelah proses dimulai tidak boleh mengirim request generasi kedua secara otomatis.
- Membuka `/planner` secara langsung tanpa handoff dari Home tetap menampilkan form normal.

Aturan hasil ekstraksi:

- Jika durasi, gaya perjalanan, dan minat berhasil ditangkap, Planner langsung menjalankan generasi itinerary.
- Jika ada data wajib yang belum ditemukan, Planner langsung menuju langkah relevan pertama yang belum lengkap.
- Data yang sudah berhasil ditangkap tidak ditanyakan lagi.
- Jika quota atau autentikasi menghalangi generasi, gunakan gate yang sudah ada dan pertahankan prompt pengguna.
- Jika proses gagal, pertahankan prompt dan tampilkan aksi coba lagi yang aman.

### 5.5 Pencegahan Auto-Zoom pada Mobile

Penyebab utama yang harus diatasi adalah font input di bawah `16px` pada Safari/iOS.

Implementasi:

- textarea composer memakai ukuran font minimal `16px` pada breakpoint mobile;
- aturan diterapkan pada composer Home dan Planner karena keduanya menggunakan komponen yang sama;
- tinggi baris tetap cukup lapang;
- tidak menambahkan `maximum-scale=1` atau `user-scalable=no` pada meta viewport;
- pinch-to-zoom pengguna tetap diizinkan untuk aksesibilitas.

Acceptance check dilakukan pada Safari iOS atau emulasi/perangkat nyata: memfokuskan textarea tidak mengubah skala viewport.

### 5.6 Bottom Navigation Mobile

Susunan target:

1. Beranda
2. Destinasi
3. Panduan
4. Mitra
5. Profil

Perubahan:

- hapus item `/planner` dari `BottomNav`;
- tambahkan item `/docs` dengan ikon buku/panduan;
- label mengambil `t.nav.docs` agar menjadi `Panduan` dalam bahasa Indonesia dan `Guide` dalam bahasa Inggris;
- sediakan `data-testid="bottomnav-docs"`;
- status aktif memakai mekanisme `NavLink` yang sama dengan menu lain;
- akses Planner pada mobile tetap tersedia melalui composer Home dan CTA pada destinasi.

### 5.7 Navbar Home yang Menyatu dengan Hero

Navbar mempunyai dua state visual:

#### State awal: Home belum digulir

- Berlaku hanya pada route `/`.
- Background menggunakan token/warna permukaan yang sama dengan bagian paling atas hero Home.
- Border bawah dan bayangan dihilangkan.
- Logo, menu, pemilih bahasa, dan akun tetap mempunyai kontras yang cukup.

#### State setelah scroll

- Aktif setelah `window.scrollY` melewati ambang kecil, disarankan 12–20 px.
- Background berubah menjadi cream hampir solid dengan backdrop blur.
- Border bawah atau bayangan tipis muncul untuk memisahkan navbar dari konten.
- Transisi hanya menganimasikan background, border, dan shadow; jangan memakai `transition-all`.

#### Route selain Home

- Navbar langsung menggunakan state solid seperti saat ini.
- Perpindahan route harus mereset perhitungan state tanpa kedipan warna yang salah.
- Listener scroll menggunakan mode pasif dan dibersihkan saat komponen dilepas.
- Warna awal Home dan hero menggunakan token/class bersama agar tidak terlihat sebagai dua blok yang berbeda.

## 6. Dampak Berkas

Perkiraan berkas yang akan diubah:

- `frontend/src/pages/Home.jsx`
  - hero dua kalimat;
  - typewriter placeholder;
  - payload handoff auto-start;
  - menghapus copy pendukung yang tidak lagi digunakan.
- `frontend/src/pages/Planner.jsx`
  - konsumsi handoff satu kali;
  - memulai ekstraksi/generasi secara otomatis;
  - menjaga state loading, error, quota, dan autentikasi.
- `frontend/src/components/Planner/TripPromptComposer.jsx`
  - font mobile minimal 16px;
  - dukungan animated placeholder;
  - perilaku reduced motion dan input suara.
- `frontend/src/components/Planner/PlannerWizard.jsx`
  - menerima alur auto-start tanpa submit kedua;
  - tetap mendukung submit manual dari `/planner`.
- `frontend/src/components/Navbar.jsx`
  - state route Home/top/scrolled;
  - style background yang menyatu dengan hero.
- `frontend/src/components/BottomNav.jsx`
  - mengganti AI Planner dengan Panduan.
- `frontend/src/lib/i18n.js`
  - dua kalimat headline;
  - placeholder berputar ID/EN;
  - label aksesibilitas terkait.
- `frontend/src/index.css` atau token Tailwind terkait
  - shared home hero/navbar surface jika diperlukan.
- test Home, Planner, Navbar, BottomNav, dan composer yang relevan.

Tidak diperlukan perubahan backend untuk scope ini.

## 7. Tahapan Implementasi

### Phase 1 — Kontrak Handoff dan Auto-Process

Status: **Selesai pada 12 September 2026**.

- [x] Pisahkan format draft/handoff Planner ke utilitas bersama agar Home dan Planner tidak menduplikasi string key/schema.
- [x] Tambahkan `autoStart` dan ID handoff unik.
- [x] Buat fungsi Planner yang dapat digunakan oleh submit manual maupun auto-start.
- [x] Konsumsi handoff tepat satu kali.
- [x] Prompt lengkap langsung memulai generasi; prompt parsial membuka langkah wajib pertama yang belum lengkap.
- [x] Pertahankan guard quota, autentikasi, error, direct visit, refresh, dan React Strict Mode yang sudah ada.
- [x] Tambahkan unit test kontrak draft serta integration test auto-start.

### Phase 2 — Hero dan Animated Placeholder

Status: **Selesai pada 12 September 2026**.

- [x] Tetapkan hero hanya dengan dua kalimat utama.
- [x] Hapus eyebrow dan paragraf deskripsi hero.
- [x] Implementasikan typewriter placeholder ID/EN.
- [x] Hormati `prefers-reduced-motion`.
- [x] Hentikan animasi saat input difokuskan atau pengguna mulai mengetik.
- [x] Pertahankan placeholder aksesibel sebagai label statis bagi screen reader.
- [x] Tambahkan pengujian animasi, focus pause, input pengguna, dan reduced motion.

### Phase 3 — Perbaikan Mobile

Status: **Selesai pada 12 September 2026**.

- [x] Tetapkan font composer dan animated placeholder sebesar 16px.
- [x] Verifikasi hasil CSS produksi memakai `1rem` untuk input composer sehingga tidak memicu kebiasaan auto-zoom Safari pada input di bawah 16px.
- [x] Pertahankan pinch-to-zoom; tidak menambahkan `maximum-scale` atau `user-scalable=no`.
- [x] Ganti item AI Planner pada bottom navigation dengan Panduan.
- [x] Susun menu menjadi Beranda, Destinasi, Panduan, Mitra, dan Profil.
- [x] Verifikasi build menghasilkan grid lima kolom dan menyembunyikan bottom navigation mulai breakpoint desktop.

### Phase 4 — Navbar Home

Status: **Selesai pada 12 September 2026**.

- [x] Buat state Home/top/scrolled berbasis route dan posisi scroll dengan ambang 16px.
- [x] Gunakan class surface bersama untuk background hero dan navbar Home.
- [x] Hilangkan border/bayangan pada posisi paling atas.
- [x] Gunakan navbar cream solid, border, shadow, dan backdrop blur setelah scroll.
- [x] Batasi transisi pada background, border, shadow, dan backdrop filter.
- [x] Pastikan route lain selalu memakai navbar solid.
- [x] Tambahkan test untuk scroll turun, kembali ke atas, dan route non-Home.

### Phase 5 — Verifikasi dan Polish

Status: **Selesai untuk automated/static verification pada 12 September 2026**.

- [x] ESLint lulus tanpa error atau warning.
- [x] Seluruh 43 test suite frontend lulus: 156 test.
- [x] Production build berhasil.
- [x] Performance budget lulus: initial/main JavaScript 150,5 KiB gzip.
- [x] Verifikasi kontrak CSS produksi: input 16px, grid lima kolom, breakpoint desktop, reduced motion, dan shared hero surface tersedia.
- [x] Verifikasi ID/EN melalui test i18n dan test suite penuh.
- [x] Pastikan tidak ada request suggestions destinasi dari Home.
- [x] Pastikan handoff Planner hanya diproses satu kali dalam React Strict Mode.
- [x] Bersihkan copy pencarian Home yang tidak lagi digunakan.
- [ ] Smoke test visual pada viewport 320, 375, 390, 768, 1024, dan 1440 px menggunakan browser nyata.
- [ ] Konfirmasi fokus textarea pada Safari/iPhone fisik tidak mengubah skala viewport.

Catatan lingkungan verifikasi: container pengembangan tidak menyediakan engine Chrome/Chromium/Firefox atau Playwright/Puppeteer. Kontrak responsif dan pencegahan auto-zoom telah diverifikasi dari test komponen serta CSS produksi, sedangkan dua pemeriksaan perangkat nyata di atas tetap menjadi checklist pra-rilis.

## 8. Test Plan

### Automated tests

1. Home tidak merender form pencarian destinasi.
2. Home merender prompt composer tanpa kontrol lampiran.
3. Submit prompt menyimpan handoff `autoStart` yang valid.
4. Planner mengonsumsi handoff dan memulai pemrosesan tanpa submit kedua.
5. React Strict Mode tidak menghasilkan dua request generasi.
6. Prompt lengkap langsung menuju generasi.
7. Prompt parsial menuju langkah pertama yang masih kurang.
8. Direct visit `/planner` tidak auto-submit.
9. Refresh tidak mengulang auto-submit yang telah dikonsumsi.
10. Typewriter hanya berjalan ketika nilai kosong.
11. Reduced motion menghasilkan placeholder statis.
12. Bottom navigation merender `/docs` dan tidak merender `/planner`.
13. Navbar Home memakai state menyatu di posisi atas dan state solid setelah scroll.
14. Navbar route non-Home selalu solid.
15. Terjemahan ID/EN tersedia untuk seluruh copy baru.

### Manual checks

- Ketik prompt pada Home dan tekan tombol sekali; tidak ada tombol kirim kedua sebelum proses dimulai.
- Gunakan contoh prompt lengkap dan tidak lengkap.
- Coba tombol mikrofon pada browser yang mendukung dan tidak mendukung.
- Fokuskan textarea pada iPhone/Safari; viewport tidak zoom otomatis.
- Scroll Home perlahan; perubahan navbar halus dan tidak berkedip.
- Kembali ke posisi paling atas; navbar kembali menyatu dengan hero.
- Buka halaman selain Home; navbar tetap solid.
- Periksa bottom navigation pada lebar 320 px dan safe-area perangkat.

## 9. Acceptance Criteria

Implementasi dianggap selesai ketika:

- pengguna hanya perlu satu kali menekan `Mulai merencanakan` dari Home;
- Planner segera menampilkan status pemrosesan atau pertanyaan lanjutan yang memang dibutuhkan;
- tidak ada generasi ganda dalam satu handoff;
- headline hero hanya berisi dua kalimat yang disepakati;
- animated placeholder berjalan halus, bilingual, dan aman untuk reduced motion;
- composer tidak memiliki ikon lampiran;
- fokus textarea mobile tidak menyebabkan auto-zoom;
- bottom navigation mobile memiliki menu Panduan dan tidak memiliki AI Planner;
- navbar Home menyatu dengan hero sebelum scroll dan menjadi solid setelah scroll;
- pencarian destinasi tidak muncul atau memanggil endpoint suggestion dari Home;
- seluruh test terkait, lint, dan production build lulus.

## 10. Urutan Prioritas

1. Handoff satu klik dan pencegahan request ganda.
2. Pencegahan zoom mobile.
3. Bottom navigation dan state navbar Home.
4. Dua kalimat hero dan animated placeholder.
5. Polish visual, aksesibilitas, dan verifikasi lintas perangkat.
