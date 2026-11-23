"""Pure North Sumatra geographic mapping and Tiket.com API V2 / MiniApp rules."""

from __future__ import annotations

import re
from typing import Any, Literal, Sequence
from urllib.parse import quote, urlencode, urlparse

from app.modules.affiliates.exceptions import AffiliateError
from app.modules.planner.geo import classify_sumut_zone

TIKET_API_BASE_URLS: dict[str, str] = {
    "sandbox": "https://api.tiketsandbox.net",
    "production": "https://api.tiket.com",
}

TIKET_MINIAPP_BASE_URLS: dict[str, str] = {
    "sandbox": "https://aff.tiketsandbox.net",
    "production": "https://aff.tiket.com",
}

DEFAULT_ALLOWED_REDIRECT_HOSTS: tuple[str, ...] = (
    "tiket.com",
    "www.tiket.com",
    "m.tiket.com",
    "aff.tiketsandbox.net",
    "aff.tiket.com",
)

SUPPORTED_PRODUCTS: tuple[str, ...] = ("hotel", "flight")
SUPPORTED_SOURCES: tuple[str, ...] = ("planner", "destination", "partners")

SUMUT_ZONE_TARGETS: dict[str, dict[str, str]] = {
    "medan_deli": {
        "airport_code": "KNO",
        "airport_name_id": "Bandara Internasional Kualanamu (KNO)",
        "airport_name_en": "Kualanamu International Airport (KNO)",
        "hotel_area_id": "Medan & Deli Serdang",
        "hotel_area_en": "Medan & Deli Serdang",
        "hotel_slug": "medan",
    },
    "karo_berastagi": {
        "airport_code": "KNO",
        "airport_name_id": "Bandara Kualanamu (KNO) menuju Berastagi",
        "airport_name_en": "Kualanamu Airport (KNO) for Berastagi",
        "hotel_area_id": "Berastagi & Tanah Karo",
        "hotel_area_en": "Berastagi & Karo Highlands",
        "hotel_slug": "berastagi",
    },
    "toba_samosir": {
        "airport_code": "DTB",
        "airport_name_id": "Bandara Silangit (DTB) — gerbang Danau Toba",
        "airport_name_en": "Silangit Airport (DTB) — Lake Toba gateway",
        "hotel_area_id": "Danau Toba, Parapat & Samosir",
        "hotel_area_en": "Lake Toba, Parapat & Samosir",
        "hotel_slug": "danau-toba",
    },
    "langkat_bukit_lawang": {
        "airport_code": "KNO",
        "airport_name_id": "Bandara Kualanamu (KNO) menuju Bukit Lawang",
        "airport_name_en": "Kualanamu Airport (KNO) for Bukit Lawang",
        "hotel_area_id": "Bukit Lawang, Tangkahan & Langkat",
        "hotel_area_en": "Bukit Lawang, Tangkahan & Langkat",
        "hotel_slug": "langkat",
    },
    "tapanuli_sibolga": {
        "airport_code": "FLZ",
        "airport_name_id": "Bandara Ferdinand Lumban Tobing (FLZ) / Silangit (DTB)",
        "airport_name_en": "Ferdinand Lumban Tobing Airport (FLZ) / Silangit (DTB)",
        "hotel_area_id": "Sibolga & Tapanuli Tengah",
        "hotel_area_en": "Sibolga & Central Tapanuli",
        "hotel_slug": "sibolga",
    },
    "asahan_pantai_timur": {
        "airport_code": "KNO",
        "airport_name_id": "Bandara Kualanamu (KNO)",
        "airport_name_en": "Kualanamu Airport (KNO)",
        "hotel_area_id": "Pematangsiantar & Kisaran",
        "hotel_area_en": "Pematangsiantar & Kisaran",
        "hotel_slug": "pematangsiantar",
    },
    "nias": {
        "airport_code": "GNS",
        "airport_name_id": "Bandara Binaka Gunungsitoli (GNS)",
        "airport_name_en": "Binaka Gunungsitoli Airport (GNS)",
        "hotel_area_id": "Gunungsitoli & Pulau Nias",
        "hotel_area_en": "Gunungsitoli & Nias Island",
        "hotel_slug": "nias",
    },
    "sumut_lainnya": {
        "airport_code": "KNO",
        "airport_name_id": "Bandara Internasional Kualanamu (KNO)",
        "airport_name_en": "Kualanamu International Airport (KNO)",
        "hotel_area_id": "Sumatera Utara",
        "hotel_area_en": "North Sumatra",
        "hotel_slug": "medan",
    },
}

