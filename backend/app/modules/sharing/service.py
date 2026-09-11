import asyncio
import html
import json
import re
from typing import Any

from pydantic import ValidationError

from app.modules.planner.contract import style_label
from app.modules.sharing.exceptions import SharingError
from app.modules.sharing.renderer import build_share_card
from app.shared.planner_result import PlannerStoredResultV2


def request_base_url(headers: Any) -> str:
    proto = headers.get("x-forwarded-proto", "https").split(",")[0].strip().lower()
    if proto not in {"http", "https"}:
        proto = "https"
    host = (
        (headers.get("x-forwarded-host") or headers.get("host") or "localhost")
        .split(",")[0]
        .strip()
    )
    if not re.fullmatch(r"[A-Za-z0-9.-]+(?::[0-9]{1,5})?", host):
        host = "localhost"
    return f"{proto}://{host}"


def _escape(value: str) -> str:
    return html.escape(value, quote=True)


class SharingService:
    def __init__(
        self, repository: Any, public_app_url: str | None, renderer=build_share_card
    ):
        self.repository, self.public_app_url, self.renderer = (
            repository,
            public_app_url,
            renderer,
        )

    async def image(self, slug: str) -> bytes:
        document = await self.repository.public_itinerary(slug)
        if not document:
            raise SharingError(404, "Not found")
        is_en = document.get("lang") == "en"
        language = "en" if is_en else "id"
        subtitle = f"{document['days']} {'days' if is_en else 'hari'}  ·  {style_label(document.get('budget_style'), language)}"
        author = f"{'Plan by' if is_en else 'Rencana oleh'} {document.get('author_name') or 'Anonim'}"
        return await asyncio.to_thread(
            self.renderer, document["title"], subtitle, author
        )

    async def preview(self, slug: str, headers: Any) -> tuple[str, int]:
        document = await self.repository.public_itinerary(slug)
        backend_base = request_base_url(headers)
        public_base = (self.public_app_url or backend_base).rstrip("/")
        target = f"{public_base}/trip/{slug}"
        if not document:
            return (
                f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={_escape(target)}">',
                404,
            )
        is_en = document.get("lang") == "en"
        image = f"{backend_base}/api/share/{slug}/image.png"
        title = str(document["title"])
        summary = ""
        if document.get("result_version") == 2:
            try:
                summary = PlannerStoredResultV2.model_validate(
                    document.get("structured_result")
                ).summary
            except (ValidationError, TypeError):
                pass
        summary = re.sub(r"\s+", " ", summary).strip()
        summary = re.sub(r"[<>`*_#]", "", summary)[:180]
        description = summary or (
            f"{document['days']} {'days' if is_en else 'hari'} · {style_label(document.get('budget_style'), 'en' if is_en else 'id')}"
            f" · {'Plan by' if is_en else 'Rencana oleh'} {document.get('author_name') or 'Anonim'} — Explore Wisata Sumut"
        )
        language, action = (
            ("en", "Open the plan") if is_en else ("id", "Buka rencana ini")
        )
        safe_json_target = json.dumps(target).replace("<", "\\u003c")
        page = f"""<!doctype html>
<html lang="{language}"><head><meta charset="utf-8">
<title>{_escape(title)} — Explore Wisata Sumut</title>
<meta name="description" content="{_escape(description)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Explore Wisata Sumut">
<meta property="og:title" content="{_escape(title)}"><meta property="og:description" content="{_escape(description)}">
<meta property="og:image" content="{_escape(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="{_escape(target)}"><meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{_escape(title)}"><meta name="twitter:description" content="{_escape(description)}"><meta name="twitter:image" content="{_escape(image)}">
<meta http-equiv="refresh" content="0;url={_escape(target)}"><link rel="canonical" href="{_escape(target)}">
<style>body{{background:#0F3D3E;color:#F5F1E8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}a{{color:#F5F1E8}}</style>
</head><body><p>{_escape(title)} — <a href="{_escape(target)}">{action}</a></p>
<script>location.replace({safe_json_target});</script></body></html>"""
        return page, 200
