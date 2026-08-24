# Rules Pemetaan Data Destination

Dokumen ini adalah aturan (rules) untuk memetakan data mentah dari
`dataews/instagram_destinations.json` menjadi struktur yang mengikuti template
`dataews/destinations.json`. Hasil akhir disimpan di folder `dataews/import`.

## Tujuan

Menghasilkan file `dataews/import/destinations.json` yang setiap elemennya
mengikuti skema field pada template, dengan isi yang diambil dari data Instagram.

## Struktur Target (mengikuti template)

| Field            | Tipe      | Deskripsi                                  |
|------------------|-----------|--------------------------------------------|
| `_id`            | string    | ID unik destination                        |
| `name`           | string    | Nama dalam Bahasa Indonesia                |
| `name_en`        | string    | Nama dalam Bahasa Inggris (diterjemahkan)  |
| `location`       | string    | Lokasi administratif (kabupaten/provinsi)  |
| `category`       | string    | Kategori/tema destination                  |
| `price`          | number    | Harga tiket (selalu `0`)                   |
| `description`    | string    | Deskripsi menarik (Bahasa Indonesia)       |
| `description_en` | string    | Deskripsi (Bahasa Inggris)                 |
| `images`         | string[]  | URL gambar (deduplikasi, non-lokal)        |
| `video`          | string    | URL video                                  |
| `latitude`       | number    | Koordinat latitude                         |
| `longitude`      | number    | Koordinat longitude                        |
| `featured`       | boolean   | Penanda destination unggulan               |
| `created_at`     | string    | Timestamp (format ISO 8601)                |

## Aturan Pemetaan Field

1. **`_id`**
   - Diambil dari field `id` pada data sumber (`dest_XXXX`).

2. **`name`**
   - Diambil dari field `name` pada data sumber.
   - Jika `name` kosong, fallback ke `locationName`.

3. **`name_en`**
   - Terjemahan bahasa Inggris dari `name`.
   - Terjemahan dilakukan manual/berkamus karena nama adalah proper noun.
   - Untuk nama yang memang sudah dalam bahasa Inggris (mis. `Tom's Jungle`,
     `KHAS Parapat Hotel`), dipertahankan apa adanya.

4. **`location`**
   - Diambil dari `caption` sumber jika memuat informasi lokasi
     (pola "Lokasi:", "Loc:", "📍", "Lokasi :").
   - Jika tidak ada di caption, gunakan `locationName`.
   - Jika keduanya kosong, lakukan pencarian di internet (Nominatim/OpenStreetMap/
     Google Maps) untuk menentukan kabupaten/kota + provinsi.
   - Format akhir: `Nama Tempat, Kabupaten/Kota, Provinsi` bila memungkinkan,
     minimal `Kabupaten, Provinsi`.

5. **`category`**
   - Ditetapkan berdasarkan tema destination. Nilai yang dipakai (mengikuti
     template): `beach`, `nature`, `culture`, `lake`, `mountain`,
     `waterfall`, `hotspring`, `cave`, `viewpoint`, `hotel`, `museum`,
     `culinary`, `camping`, `tea`, `island`.
   - Pemetaan dilakukan per destination berdasarkan jenisnya
     (mis. air terjun -> `waterfall`, gunung -> `mountain`, dll).

6. **`price`**
   - Selalu `0`.

7. **`description`**
   - Dibuat dari `caption` sebagai dasar, ditulis ulang menjadi deskripsi
     menarik dan informatif dalam bahasa Indonesia.
   - Hashtag, mention (`@nama`), kredit video/foto, dan emoji yang tidak
     relevan dihapus.
   - Menyebut daya tarik utama, suasana, dan lokasi bila ada di caption.

8. **`description_en`**
   - Versi bahasa Inggris dari `description`.

9. **`images`**
   - Diambil dari `images` (URL cloudinary, non-lokal) dan `displayUrl`.
   - Lokal media (`_local_media.images`) **diabaikan**.
   - Deduplikasi: pastikan tidak ada URL yang sama.
   - Bila `images` kosong tetapi `displayUrl` ada, gunakan `displayUrl` saja.

10. **`video`**
    - Diambil dari `videoUrl`.
    - Jika `videoUrl` tidak ada, isi `null` (bukan string kosong).

11. **`latitude` / `longitude`**
    - Dicari melalui OpenStreetMap (Nominatim) / Google Maps berdasarkan
      `name` + `location`.
    - Disimpan sebagai angka (number).
    - Jika tidak ditemukan, diisi `null` dan ditandai agar bisa diverifikasi
      manual.

12. **`featured`**
    - Tepat **9** destination bernilai `true`.
    - Dipilih berdasarkan keunggulan/popularitas destination.

13. **`created_at`**
    - Diambil dari `timestamp` sumber.
    - Format dipertahankan sebagai string ISO 8601 (mis.
      `2026-07-13T01:47:04.000Z`).

## Proses Validasi

- Jumlah destination hasil harus sama dengan jumlah sumber (100).
- Tidak boleh ada `_id` duplikat.
- Tidak boleh ada URL duplicate pada `images`.
- Jumlah `featured: true` harus tepat 9.
- Setiap destination wajib memiliki `name`, `name_en`, `location`,
  `category`, `description`, `description_en`, dan `images` (minimal 1).

## Output

- File hasil: `dataews/import/destinations.json`.
- File aturan ini: `dataews/import/rules.md`.