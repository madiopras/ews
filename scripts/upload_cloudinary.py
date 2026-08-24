#!/usr/bin/env python3
"""
Langkah 4: Upload media lokal ke Cloudinary (paralel + idempoten).

Baca kredensial dari .env, upload setiap file gambar/video di
dataews/assets/{images,videos} menggunakan public_id = nama file
(tanpa ekstensi), simpan pemetaan `nama_file -> secure_url` secara
inkremental ke dataews/cloudinary_media.json setelah tiap upload.

Idempoten: file yang sudah ada di mapping dilewati (resume).
Gunakan: python3 -u scripts/upload_cloudinary.py  (log real-time)
"""
import concurrent.futures as cf
import json
import os
import threading

import cloudinary
import cloudinary.uploader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCK = threading.Lock()


def load_env(path):
    env = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


def save_mapping(mapping, mapping_file):
    with LOCK:
        with open(mapping_file, "w", encoding="utf-8") as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)


def upload_one(item, mapping, mapping_file):
    sub, fn, path = item
    public_id = os.path.splitext(fn)[0]
    ext = os.path.splitext(fn)[1].lower()
    resource_type = (
        "video" if ext in (".mp4", ".mov", ".webm", ".avi", ".mkv") else "image"
    )
    try:
        res = cloudinary.uploader.upload(
            path,
            public_id=public_id,
            resource_type=resource_type,
            folder="ews-assets",
            overwrite=False,
        )
        url = res.get("secure_url")
        with LOCK:
            mapping[public_id] = url
        save_mapping(mapping, mapping_file)
        print(f"  [ok] {public_id} -> {url}", flush=True)
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  [ERR] {public_id}: {e}", flush=True)
        return False


def main():
    env = load_env(os.path.join(ROOT, ".env"))
    cloud_name = env.get("CLOUDINARY_CLOUD_NAME") or os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = env.get("CLOUDINARY_API_KEY") or os.getenv("CLOUDINARY_API_KEY")
    api_secret = env.get("CLOUDINARY_API_SECRET") or os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]):
        print("ERROR: kredensial Cloudinary tidak lengkap di .env")
        return 1

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )

    assets_dir = os.path.join(ROOT, env.get("ASSETS_DIR", "dataews/assets"))
    mapping_file = os.path.join(ROOT, "dataews", "cloudinary_media.json")

    mapping = {}
    if os.path.exists(mapping_file):
        with open(mapping_file, "r", encoding="utf-8") as f:
            mapping = json.load(f)

    local_files = {}
    for sub in ("images", "videos"):
        d = os.path.join(assets_dir, sub)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            p = os.path.join(d, fn)
            if os.path.isfile(p):
                local_files[os.path.splitext(fn)[0]] = (sub, fn, p)

    to_upload = [
        item
        for pid, item in local_files.items()
        if pid not in mapping or not mapping.get(pid)
    ]

    print(f"Total file lokal: {len(local_files)} | sudah: "
          f"{len(local_files) - len(to_upload)} | akan di-upload: {len(to_upload)}",
          flush=True)

    ok_count = 0
    workers = min(6, len(to_upload) or 1)
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(upload_one, item, mapping, mapping_file)
                   for item in to_upload]
        for fut in cf.as_completed(futures):
            if fut.result():
                ok_count += 1

    print(f"\nUpload selesai. Baru: {ok_count} | total di mapping: {len(mapping)}",
          flush=True)
    print(f"Mapping: {mapping_file}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())