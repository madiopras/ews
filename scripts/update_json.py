#!/usr/bin/env python3
"""
Langkah 5: Update displayUrl / images / videoUrl dengan URL Cloudinary.

Baca dataews/instagram_destinations.json + dataews/cloudinary_media.json.
Untuk tiap record:
  - images[]   : ganti tiap URL asli dengan URL Cloudinary ({id}_img_dest_00X)
  - displayUrl : ganti dengan URL Cloudinary gambar pertama
  - videoUrl   : ganti dengan URL Cloudinary video ({id}_vid_dest_001)

Kecocokan per-id dijamin karena public_id menyandang id.

Sebelum menulis, buat backup dataews/instagram_destinations.raw.json.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dataews", "instagram_destinations.json")
MAPPING = os.path.join(ROOT, "dataews", "cloudinary_media.json")
RAW = os.path.join(ROOT, "dataews", "instagram_destinations.raw.json")


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        records = json.load(f)
    with open(MAPPING, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    # backup sebelum diubah
    with open(RAW, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    updated = 0
    missing = []
    for rec in records:
        rid = rec["id"]

        def cname(kind, n):
            # kind: img / vid ; n: nomor 001.. ; utk mapping key
            return f"{rid}_{kind}_dest_{n:03d}"

        # ---- GAMBAR ----
        # urutan sama dengan saat download: images[] lalu displayUrl
        orig_imgs = list(rec.get("images") or [])
        disp = rec.get("displayUrl")
        if disp and disp not in orig_imgs:
            orig_imgs.append(disp)

        new_imgs = []
        for n in range(1, len(orig_imgs) + 1):
            key = cname("img", n)
            url = mapping.get(key)
            if url:
                new_imgs.append(url)
            else:
                missing.append((rid, key))
                # fallback: pertahankan URL asli
                new_imgs.append(orig_imgs[n - 1])

        rec["images"] = new_imgs
        if new_imgs:
            rec["displayUrl"] = new_imgs[0]

        # ---- VIDEO ----
        if rec.get("videoUrl"):
            key = cname("vid", 1)
            vurl = mapping.get(key)
            if vurl:
                rec["videoUrl"] = vurl
            else:
                missing.append((rid, key))

        updated += 1

    with open(SRC, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"Updated {updated} record.")
    if missing:
        print(f"Catatan (url tetap asli karena mapping tidak ditemukan): {len(missing)}")
        for rid, key in missing:
            print(f"  {rid}  {key}")
    else:
        print("Semua URL berhasil diganti dengan URL Cloudinary.")

    # verifikasi: tidak ada URL instagram tersisa
    leftover = 0
    for rec in records:
        for u in rec.get("images") or []:
            if "instagram" in u or "fbcdn" in u:
                leftover += 1
        for u in (rec.get("displayUrl"), rec.get("videoUrl")):
            if u and ("instagram" in u or "fbcdn" in u):
                leftover += 1
    print(f"Sisa URL instagram/fbcdn: {leftover}")

    print(f"Backup raw: {RAW}")
    print(f"File final: {SRC}")


if __name__ == "__main__":
    main()