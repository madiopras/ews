# Plan Visual Polish Home dan AI Planner

## Status Dokumen

- Status: **Implementasi selesai; verifikasi otomatis lulus**.
- Tanggal: 12 September 2026.
- Proyek: Explore Wisata Sumut (EWS).
- Area utama: `frontend/`.
- Dokumen sebelumnya: `docsplan/frontend/home-planner-layla-ux-plan.md`.
- Prasyarat: Phase 1–5 pada dokumen sebelumnya telah selesai untuk implementasi dan verifikasi otomatis.
- Verifikasi perangkat nyata: **masih menjadi release gate sebelum production**.

### Ringkasan Implementasi

- Phase A–E telah diterapkan pada Home dan AI Planner.
- Rail inspirasi menggunakan data endpoint trending yang sudah tersedia dan memisahkan item dari section populer.
- Surface semantik, ritme section, card destination, action bar Planner, reduced motion, dan mobile input telah diterapkan.
- Lint, 43 test suite/157 test, production build, serta bundle budget lulus.
- Smoke test pada perangkat nyata tetap perlu dilakukan sebelum rilis production.

## 1. Latar Belakang

Hero Home dan prompt AI Planner telah mempunyai identitas visual baru berupa warna cream, hijau Toba, terracotta, serta motif Ulos yang halus. Tahap berikutnya adalah membawa bahasa visual tersebut ke bagian lain Home dan Planner tanpa menjadikan seluruh card seragam atau terlalu ramai.

Gradient EWS akan digunakan sebagai alat pembentuk hierarki. Gradient tidak diterapkan pada setiap card. Destinasi, mitra, dan hasil itinerary tetap mengutamakan foto, keterbacaan, dan permukaan content yang tenang.

## 2. Tujuan

1. Membuat Home terasa sebagai satu pengalaman editorial yang konsisten dari hero sampai footer.
2. Menggunakan gradient EWS secara selektif pada section yang perlu mendapat perhatian.
3. Menyederhanakan card destinasi agar fotografi menjadi fokus utama.
4. Membuat pengguna mobile memahami bahwa terdapat konten lanjutan di bawah hero.
5. Menambahkan rail inspirasi yang relevan dengan wisata Sumatera Utara.
6. Menyederhanakan perpindahan dari proses Planner menuju hasil itinerary.
7. Mengurangi border dan kepadatan visual yang terasa seperti dashboard.
8. Menambahkan motion yang halus, terukur, dan aksesibel.

## 3. Non-Goals

- Tidak mengubah API atau struktur data backend.
- Tidak mengubah algoritma rekomendasi destinasi dan mitra.
- Tidak memberi gradient pada seluruh card.
- Tidak menambahkan angka perjalanan, rating, testimonial, atau logo media yang tidak mempunyai sumber data nyata.
- Tidak membuat carousel dengan data dummy pada production.
- Tidak menghapus akses AI Planner dari desktop atau CTA destinasi.
- Tidak melakukan redesign halaman admin dan workspace Mitra pada scope ini.
- Tidak menambahkan library animasi atau carousel baru jika kebutuhan dapat dipenuhi oleh CSS dan dependency yang sudah tersedia.

## 4. Prinsip Desain

### 4.1 Hierarki sebelum dekorasi

Warna, shadow, dan motion harus membantu pengguna memahami prioritas konten. Dekorasi tidak boleh mengalahkan judul, foto, lokasi, atau CTA.

### 4.2 Fotografi sebagai fokus destinasi

Card destinasi memakai foto sebagai elemen dominan. Gradient digunakan pada container section, bukan menutupi sebagian besar foto.

### 4.3 Mobile-first

Layout dirancang mulai dari lebar 320–390 px. Desktop memperluas komposisi tanpa mengubah urutan informasi utama.

### 4.4 Progressive disclosure

Planner hanya menampilkan informasi atau pertanyaan yang dibutuhkan pada tahap aktif. Hasil itinerary menjadi fokus setelah generasi selesai.

### 4.5 Motion with purpose

Animasi digunakan untuk memberi konteks perubahan state. Seluruh motion harus menghormati `prefers-reduced-motion`.

## 5. Sistem Permukaan

Gunakan tiga kategori permukaan berikut.

### 5.1 Brand Surface

Penggunaan:

- hero Home;
- banner atau rail inspirasi utama;
- section Mitra lokal;
- section komunitas/kepercayaan;
- state editorial penting.

Karakter:

