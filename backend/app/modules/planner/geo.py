"""Pure North Sumatra geospatial helpers for route-aware AI trip planning."""

from __future__ import annotations

import math
from typing import Any, Literal, Optional, Sequence

StartingPoint = Literal["kualanamu", "medan", "silangit", "parapat", "flexible"]
TravelPace = Literal["relaxed", "balanced", "packed"]

STARTING_POINTS = ("kualanamu", "medan", "silangit", "parapat", "flexible")
TRAVEL_PACES = ("relaxed", "balanced", "packed")

DAY_DISTANCE_WARNING_KM = 150.0

_ZONE_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("nias", ("nias", "gunungsitoli", "teluk dalam", "sorake", "lagundri")),
    (
        "langkat_bukit_lawang",
        ("bukit lawang", "tangkahan", "langkat", "binjai", "bahorok", "stabat"),
    ),
    (
        "karo_berastagi",
        (
            "berastagi",
            "brastagi",
            "karo",
            "kabanjahe",
            "sipiso",
            "tongging",
            "sinabung",
            "sibayak",
            "gundaling",
        ),
    ),
    (
        "toba_samosir",
        (
            "toba",
            "samosir",
            "parapat",
            "tuk-tuk",
            "tuktuk",
            "tomok",
            "pangururan",
            "balige",
            "silangit",
            "holbung",
            "sibeabea",
            "kaldera",
            "humbang",
            "simanindo",
            "tarutung",
            "simalungun",
            "dairi",
            "sidikalang",
        ),
    ),
    (
        "medan_deli",
        (
            "medan",
            "kualanamu",
            "deli serdang",
            "deliserdang",
            "serdang bedagai",
            "tebing tinggi",
            "perbaungan",
            "pantai cermin",
            "lubuk pakam",
        ),
    ),
    (
        "tapanuli_sibolga",
        (
            "sibolga",
            "tapanuli",
            "padang sidimpuan",
            "padangsidimpuan",
            "mandailing",
            "barus",
            "pandan",
            "mursala",
            "sipirok",
            "penyabungan",
        ),
    ),
    (
        "asahan_pantai_timur",
        (
            "asahan",
            "kisaran",
            "tanjung balai",
            "tanjungbalai",
            "batu bara",
            "batubara",
            "labuhanbatu",
            "pematangsiantar",
            "siantar",
            "rantauprapat",
        ),
    ),
)


