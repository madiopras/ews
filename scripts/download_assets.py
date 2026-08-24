#!/usr/bin/env python3
"""
Langkah 3: Download media untuk setiap id.

Untuk setiap record di dataews/instagram_destinations.json:
  - gambar  : dari `images[]` + `displayUrl` (dedupe bila displayUrl == images[0])
  - video   : dari `videoUrl`

Penamaan lokal:
  image : {id}_img_dest_001(.jpg|.webp|...)  -> 001, 002, ... untuk >1 gambar
  video : {id}_vid_dest_001(.mp4)

Disimpan di:
  dataews/assets/images/*   (gambar)
  dataews/assets/videos/*   (video)

Idempoten: file yang sudah ada dilewati.
"""
import json
import os
import time
import urllib.parse

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dataews", "instagram_destinations.json")
IMG_DIR = os.path.join(ROOT, "dataews", "assets", "images")
VID_DIR = os.path.join(ROOT, "dataews", "assets", "videos")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}

# Ekstensi fallback bila server tidak mengirim Content-Type yang jelas
EXT_FALLBACK = {".webp": ".webp", ".mp4": ".mp4", ".jpg": ".jpg", ".jpeg": ".jpg"}


def resolve_ext(url: str, content_type: str) -> str:
    """Tentukan ekstensi file dari Content-Type, fallback ke path URL."""
    ct = (content_type or "").lower()
    if "mp4" in ct or "video" in ct:
        return ".mp4"
    if "webp" in ct:
        return ".webp"
    if "png" in ct:
        return ".png"
    if "jpeg" in ct or "jpg" in ct or "image" in ct:
        return ".jpg"
    # fallback: ambil dari query path
    path = urllib.parse.urlparse(url).path.lower()
    for ext, mapped in EXT_FALLBACK.items():
        if path.endswith(ext):
            return mapped
    return ".jpg"


def download(url: str, dest_path: str, kind: str):
    """Download url ke dest_path (lewati bila sudah ada). Return (ok, ext, size)."""
    if os.path.exists(dest_path):
        return True, os.path.splitext(dest_path)[1], os.path.getsize(dest_path)
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=60, stream=True)
            r.raise_for_status()
            content_type = r.headers.get("Content-Type", "")
            ext = resolve_ext(url, content_type)
            final_path = dest_path.rsplit(".", 1)[0] + "." + ext.lstrip(".")

            if os.path.exists(final_path):
                return True, ext, os.path.getsize(final_path)

            os.makedirs(os.path.dirname(final_path), exist_ok=True)
            size = 0
            with open(final_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 16):
                    if chunk:
                        f.write(chunk)
                        size += len(chunk)
            r.close()
            if size == 0:
                os.remove(final_path)
                return False, ext, 0
            return True, ext, size
        except Exception as e:  # noqa: BLE001
            print(f"  [retry {attempt+1}/3] {kind} gagal: {e}")
            time.sleep(2)
    return False, "", 0


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        records = json.load(f)

    os.makedirs(IMG_DIR, exist_ok=True)
    os.makedirs(VID_DIR, exist_ok=True)

    downloaded_ok = 0
    failed = []

    for rec in records:
        rid = rec["id"]
        print(f"\n=== {rid} | {rec.get('name')} ===")

        # ---- GAMBAR ----
        img_urls = list(rec.get("images") or [])
        disp = rec.get("displayUrl")
        if disp and disp not in img_urls:
            img_urls.append(disp)

        img_paths = []
        for idx, url in enumerate(img_urls, 1):
            if not url:
                continue
            # path sementara untuk cek ekstensi; akan dikoreksi oleh resolve_ext
            raw_path = os.path.join(IMG_DIR, f"{rid}_img_dest_{idx:03d}.bin")
            ok, ext, size = download(url, raw_path, "gambar")
            if ok:
                final_path = os.path.join(
                    IMG_DIR, f"{rid}_img_dest_{idx:03d}{ext}"
                )
                if raw_path != final_path and os.path.exists(raw_path):
                    os.replace(raw_path, final_path)
                img_paths.append(final_path)
                downloaded_ok += 1
                print(f"  [img {idx:03d}] {os.path.basename(final_path)} ({size} bytes)")
            else:
                failed.append((rid, url))

        # ---- VIDEO ----
        vid_url = rec.get("videoUrl")
        if vid_url:
            raw_path = os.path.join(VID_DIR, f"{rid}_vid_dest_001.bin")
            ok, ext, size = download(vid_url, raw_path, "video")
            if ok:
                final_path = os.path.join(VID_DIR, f"{rid}_vid_dest_001{ext}")
                if raw_path != final_path and os.path.exists(raw_path):
                    os.replace(raw_path, final_path)
                downloaded_ok += 1
                print(f"  [vid     ] {os.path.basename(final_path)} ({size} bytes)")
            else:
                failed.append((rid, vid_url))

        # simpan pemetaan path lokal ke record (untuk langkah upload)
        rec["_local_media"] = {
            "images": img_paths,
            "video": os.path.join(VID_DIR, f"{rid}_vid_dest_001.mp4")
            if vid_url else None,
        }

    # tulis ulang JSON + metadata media lokal
    with open(SRC, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"\nTotal media ter-download: {downloaded_ok}")
    if failed:
        print(f"GAGAL ({len(failed)}):")
        for rid, url in failed:
            print(f"  {rid}: {url[:120]}")


if __name__ == "__main__":
    main()