- gradient cream, sage, dan terracotta tipis;
- motif Ulos beropacity rendah jika ruang cukup;
- teks hijau Toba;
- shadow lembut, bukan border tebal.

Brand surface tidak boleh digunakan berulang pada card-card kecil dalam satu grid.

### 5.2 Content Surface

Penggunaan:

- card destinasi;
- card mitra;
- kategori nonaktif;
- form Planner;
- panel hari itinerary;
- detail dan informasi pendukung.

Karakter:

- cream atau off-white;
- keterbacaan tinggi;
- shadow ringan;
- border hanya jika dibutuhkan untuk pemisahan atau aksesibilitas.

### 5.3 Active Surface

Penggunaan:

- kategori terpilih;
- filter aktif;
- primary CTA;
- langkah Planner aktif;
- badge status penting.

Karakter:

- hijau Toba untuk state pilihan dan navigasi;
- terracotta untuk aksi utama;
- teks dengan kontras minimum yang aman;
- tidak menggunakan kedua warna kuat sekaligus pada satu kontrol kecil.

## 6. Ritme Halaman Home

Urutan dan permukaan yang disarankan:

```text
Navbar menyatu dengan hero
└── Hero AI Planner — Brand Surface

Inspirasi perjalanan — Brand Surface ringan atau cream
└── Horizontal rail foto

Temukan sesuai minat — Content Surface
└── Category chips/cards

Destinasi pilihan — Sage sangat muda
└── Editorial destination grid

Populer saat ini — Cream
└── Horizontal rail pada mobile, grid pada desktop

Mitra lokal perjalanan — Brand Surface
└── Service cards dengan Content Surface

Komunitas dan kepercayaan — Content Surface

Footer — Hijau Toba
```

Ketentuan:

- Perubahan background terjadi pada level section, bukan setiap card.
- Transisi warna antarseksi tetap lembut.
- Jarak vertikal antarsection konsisten.
- Motif Ulos hanya muncul pada area kosong yang cukup luas.
- Tidak lebih dari dua Brand Surface kuat terlihat bersamaan dalam satu viewport desktop.

## 7. Spesifikasi Komponen

### 7.1 Card Destinasi

Tujuan: menjadikan foto, nama, dan lokasi sebagai informasi yang pertama terbaca.

Struktur:

```text
Foto dominan
├── badge editorial/trending jika tersedia
└── tombol simpan sebagai icon action

Konten ringkas
├── nama destinasi
├── lokasi
└── CTA sekunder Rencanakan
```

Ketentuan:

- Gunakan rasio gambar yang konsisten per konteks.
- Home grid menggunakan rasio editorial yang seragam, disarankan `4:3` atau `4:5`.
- Judul maksimal dua baris.
- Lokasi maksimal satu baris dengan ellipsis.
- Seluruh area utama card dapat membuka detail destinasi.
- CTA `Rencanakan` dibuat lebih ringan daripada CTA utama Home.
- Hindari overlay gelap penuh pada gambar.
- Shadow meningkat sedikit saat hover pada perangkat pointer desktop.
- Tidak ada transform hover pada perangkat touch.
- Empty image menggunakan fallback yang sudah tersedia, bukan URL placeholder baru.

### 7.2 Category Rail

- Tetap horizontal-scroll pada mobile.
- Kategori nonaktif menggunakan Content Surface.
- Kategori aktif menggunakan hijau Toba atau inset surface yang jelas.
- Icon dan label tetap terlihat pada lebar 320 px.
- Touch target minimal 44 × 44 px.
- Rail menggunakan snap scrolling dan menyembunyikan scrollbar visual tanpa mematikan scroll.

### 7.3 Rail Inspirasi Perjalanan

Section baru ditempatkan langsung setelah hero.

Tujuan:

- memberi petunjuk visual mengenai jenis perjalanan yang dapat direncanakan;
- memperlihatkan sebagian card berikutnya pada mobile;
- membawa pengguna menuju destinasi atau Planner dengan konteks yang relevan.

Sumber data:

- gunakan data featured/trending yang sudah tersedia;
- jangan menambahkan item production yang tidak mempunyai destinasi aktif;
- deduplikasi destinasi yang juga muncul pada section terdekat jika memungkinkan;
- kegagalan endpoint tidak boleh merusak hero atau composer.

Tema editorial yang dapat dibentuk dari metadata yang tersedia:

- Liburan keluarga;
- Petualangan alam;
- Perjalanan romantis;
- Kuliner Medan;
- Budaya Batak;
- Danau dan pegunungan.