_STARTING_POINT_ZONE: dict[str, str] = {
    "kualanamu": "medan_deli",
    "medan": "medan_deli",
    "silangit": "toba_samosir",
    "parapat": "toba_samosir",
}

_HOST_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]+)+$")
_SLUG_SAFE = re.compile(r"[^a-z0-9_-]+")


def disclosure_copy(lang: Literal["id", "en"]) -> str:
    if lang == "en":
        return "Partner link · Booking and pricing are processed on tiket.com"
    return "Tautan partner · Pemesanan & harga diproses langsung di tiket.com"


def api_base_url(environment: str) -> str:
    return TIKET_API_BASE_URLS.get(environment, TIKET_API_BASE_URLS["sandbox"])


def miniapp_base_url(environment: str, custom_production_url: str = "") -> str:
    if environment == "production" and custom_production_url.strip():
        return custom_production_url.strip().rstrip("/")
    return TIKET_MINIAPP_BASE_URLS.get(environment, TIKET_MINIAPP_BASE_URLS["sandbox"])


def normalize_zone(zone: str | None) -> str:
    cleaned = (zone or "").strip().lower()
    if cleaned in SUMUT_ZONE_TARGETS:
        return cleaned
    return "medan_deli"


def resolve_primary_zone(
    *,
    zones: Sequence[str] = (),
    destination_docs: Sequence[dict[str, Any]] = (),
    starting_point: str | None = None,
) -> str:
    for candidate in zones:
        cleaned = (candidate or "").strip().lower()
        if cleaned in SUMUT_ZONE_TARGETS and cleaned != "sumut_lainnya":
            return cleaned
    for doc in destination_docs:
        inferred = classify_sumut_zone(
            str(doc.get("location") or ""),
            doc.get("latitude"),
            doc.get("longitude"),
        )
        if inferred in SUMUT_ZONE_TARGETS and inferred != "sumut_lainnya":
            return inferred
    if starting_point:
        mapped = _STARTING_POINT_ZONE.get(starting_point.strip().lower())
        if mapped:
            return mapped
    return "medan_deli"


def build_sub_id(source: str, zone: str, product: str) -> str:
    safe_source = _SLUG_SAFE.sub("", (source or "planner").lower())[:20] or "planner"
    safe_zone = _SLUG_SAFE.sub("", normalize_zone(zone))[:24] or "medan_deli"
    safe_product = _SLUG_SAFE.sub("", (product or "hotel").lower())[:16] or "hotel"
    return f"ews_{safe_source}_{safe_zone}_{safe_product}"


def normalize_allowed_hosts(hosts: Sequence[str] | None) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for raw in list(hosts or ()) or list(DEFAULT_ALLOWED_REDIRECT_HOSTS):
        host = (raw or "").strip().lower()
        if host.startswith("https://") or host.startswith("http://"):
            host = (urlparse(host).hostname or "").lower()
        host = host.rstrip(".")
        if not host or not _HOST_PATTERN.match(host):
            continue
        if host not in seen:
            seen.add(host)
            merged.append(host)
    return merged or list(DEFAULT_ALLOWED_REDIRECT_HOSTS)


