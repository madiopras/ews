"""Safe public URL normalization shared by API response mappers."""

from __future__ import annotations

from urllib.parse import urlparse


def safe_public_http_url(value: object) -> str:
    """Return only absolute HTTP(S) URLs that are safe to expose publicly."""

    candidate = str(value or "").strip()
    if not candidate:
        return ""
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return candidate


def safe_public_media_url(value: object) -> str:
    """Return a public URL/path while rejecting inline and browser-local data."""

    candidate = str(value or "").strip()
    if not candidate or candidate.lower().startswith(("data:", "blob:", "javascript:")):
        return ""
    if candidate.startswith("/") and not candidate.startswith("//"):
        return candidate[:1000]
    return safe_public_http_url(candidate)[:1000]