Jika metadata tidak cukup untuk membuat tema secara akurat, gunakan judul destinasi dan kategori asli daripada mengarang klaim.

Perilaku:

- mobile: horizontal rail dengan satu card utama dan potongan card berikutnya;
- tablet: dua sampai tiga card terlihat;
- desktop: rail lebar atau grid editorial sesuai jumlah data;
- foto memakai lazy loading kecuali card pertama yang terlihat;
- card dapat menuju detail destinasi;
- aksi Planner boleh mengirim konteks destinasi menggunakan mekanisme yang sudah ada.

### 7.4 Section Mitra Lokal

- Container section memakai Brand Surface.
- Service cards tetap memakai Content Surface agar icon dan label jelas.
- Gunakan satu CTA utama menuju `/partners`.
- Hindari lima warna berbeda untuk lima jenis layanan.
- Informasi sponsor/premium tetap mengikuti disclosure yang sudah ada.

### 7.5 Section Komunitas dan Kepercayaan

- Gunakan Content Surface dengan angka atau tautan yang sudah dapat diverifikasi.
- Tidak menambahkan logo media atau rating eksternal tanpa integrasi dan izin.
- Kurangi ornament jika section Mitra sebelumnya sudah memakai Brand Surface kuat.

## 8. Above-the-Fold Mobile

Hero mobile harus memperlihatkan petunjuk konten berikutnya.

Target:

- navbar, dua kalimat headline, dan composer tetap terbaca tanpa terasa sempit;
- bagian bawah viewport memperlihatkan judul atau potongan card rail inspirasi;
- gunakan `svh`/`dvh` secara hati-hati untuk browser mobile;
- safe-area atas dan bawah tetap diperhitungkan;
- jangan memaksa tinggi hero yang menyebabkan composer terpotong saat keyboard terbuka.

Pendekatan awal:

- gunakan `min-height` yang responsif, bukan tinggi layar absolut untuk semua perangkat;
- kurangi padding vertikal Home pada lebar kecil;
- uji pada tinggi layar pendek, tidak hanya resolusi lebar;
- pertahankan touch target composer minimal 44 px.

## 9. Penyederhanaan Planner

### 9.1 Saat handoff dari Home diproses

- Jangan tampilkan kembali composer dalam keadaan siap-submit.
- Tampilkan state `Memahami perjalanan Anda…` secepat mungkin.
- Jika prompt lengkap, lanjutkan langsung ke generasi.
- Jika prompt parsial, tampilkan hanya pertanyaan pertama yang belum lengkap.
- Data yang sudah diekstrak tidak ditanyakan kembali.

### 9.2 Saat generasi berlangsung

- Tampilkan progress yang stabil tanpa layout shift besar.
- Gunakan copy progress yang singkat.
- Sediakan pembatalan yang jelas.
- Jangan tampilkan action bar hasil sebelum hasil siap.

### 9.3 Setelah hasil tersedia

- Itinerary menjadi elemen utama halaman.
- Header/form awal boleh diperkecil agar tidak mengambil ruang hasil.
- Kelompokkan `Simpan`, `Ubah preferensi`, dan `Buat ulang` dalam satu action bar.
- Mobile action bar tidak boleh menutupi bottom navigation atau konten itinerary.
- Gunakan sticky/floating action hanya jika aman terhadap keyboard dan safe-area.
- Error dan hasil parsial tetap dapat dibaca.

## 10. Pengurangan Border dan Kepadatan Visual

Aturan:

- Gunakan spacing dan perbedaan surface sebagai pemisah utama.
- Border dipertahankan untuk input, focus state, selected state, error, dan komponen yang membutuhkan batas semantik.
- Card biasa memakai shadow ringan tanpa kombinasi border + shadow yang terlalu kuat.
- Hindari nested card yang masing-masing memiliki border penuh.
- Jangan menghilangkan focus ring.
- Divider tipis diperbolehkan pada daftar atau itinerary panjang.

Audit awal harus mencakup:

- `HomeDestinationCard`;
- category cards;
- service cards Mitra;
- trust/community card;
- `PlannerWizard`;
- result header dan day panels;
- action bar Planner.

## 11. Motion System

Motion yang diperbolehkan:

- typewriter placeholder yang sudah tersedia;
- perubahan navbar Home;
- fade/slide ringan saat section pertama kali terlihat;
- lift kecil pada hover card desktop;
- transisi antarlangkah Planner;
- skeleton/fade-in gambar.

Aturan durasi:

- micro interaction: 150–220 ms;
- card hover: 200–300 ms;
- section reveal: 350–500 ms;
- wizard transition mengikuti timing yang sudah ada kecuali hasil uji menunjukkan terlalu lambat.

Guardrail:

- jangan memakai `transition-all`;
- jangan menganimasikan banyak card secara bersamaan tanpa stagger ringan;
- hindari parallax dan autoplay video;
- nonaktifkan motion dekoratif pada `prefers-reduced-motion: reduce`;
- content tetap tersedia jika `IntersectionObserver` tidak didukung.

## 12. Tipografi dan Copy

- Playfair Display tetap digunakan untuk headline editorial.
- Manrope tetap digunakan untuk body dan kontrol UI.
- Headline section singkat dan konsisten.
- Deskripsi section maksimal dua baris pada desktop jika memungkinkan.
- Label CTA menggunakan kata kerja yang jelas.
- Hindari campuran istilah `trip`, `perjalanan`, dan `itinerary` dalam satu area tanpa kebutuhan.
- Semua copy baru tersedia dalam ID dan EN.
- Nama destinasi dan Mitra tidak diterjemahkan secara otomatis jika terjemahan editorial tidak tersedia.

## 13. Dampak Berkas

Perkiraan berkas utama:

- `frontend/src/pages/Home.jsx`
  - urutan section;
  - rail inspirasi;
  - ritme background;
  - above-the-fold mobile.
- `frontend/src/pages/Planner.jsx`
  - penyederhanaan state processing dan result;
  - action bar hasil.
- `frontend/src/components/HomeDestinationCard.jsx`
  - hierarki foto, konten, dan CTA.
- `frontend/src/components/Planner/PlannerWizard.jsx`
  - progressive disclosure dan pengurangan nested surface.
- `frontend/src/components/Planner/StructuredPlannerResult.jsx`
  - hierarki panel hasil jika diperlukan.
- `frontend/src/components/Planner/TripPromptComposer.jsx`
  - penyesuaian spacing mobile jika hasil viewport audit membutuhkan.
- `frontend/src/components/UlosPattern.jsx`
  - hanya jika dibutuhkan variant pattern yang lebih ringan.
- `frontend/src/index.css`
  - surface tokens, motion utilities, dan responsive adjustments.
- `frontend/tailwind.config.js`
  - semantic color/shadow tokens jika class yang ada belum cukup.
- `frontend/src/lib/i18n.js`
  - heading dan label baru.
- test komponen/page yang relevan.

## 14. Tahapan Implementasi

### Phase A — Surface Tokens dan Section Rhythm — Selesai

- Definisikan Brand, Content, dan Active Surface secara semantik.
- Terapkan pergantian background pada level section Home.
- Kurangi border berlebih tanpa mengubah hierarchy focus/error.
- Pastikan navbar dan hero tetap memakai token yang sama.

### Phase B — Destination Card Polish — Selesai

- Audit `HomeDestinationCard` dan card destinasi lain yang dipakai Home.
- Samakan rasio gambar, tinggi judul, lokasi, dan CTA.
- Buat seluruh card mudah dibuka tanpa nested interactive element yang tidak valid.
- Tambahkan hover hanya untuk pointer desktop.

### Phase C — Inspiration Rail dan Mobile Fold — Selesai

- Bangun rail dari data featured/trending yang ada.
- Deduplikasi card dengan section terdekat.
- Atur ukuran agar card berikutnya terlihat pada mobile.
- Kurangi tinggi/padding hero berdasarkan pengujian beberapa tinggi viewport.
- Tambahkan loading, empty, dan error-safe behavior.

### Phase D — Planner Processing dan Result Focus — Selesai

- Pertahankan auto-process Phase 1.
- Hilangkan kemunculan kembali composer saat handoff sedang diproses.
- Rapikan progress dan layout hasil.
- Gabungkan aksi hasil dalam action bar responsif.
- Pastikan action bar tidak bertabrakan dengan bottom navigation.

### Phase E — Motion dan Accessibility Polish — Selesai

- Terapkan motion hanya pada elemen yang disetujui.
- Tambahkan reduced-motion fallback.
- Audit focus order, aria label, contrast, dan touch target.
- Audit penggunaan border, shadow, serta nested surface.

### Phase F — Verification — Otomatis selesai, perangkat nyata pending

- Jalankan lint, test suite, production build, dan bundle budget.
- Uji visual mobile dan desktop.
- Uji alur Home → Planner lengkap dan parsial.
- Uji ID/EN, keyboard, reduced motion, error, loading, empty state, serta koneksi lambat.

