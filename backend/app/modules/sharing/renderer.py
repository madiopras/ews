"""CPU-bound social card rendering, independent from HTTP."""

import io
from typing import Any

FONT_SERIF_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
FONT_SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"


def _wrap(draw: Any, text: str, font: Any, max_width: int, max_lines: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) == max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if (
        len(lines) == max_lines
        and draw.textlength(lines[-1], font=font) > max_width - 40
    ):
        lines[-1] = lines[-1][:-3] + "..."
    return lines


def build_share_card(title: str, subtitle: str, author: str) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    def font(size: int, *candidates: str):
        for candidate in candidates:
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
        return ImageFont.load_default()

    width, height = 1200, 630
    image = Image.new("RGB", (width, height), "#0F3D3E")
    draw = ImageDraw.Draw(image)
    weave = "#1B5658"
    for x in range(-height, width + height, 46):
        draw.line([(x, 0), (x + height, height)], fill=weave, width=2)
    for i in range(0, width + 80, 80):
        center_x, center_y, radius = i, height - 70, 26
        draw.polygon(
            [
                (center_x, center_y - radius),
                (center_x + radius, center_y),
                (center_x, center_y + radius),
                (center_x - radius, center_y),
            ],
            outline=weave,
            width=2,
        )
    draw.rectangle([0, 0, 14, height], fill="#C4472B")
    sans_bold = (
        FONT_SANS_BOLD,
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
    )
    sans = (
        FONT_SANS,
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf",
    )
    serif = (FONT_SERIF_BOLD, "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")
    eyebrow, title_font, meta, brand = (
        font(26, *sans_bold),
        font(76, *serif),
        font(32, *sans),
        font(26, *sans_bold),
    )
    draw.text(
        (80, 82), "AI TRIP PLANNER  ·  SUMATERA UTARA", font=eyebrow, fill="#9FBFB8"
    )
    y = 160
    for line in _wrap(draw, title, title_font, width - 200, 3):
        draw.text((78, y), line, font=title_font, fill="#F5F1E8")
        y += 92
    draw.text((80, min(y + 18, height - 190)), subtitle, font=meta, fill="#DCD5C4")
    if author:
        draw.text((80, min(y + 66, height - 140)), author, font=meta, fill="#8B9D83")
    draw.line([(80, height - 96), (width - 80, height - 96)], fill=weave, width=2)
    draw.text((80, height - 74), "EXPLORE WISATA SUMUT", font=brand, fill="#F5F1E8")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