def validate_redirect_url(url: str, allowed_hosts: Sequence[str]) -> str:
    candidate = (url or "").strip()
    parsed = urlparse(candidate)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise AffiliateError(400, "Affiliate redirect URL must be a valid HTTPS URL")
    hostname = parsed.hostname.lower()
    allowed = normalize_allowed_hosts(allowed_hosts)
    if not any(hostname == item or hostname.endswith(f".{item}") for item in allowed):
        raise AffiliateError(400, "Affiliate redirect host is not in the allowlist")
    return candidate


def build_tiket_public_product_url(
    *,
    product: str,
    zone: str,
    sub_id: str,
    campaign_url_template: str = "",
    affiliate_id: str = "",
    allowed_hosts: Sequence[str] = DEFAULT_ALLOWED_REDIRECT_HOSTS,
) -> str:
    target = SUMUT_ZONE_TARGETS[normalize_zone(zone)]
    if product == "flight":
        params = urlencode({"d": "CGK", "a": target["airport_code"]})
        base_target = f"https://www.tiket.com/pesawat/cari?{params}"
    elif product == "hotel":
        slug = quote(target["hotel_slug"], safe="-")
        base_target = f"https://www.tiket.com/hotel/indonesia/area-{slug}"
    else:
        raise AffiliateError(400, "Unsupported affiliate product")

    template = (campaign_url_template or "").strip()
    if template:
        rendered = (
            template.replace("{target_url}", quote(base_target, safe=""))
            .replace("{target_url_raw}", base_target)
            .replace("{affiliate_id}", quote((affiliate_id or "").strip(), safe=""))
            .replace("{sub_id}", quote(sub_id, safe=""))
            .replace("{product}", quote(product, safe=""))
            .replace("{zone}", quote(normalize_zone(zone), safe=""))
        )
        return validate_redirect_url(rendered, allowed_hosts)

    query: dict[str, str] = {
        "utm_source": "explorewisatasumut",
        "utm_medium": "partner",
    }
    if affiliate_id.strip():
        query["utm_campaign"] = f"{affiliate_id.strip()}_{sub_id}"
    else:
        query["utm_campaign"] = sub_id
    separator = "&" if "?" in base_target else "?"
    return validate_redirect_url(
        f"{base_target}{separator}{urlencode(query)}", allowed_hosts
    )


def build_miniapp_launch_url(
    *,
    base_url: str,
    partner_slug: str,
    product: str,
    token: str,
    lang: Literal["id", "en"] = "id",
    allowed_hosts: Sequence[str] = DEFAULT_ALLOWED_REDIRECT_HOSTS,
) -> str:
    slug = (partner_slug or "").strip().strip("/")
    if not slug or not re.match(r"^[a-zA-Z0-9_-]{2,80}$", slug):
        raise AffiliateError(400, "Valid Tiket MiniApp partner slug is required")
    if product not in SUPPORTED_PRODUCTS:
        raise AffiliateError(400, "Unsupported Tiket MiniApp product")
    if not (token or "").strip():
        raise AffiliateError(502, "Tiket MiniApp token response was empty")
    locale = "en-US" if lang == "en" else "id-ID"
    origin = base_url.strip().rstrip("/")
    url = f"{origin}/{locale}/miniapps/{slug}/{product}?{urlencode({'token': token.strip()})}"
    return validate_redirect_url(url, allowed_hosts)


