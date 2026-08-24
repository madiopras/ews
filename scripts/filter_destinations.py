#!/usr/bin/env python3
"""
Langkah 1–2: Filter data destinasi (non-duplikat) + tambah ID unik.

Baca dataset_instagram-scraper.json, pilih 25 destinasi wisata yang dikurasi
(unik, bukan iklan), tambahkan field `id` unik (dest_0001..dest_0025),
lalu simpan ke file terpisah: dataews/instagram_destinations.json.

Catatan: file `dataews/destinations.json` yang sudah ada TIDAK disentuh —
file ini adalah dataset EWS terpisah yang sudah dikurasi manual.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dataset_instagram-scraper.json")
OUT = os.path.join(ROOT, "dataews", "instagram_destinations.json")

# ---- Kurasi 25 destinasi. Setiap item:
#   name       : nama tampilan destinasi
#   keywords   : daftar kata kunci (case-insensitive) dicocokkan ke caption/locationName
# ---------------------------------------------------------------------------
DESTINATIONS = [
    {"name": "Air Terjun Sipiso Piso", "keywords": ["sipiso"]},
    {"name": "Air Terjun Sikulikap", "keywords": ["sikulikap"]},
    {"name": "Air Terjun Ponot", "keywords": ["ponot"]},
    {"name": "Panatapan Sibodiala", "keywords": ["sibodiala"]},
    {"name": "Air Terjun Lae Pendaroh", "keywords": ["pendaroh"]},
    {"name": "Deleng Tujuh Dayang", "keywords": ["deleng tujuh", "deleng 7 dayang", "petarum"]},
    {"name": "Gunung Sibayak", "keywords": ["sibayak"]},
    {"name": "Gunung Sibuatan", "keywords": ["sibuatan"]},
    {"name": "Gunung Sinabung", "keywords": ["sinabung"]},
    {"name": "Pemandian Lau Renun", "keywords": ["lau renun"]},
    {"name": "Lau Mentar Canyon", "keywords": ["lau mentar"]},
    {"name": "Goa Ergendang", "keywords": ["ergendang"]},
    {"name": "Pemandian Bah Silulu", "keywords": ["silulu"]},
    {"name": "Sungai Dua Rasa", "keywords": ["dua rasa", "2 rasa"]},
    {"name": "Bukit Botak Sibolangit", "keywords": ["bukit botak"]},
    {"name": "Danau Lau Kawar", "keywords": ["lau kawar"]},
    {"name": "Danau Sidihoni", "keywords": ["sidihoni"]},
    {"name": "Danau Linting", "keywords": ["danau linting", "linting"]},
    {"name": "Bonan Dolok Samosir", "keywords": ["bonan dolok"]},
    {"name": "Siosar Puncak 2000", "keywords": ["siosar"]},
    {"name": "Tangkahan", "keywords": ["tangkahan"]},
    {"name": "Menara Pandang Tele", "keywords": ["menara pandang tele", "menara tele"]},
    {"name": "Kawah Putih Tinggi Raja", "keywords": ["tinggi raja"]},
    {"name": "Sipinsur Geosite", "keywords": ["sipinsur"]},
    {"name": "Kaldera Toba Nomadic Escape", "keywords": ["kaldera toba"]},
    # ------------------------------------------------------------------
    # Batch 2 — 25 destinasi tambahan (dest_0026..dest_0050)
    # ------------------------------------------------------------------
    {"name": "Bukit Lawang", "keywords": ["bukit lawang"]},
    {"name": "Gundaling Berastagi", "keywords": ["gundaling"]},
    {"name": "Kebun Teh Sidamanik", "keywords": ["sidamanik"]},
    {"name": "Kolam Abadi Teroh-teroh", "keywords": ["teroh"]},
    {"name": "Pantai Salbe", "keywords": ["salbe"]},
    {"name": "Taman Simalem Resort", "keywords": ["simalem"]},
    {"name": "Istana Maimun Medan", "keywords": ["istana maimun"]},
    {"name": "Ujung Silalahi", "keywords": ["silalahi"]},
    {"name": "Sibisa Samosir", "keywords": ["sibisa"]},
    {"name": "Siboro Anduhur", "keywords": ["siboro"]},
    {"name": "Aek Sijorni Air Terjun", "keywords": ["aek sijorni"]},
    {"name": "Aritonang Samosir", "keywords": ["aritonang"]},
    {"name": "Pamah Simelir", "keywords": ["pamah simelir"]},
    {"name": "Desa Tongging", "keywords": ["tongging"]},
    {"name": "Juma Lau Sibolangit", "keywords": ["juma lau"]},
    {"name": "Sibea-bea Samosir", "keywords": ["sibea bea"]},
    {"name": "Pemandian Binanga Bolon", "keywords": ["binanga"]},
    {"name": "Pemandian Motung", "keywords": ["motung"]},
    {"name": "Pemandian Air Panas Sipoholon", "keywords": ["sipoholon"]},
    {"name": "Rumah Galuh Karo", "keywords": ["rumah galuh"]},
    {"name": "Air Panas Sopotinjak", "keywords": ["sopotinjak"]},
    {"name": "Arum Jeram Ancol Tebing Tinggi", "keywords": ["tebing"]},
    {"name": "Pemandian Umbul Manigom", "keywords": ["manigom"]},
    {"name": "Batu Maroppa", "keywords": ["maroppa"]},
    {"name": "Hotel Tor Sibohi Sipirok", "keywords": ["tor sibohi"]},
    # ------------------------------------------------------------------
    # Batch 3 — 25 destinasi tambahan (dest_0051..dest_0075)
    # ------------------------------------------------------------------
    {"name": "Pulau Pandang", "keywords": ["pulau pandang"]},
    {"name": "Masjid Agung Sibolga", "keywords": ["masjid agung"]},
    {"name": "Bukit Inspirasi Dolok Sanggul", "keywords": ["bukit inspirasi"]},
    {"name": "Gereja Velangkani", "keywords": ["velangkani"]},
    {"name": "Batu Katak Bahorok", "keywords": ["batu katak"]},
    {"name": "Danau Siais", "keywords": ["danau siais"]},
    {"name": "Air Terjun Silima Lima", "keywords": ["silima lima"]},
    {"name": "Taman Alam Lumbini", "keywords": ["taman alam lumbini"]},
    {"name": "Aek Simata Huting", "keywords": ["aek simata"]},
    {"name": "Penatapan Berastagi", "keywords": ["penatapan"]},
    {"name": "Sawah Lukis Cengkeh Turi", "keywords": ["sawah lukis"]},
    {"name": "Sawah Pematang Johar", "keywords": ["sawah pematang"]},
    {"name": "Aek Manik Sidamanik", "keywords": ["aek manik"]},
    {"name": "Pelabuhan Tiga Raja", "keywords": ["pelabuhan tiga raja"]},
    {"name": "Pantai Sejarah Batu Bara", "keywords": ["pantai sejarah"]},
    {"name": "Bakkara", "keywords": ["bakkara"]},
    {"name": "Bumi Perkemahan Sibolangit", "keywords": ["bumi perkemahan"]},
    {"name": "Air Terjun Saringgana", "keywords": ["saringgana"]},
    {"name": "Tabo Cottage Samosir", "keywords": ["tabo cottage"]},
    {"name": "Puncak Sorik Marapi", "keywords": ["sorik marapi"]},
    {"name": "Pulau Nias", "keywords": ["pulau nias"]},
    {"name": "Bukit Holbung", "keywords": ["holbung"]},
    {"name": "Air Terjun Sigura-gura", "keywords": ["sigura"]},
    {"name": "Lumban Bulbul", "keywords": ["lumban bulbul"]},
    {"name": "Sungai Wampu", "keywords": ["sei wampu"]},
    # ------------------------------------------------------------------
    # Batch 4 — 25 destinasi tambahan (dest_0076..dest_0100)
    # ------------------------------------------------------------------
    {"name": "Pariban Sidebuk Debu", "keywords": ["pariban"]},
    {"name": "Tom's Jungle", "keywords": ["tom's jungle"]},
    {"name": "Alun-Alun Stabat", "keywords": ["alun-alun"]},
    {"name": "Pea FarmHouse", "keywords": ["pea farm"]},
    {"name": "Pulo Batu Pulbat", "keywords": ["pulbat"]},
    {"name": "Mickey Holiday Berastagi", "keywords": ["mickey holiday"]},
    {"name": "KHAS Parapat Hotel", "keywords": ["khas parapat"]},
    {"name": "Air Terjun Simempar", "keywords": ["simempar"]},
    {"name": "Padang Halaban Aek Kuo", "keywords": ["aek kuo"]},
    {"name": "Batu Hoda", "keywords": ["batu hoda"]},
    {"name": "Batu Rongring", "keywords": ["batu rongring"]},
    {"name": "Debang Resort", "keywords": ["debang"]},
    {"name": "Sajjan Heritage Farm", "keywords": ["sajjan"]},
    {"name": "Jembatan Gantung Sicanang", "keywords": ["jembatan gantung"]},
    {"name": "Simpang Doulu Berastagi", "keywords": ["doulu"]},
    {"name": "Sopo Tatea Bulan", "keywords": ["sopo tatea"]},
    {"name": "Pasar 7 Selesai", "keywords": ["pasar 7"]},
    {"name": "Barus", "keywords": ["barus"]},
    {"name": "Masjid Al-Hasanah Pangururan", "keywords": ["al-hasanah"]},
    {"name": "Air Terjun Namo Belanga", "keywords": ["namo belanga"]},
    {"name": "Padang Sidempuan", "keywords": ["padang sidempuan"]},
    {"name": "Pusuk Buhit", "keywords": ["pusuk buhit"]},
    {"name": "Sianjur Mula-mula", "keywords": ["sianjur"]},
    {"name": "Simanindo Batu Passa", "keywords": ["simanindo"]},
    {"name": "Aek Rangat", "keywords": ["aek rangat"]},
]

# Kata kunci iklan/promo yang harus dibuang
NON_DEST = [
    "cititex", "kaos", "sablon", "behel", "dental", "gigi", "scaling",
    "promo", "loker", "driver", "pendaftaran", "foodhallen", "bookcabin",
    "tradisifest", "diabetasol", "laptop", "gadget", "vinfast", "escooter",
    "recruitment", "lowongan",
]


def norm(s: str) -> str:
    """Lowercase + buang emoji (biarkan huruf/angka tersisa untuk pencocokan)."""
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"[\U0001F000-\U0001FFFF]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s


def media_score(x: dict) -> tuple:
    """Skor kekayaan media: (punya video, jumlah gambar, timestamp)."""
    n_img = len(x.get("images") or [])
    n_vid = 1 if x.get("videoUrl") else 0
    ts = x.get("timestamp") or ""
    return (n_vid, n_img, ts)


def find_best(entries, keywords):
    """Dari dataset, pilih satu entri yang cocok keyword & bukan iklan, paling kaya media."""
    best = None
    best_score = None
    for x in entries:
        cap = norm(x.get("caption", ""))
        loc = norm(x.get("locationName", ""))
        if any(k in cap for k in NON_DEST):
            continue
        if not any(k in cap or k in loc for k in keywords):
            continue
        score = media_score(x)
        if best_score is None or score > best_score:
            best_score = score
            best = x
    return best


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    picked = []
    for i, dest in enumerate(DESTINATIONS, 1):
        match = find_best(data, dest["keywords"])
        if match is None:
            print(f"[WARN] Tidak ada entri untuk: {dest['name']}")
            continue
        rec = dict(match)
        rec["id"] = f"dest_{i:04d}"
        rec["name"] = dest["name"]
        picked.append(rec)

    print(f"Terpilih {len(picked)} dari {len(DESTINATIONS)} destinasi target.")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(picked, f, ensure_ascii=False, indent=2)

    print(f"Ditulis ke: {OUT}")
    for r in picked:
        n_img = len(r.get("images") or [])
        n_vid = "Y" if r.get("videoUrl") else "-"
        n_disp = "Y" if r.get("displayUrl") else "-"
        print(f"  {r['id']}  vid={n_vid} disp={n_disp} imgs={n_img}  | {r['name']}")


if __name__ == "__main__":
    main()