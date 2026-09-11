"""Pure upload and object-key policies."""

from pathlib import PurePosixPath

from app.modules.media.exceptions import MediaError

MIME_MAP = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


def safe_object_key(value: str) -> str:
    if not value or "\\" in value or "?" in value or "#" in value:
        raise MediaError(404, "File not found")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise MediaError(404, "File not found")
    return path.as_posix()


def image_type(filename: str | None, content: bytes) -> tuple[str, str]:
    ext = filename.rsplit(".", 1)[-1].lower() if filename and "." in filename else "bin"
    if ext not in MIME_MAP:
        raise MediaError(400, "Only images (jpg, png, gif, webp) allowed")
    signatures = {
        "jpg": content.startswith(b"\xff\xd8\xff"),
        "jpeg": content.startswith(b"\xff\xd8\xff"),
        "png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "gif": content.startswith((b"GIF87a", b"GIF89a")),
        "webp": len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP",
    }
    if not signatures[ext]:
        raise MediaError(400, "Invalid image content")
    return ext, MIME_MAP[ext]