## 15. Test Plan

### Automated

1. Home memakai urutan section yang disepakati.
2. Inspiration rail menggunakan data API yang tersedia dan aman saat data kosong.
3. Destinasi tidak muncul dua kali pada section berdekatan jika deduplikasi berlaku.
4. Card mempunyai accessible name dan tujuan navigasi yang benar.
5. Nested interactive element tidak muncul pada card.
6. Mobile rail mempertahankan class snap/overflow yang diperlukan.
7. Handoff Home tetap diproses tepat satu kali.
8. Prompt parsial tetap menuju pertanyaan yang belum lengkap.
9. Action bar hanya muncul pada state hasil yang sesuai.
10. Bottom navigation tidak tertutup action bar.
11. Reduced motion menonaktifkan reveal dekoratif.
12. Copy baru mempunyai pasangan ID/EN.
13. Tidak ada request baru untuk data dummy atau placeholder.
14. Existing destination, Planner, partner, auth, dan routing tests tetap lulus.

### Manual viewport

- 320 × 568;
- 360 × 640;
- 375 × 667;
- 390 × 844;
- 768 × 1024;
- 1024 × 768;
- 1280 × 800;
- 1440 × 900.

Pada setiap viewport periksa:

- tidak ada horizontal overflow halaman;
- headline dan composer tidak terpotong;
- sedikit konten setelah hero terlihat pada mobile jika tinggi layar memungkinkan;
- rail dapat digulir dengan touch;
- card tidak terlalu sempit;
- label CTA tidak terpotong;
- bottom navigation dan Planner action bar tidak bertabrakan;
- navbar tetap terbaca pada state top dan scrolled.

### Accessibility

- navigasi keyboard mengikuti urutan visual;
- focus ring selalu terlihat;
- icon-only action mempunyai accessible label;
- warna teks memenuhi kontras yang layak;
- screen reader memahami heading hierarchy;
- `prefers-reduced-motion` tidak menjalankan motion dekoratif;
- touch target minimal 44 × 44 px.

## 16. Acceptance Criteria

Plan dinyatakan selesai jika:

- gradient EWS hanya digunakan pada section yang telah ditentukan;
- Home mempunyai ritme background yang jelas tanpa terasa ramai;
- card destinasi mengutamakan foto, nama, dan lokasi;
- inspiration rail memakai data nyata dan bekerja pada mobile serta desktop;
- pengguna mobile mendapat petunjuk konten lanjutan di bawah hero;
- Planner tidak menampilkan composer yang meminta submit kedua saat auto-process;
- itinerary menjadi fokus setelah hasil tersedia;
- action bar Planner tidak menutupi konten atau bottom navigation;
- border berlebih berkurang tanpa mengorbankan focus/error state;
- seluruh motion menghormati reduced motion;
- copy ID/EN lengkap;
- tidak ada regresi pada route, auth, quota, streaming, penyimpanan, dan rekomendasi;
- lint, seluruh test terkait, production build, serta bundle budget lulus;
- smoke test viewport dan perangkat nyata selesai sebelum rilis production.

## 17. Urutan Prioritas

1. Surface tokens dan ritme background antarseksi.
2. Penyederhanaan card destinasi.
3. Inspiration rail dan petunjuk konten di mobile fold.
4. Fokus state proses dan hasil Planner.
5. Motion serta accessibility polish.
6. Verifikasi lintas viewport dan perangkat nyata.

## 18. Risiko dan Mitigasi

### Data rail tidak cukup

Mitigasi: gunakan destination title/category asli, tampilkan lebih sedikit card, dan jangan membuat klaim editorial yang tidak didukung data.

### Hero terlalu pendek pada mobile

Mitigasi: gunakan responsive `min-height`, uji tinggi layar pendek, dan jangan memaksakan seluruh konten berikutnya selalu terlihat.

### Terlalu banyak warna section

Mitigasi: batasi Brand Surface kuat, gunakan sage dengan opacity rendah, dan lakukan screenshot comparison pada desktop.

### Card menjadi nested link/button

Mitigasi: pilih satu primary link area dan tempatkan secondary actions sebagai sibling yang valid secara semantik.

### Motion mengganggu atau menurunkan performa

Mitigasi: animasikan opacity/transform, batasi jumlah elemen, dan sediakan reduced-motion fallback.

### Action bar menutupi hasil Planner

Mitigasi: hitung safe-area dan tinggi bottom navigation, sediakan padding bawah yang sesuai, serta gunakan layout non-floating jika ruang tidak cukup.