def _finite_coord(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in kilometers between two WGS84 points."""
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    return 2.0 * radius_km * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def classify_sumut_zone(
    location: str,
    latitude: Any = None,
    longitude: Any = None,
) -> str:
    """Classify a North Sumatra destination into a coarse geographic routing zone."""
    loc = (location or "").lower()
    for zone, keywords in _ZONE_KEYWORDS:
        if any(keyword in loc for keyword in keywords):
            return zone

    lat = _finite_coord(latitude)
    lng = _finite_coord(longitude)
    if lat is None or lng is None:
        return "sumut_lainnya"

    if lng < 98.1 and lat < 1.8:
        return "nias"
    if lat >= 3.35 and lng <= 98.55:
        return "langkat_bukit_lawang"
    if 2.88 <= lat <= 3.35 and 98.15 <= lng <= 98.75:
        return "karo_berastagi"
    if 2.15 <= lat <= 2.95 and 98.4 <= lng <= 99.25:
        return "toba_samosir"
    if lat >= 3.2 and lng > 98.55:
        return "medan_deli"
    if lat < 2.15 and lng >= 98.1:
        return "tapanuli_sibolga"
    return "sumut_lainnya"


def sumut_geo_prompt_rules(lang: Literal["id", "en"]) -> str:
    if lang == "en":
        return (
            "Respect North Sumatra geography using each catalog item's zone, lat, and lng. "
            "Group stops within the same day inside the same or adjacent zone to avoid unrealistic backtracking. "
            "Typical road travel times: Medan-Berastagi ~2.5h, Medan-Parapat ~4h, Parapat-Samosir ~1h with ferry, "
            "Medan-Bukit Lawang ~3.5h. Nias is an offshore island requiring a flight or ferry; do not combine Nias "
            "with mainland zones in trips of 3 days or fewer unless explicitly requested."
        )
    return (
        "Perhatikan geografi Sumatera Utara berdasarkan field zone, lat, dan lng pada katalog. "
        "Kelompokkan stop dalam satu hari pada zona yang sama atau berdekatan agar rute tidak zigzag. "
        "Estimasi tempuh darat: Medan-Berastagi ~2,5 jam, Medan-Parapat ~4 jam, Parapat-Samosir ~1 jam termasuk ferry, "
        "Medan-Bukit Lawang ~3,5 jam. Nias berada di pulau terpisah (butuh pesawat/kapal); jangan gabungkan Nias "
        "dengan daratan Sumut untuk trip 3 hari atau kurang kecuali diminta eksplisit oleh user."
    )


def starting_point_instruction(
    starting_point: Optional[StartingPoint], lang: Literal["id", "en"]
) -> str:
    if not starting_point or starting_point == "flexible":
        return ""
    copy = {
        "kualanamu": {
            "id": "Titik mulai: Bandara Kualanamu (KNO). Susun Hari 1 dari arah Kualanamu/Medan/Berastagi atau menuju Danau Toba via tol dengan waktu tempuh realistis.",
            "en": "Starting hub: Kualanamu International Airport (KNO). Begin Day 1 realistically from Kualanamu/Medan/Berastagi or toward Lake Toba via toll road.",
        },
        "medan": {
            "id": "Titik mulai: Kota Medan. Mulai Hari 1 dari area Medan atau berangkat pagi menuju zona sekitar (Berastagi, Bukit Lawang, atau Danau Toba).",
            "en": "Starting hub: Medan city. Start Day 1 in Medan or depart in the morning toward nearby zones (Berastagi, Bukit Lawang, or Lake Toba).",
        },
        "silangit": {
            "id": "Titik mulai: Bandara Silangit (DTB). Prioritaskan kawasan Danau Toba, Balige, dan Samosir sejak Hari 1 karena jaraknya paling dekat.",
            "en": "Starting hub: Silangit Airport (DTB). Prioritize Lake Toba, Balige, and Samosir from Day 1 as the closest hubs.",
        },
        "parapat": {
            "id": "Titik mulai: Parapat / Danau Toba. Mulai eksplorasi dari tepi Danau Toba atau menyeberang ke Pulau Samosir.",
            "en": "Starting hub: Parapat / Lake Toba. Begin around the Lake Toba shore or cross directly to Samosir Island.",
        },
    }
    return copy[starting_point]["en" if lang == "en" else "id"]


def travel_pace_instruction(
    pace: Optional[TravelPace], lang: Literal["id", "en"]
) -> str:
    if not pace:
        return ""
    copy = {
        "relaxed": {
            "id": "Tempo santai: 2-3 stop utama per hari dengan jeda istirahat longgar.",
            "en": "Relaxed pace: 2-3 key stops per day with generous downtime.",
        },
        "balanced": {
            "id": "Tempo seimbang: 3-4 stop per hari yang memadukan eksplorasi dan waktu tempuh nyaman.",
            "en": "Balanced pace: 3-4 stops per day balancing exploration and comfortable transit.",
        },
        "packed": {
            "id": "Tempo padat: 4-6 stop per hari yang tetap berada di zona berdekatan.",
            "en": "Packed pace: 4-6 stops per day kept within nearby zones.",
        },
    }
    return copy[pace]["en" if lang == "en" else "id"]


def analyze_itinerary_route(
    days: Sequence[Any],
    destinations_by_id: dict[str, dict],
    lang: Literal["id", "en"] = "id",
) -> tuple[int, list[str]]:
    """Inspect daily stop transitions and emit safe logistics notes for extreme jumps."""
    anomaly_count = 0
    notes: list[str] = []

    for day in days:
        coords: list[tuple[float, float]] = []
        zones: list[str] = []
        for stop in day.stops:
            doc = destinations_by_id.get(stop.destination_id)
            if not doc:
                continue
            lat = _finite_coord(doc.get("latitude"))
            lng = _finite_coord(doc.get("longitude"))
            zone = classify_sumut_zone(str(doc.get("location") or ""), lat, lng)
            if zone not in zones:
                zones.append(zone)
            if lat is not None and lng is not None:
                coords.append((lat, lng))

        day_km = sum(
            haversine_km(lat1, lng1, lat2, lng2)
            for (lat1, lng1), (lat2, lng2) in zip(coords, coords[1:])
        )
        crosses_nias = "nias" in zones and len(zones) > 1
        if crosses_nias:
            anomaly_count += 1
            notes.append(
                (
                    f"Day {day.day} combines Nias with mainland North Sumatra; allow a flight or ferry transfer day."
                    if lang == "en"
                    else f"Hari {day.day} menggabungkan Nias dengan daratan Sumut; siapkan jadwal penerbangan atau kapal penyeberangan terpisah."
                )
            )
        elif day_km > DAY_DISTANCE_WARNING_KM:
            anomaly_count += 1
            rounded = int(round(day_km))
            notes.append(
                (
                    f"Day {day.day} spans roughly {rounded} km straight-line; start early and account for North Sumatra road travel times."
                    if lang == "en"
                    else f"Hari {day.day} mencakup perpindahan jauh (sekitar {rounded} km garis lurus); berangkat lebih pagi dan perhitungkan waktu tempuh darat di Sumut."
                )
            )

    return anomaly_count, notes