def assess_config_readiness(config: dict[str, Any]) -> tuple[bool, list[str]]:
    mode = config.get("mode", "miniapp")
    notes: list[str] = []
    products = config.get("products_enabled") or {}
    if not products.get("hotel", True) and not products.get("flight", True):
        notes.append("Enable at least one vertical (hotel or flight).")

    if mode == "miniapp":
        if not (config.get("partner_identifier") or "").strip():
            notes.append("Partner identifier is required for MiniApp Token API.")
        if not (config.get("partner_slug") or "").strip():
            notes.append("Partner slug is required for MiniApp launch URL.")
        if not config.get("has_miniapp_api_key"):
            notes.append("MiniApp API key (aff-b2b2c-key) is required.")
    elif mode == "direct_api_v2":
        if products.get("hotel", True) and not config.get("has_hotel_v2_auth"):
            notes.append("Hotel API V2 Authorization credential is required.")
        if products.get("flight", True) and not config.get("has_flight_v2_api_key"):
            notes.append("Flight API v2.0 key (Aff-Api-Key) is required.")
    elif mode == "campaign_link":
        if (
            not (config.get("affiliate_id") or "").strip()
            and not (config.get("campaign_url_template") or "").strip()
        ):
            notes.append(
                "Affiliate ID or campaign URL template is recommended for attribution."
            )

    return len(notes) == 0, notes


def build_recommendation_cards(
    *,
    config: dict[str, Any],
    zone: str,
    source: str,
    lang: Literal["id", "en"] = "id",
) -> list[dict[str, Any]]:
    normalized_zone = normalize_zone(zone)
    target = SUMUT_ZONE_TARGETS[normalized_zone]
    products = config.get("products_enabled") or {"hotel": True, "flight": True}
    mode = config.get("mode", "miniapp")
    launch_type = "miniapp_session" if mode == "miniapp" else "redirect"
    disclosure = disclosure_copy(lang)
    cards: list[dict[str, Any]] = []

    if products.get("flight", True):
        sub_id = build_sub_id(source, normalized_zone, "flight")
        airport_code = target["airport_code"]
        airport_name = (
            target["airport_name_en"] if lang == "en" else target["airport_name_id"]
        )
        cards.append(
            {
                "provider": "tiket",
                "product": "flight",
                "zone": normalized_zone,
                "mode": mode,
                "title": (
                    f"Flights to {airport_code}"
                    if lang == "en"
                    else f"Tiket Pesawat ke {airport_code}"
                ),
                "subtitle": airport_name,
                "badge": "Tiket.com · Flight",
                "cta_label": (
                    "Check flights on tiket.com"
                    if lang == "en"
                    else "Cari pesawat di tiket.com"
                ),
                "destination_label": airport_name,
                "airport_code": airport_code,
                "airport_name": airport_name,
                "accommodation_area": None,
                "launch_type": launch_type,
                "go_url": (
                    None
                    if launch_type == "miniapp_session"
                    else f"/api/affiliates/go?{urlencode({'provider': 'tiket', 'product': 'flight', 'zone': normalized_zone, 'source': source, 'lang': lang})}"
                ),
                "sub_id": sub_id,
                "disclosure": disclosure,
            }
        )

    if products.get("hotel", True):
        sub_id = build_sub_id(source, normalized_zone, "hotel")
        area = target["hotel_area_en"] if lang == "en" else target["hotel_area_id"]
        cards.append(
            {
                "provider": "tiket",
                "product": "hotel",
                "zone": normalized_zone,
                "mode": mode,
                "title": (
                    f"Hotels & Homestays in {area}"
                    if lang == "en"
                    else f"Hotel & Homestay di {area}"
                ),
                "subtitle": (
                    "Instant availability for hotels, villas, resorts & homestays"
                    if lang == "en"
                    else "Pilihan hotel, resort, villa & homestay booking instan"
                ),
                "badge": "Tiket.com · Hotel",
                "cta_label": (
                    "Browse stays on tiket.com"
                    if lang == "en"
                    else "Cari penginapan di tiket.com"
                ),
                "destination_label": area,
                "airport_code": None,
                "airport_name": None,
                "accommodation_area": area,
                "launch_type": launch_type,
                "go_url": (
                    None
                    if launch_type == "miniapp_session"
                    else f"/api/affiliates/go?{urlencode({'provider': 'tiket', 'product': 'hotel', 'zone': normalized_zone, 'source': source, 'lang': lang})}"
                ),
                "sub_id": sub_id,
                "disclosure": disclosure,
            }
        )

    return cards
