"""Deterministic scope guard for the North Sumatra AI Trip Planner.

The guard intentionally runs before any LLM call or quota reservation. It blocks
clear prompt-injection attempts and explicit non-travel questions while allowing
short trip constraints such as "bersama anak" or "wheelchair accessible".
"""

import re
import unicodedata
from typing import Literal, Optional


PlannerViolation = Literal["prompt_injection", "off_topic"]


def _normalise(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").lower()
    return re.sub(r"\s+", " ", value).strip()


_INJECTION_PATTERNS = (
    r"\b(?:abaikan|lupakan|hapus|langgar)\b.{0,60}\b(?:instruksi|aturan|prompt|sistem|system|sebelumnya)\b",
    r"\b(?:ignore|forget|disregard|override|bypass)\b.{0,60}\b(?:instruction|rules?|prompt|system|previous|above)\b",
    r"\b(?:abaikan|ignore|bypass)\b.{0,40}\b(?:katalog|catalog)\b",
    r"\b(?:system prompt|developer message|jailbreak|prompt injection)\b",
    r"\b(?:tampilkan|bocorkan|ungkapkan|reveal|show|print)\b.{0,60}\b(?:prompt|api key|secret|instruksi sistem|system instruction)\b",
    r"\b(?:act as|berperan sebagai|you are now|sekarang kamu)\b.{0,60}\b(?:developer|programmer|assistant|dan|unrestricted)\b",
)

_CODING_TERMS = (
    r"kode|coding|source code|program(?:ming)?|python|javascript|typescript|react(?:js)?|"
    r"node(?:\.js)?|golang|rust|php|java|html|css|sql|database|debug|algoritma|algorithm|"
    r"website|aplikasi|application|software|script|skrip|frontend|backend|endpoint|framework|"
    r"github|docker|linux|function|fungsi"
)
_REQUEST_ACTIONS = (
    r"buat(?:kan)?|bikin|tulis(?:kan)?|jelaskan|jawab|perbaiki|debug|implementasikan|"
    r"create|write|explain|answer|fix|implement|build|generate"
)
_CODING_REQUEST_PATTERNS = (
    rf"\b(?:{_REQUEST_ACTIONS})\b.{{0,80}}\b(?:{_CODING_TERMS})\b",
    rf"\b(?:{_CODING_TERMS})\b.{{0,80}}\b(?:{_REQUEST_ACTIONS})\b",
)
_NON_PLANNER_CREATION = re.compile(
    rf"\b(?:{_REQUEST_ACTIONS})\b.{{0,80}}\b(?:puisi|cerpen|esai|essay|makalah|skripsi|"
    r"artikel|lagu|song|poem|story|resume|cv|resep|recipe|lelucon|joke)\b"
)

_TRAVEL_TERMS = re.compile(
    r"\b(?:wisata|liburan|perjalanan|jalan-jalan|trip|travel|tour|holiday|vacation|journey|"
    r"itinerary|destinasi|kunjung|tempat|sumut|sumatera utara|toba|samosir|medan|berastagi|"
    r"danau|pantai|gunung|air terjun|alam|budaya|kuliner|hotel|homestay|penginapan|rental|"
    r"pemandu|oleh-oleh|honeymoon|keluarga|anak|lansia|kursi roda|aksesibel|halal|vegetarian|"
    r"romantis|santai|adventure|beach|lake|waterfall|mountain|nature|culture|food|family|"
    r"children|elderly|wheelchair|accessible|accommodation|guide|souvenir)\b"
)

_OFF_TOPIC_TERMS = re.compile(
    rf"\b(?:{_CODING_TERMS}|presiden|politik|pemilu|saham|crypto|kripto|trading|diagnosis|"
    r"obat|penyakit|hukum|pengacara|kontrak hukum|matematika|equation|persamaan|homework|"
    r"tugas sekolah|skripsi|makalah|esai|essay|puisi|cerpen)\b"
)

_GENERAL_QUESTION = re.compile(
    r"^(?:apa|siapa|kapan|mengapa|kenapa|bagaimana|berapa|bisakah|bisa kah|tolong jelaskan|"
    r"terjemahkan|what|who|when|why|how|where|can you|could you|please explain|tell me|translate)\b"
)


def planner_context_violation(value: str) -> Optional[PlannerViolation]:
    """Return a violation code for clear out-of-scope input, otherwise ``None``."""
    text = _normalise(value)
    if not text:
        return None

    if any(re.search(pattern, text) for pattern in _INJECTION_PATTERNS):
        return "prompt_injection"
    if any(re.search(pattern, text) for pattern in _CODING_REQUEST_PATTERNS):
        return "off_topic"
    if _NON_PLANNER_CREATION.search(text):
        return "off_topic"

    has_travel_context = bool(_TRAVEL_TERMS.search(text))
    if _OFF_TOPIC_TERMS.search(text) and not has_travel_context:
        return "off_topic"
    if _GENERAL_QUESTION.search(text) and not has_travel_context:
        return "off_topic"
    if re.search(r"\b(?:hitung|calculate|solve)\b.{0,30}(?:\d|persamaan|equation)", text) and not has_travel_context:
        return "off_topic"
    return None


def planner_scope_message(lang: str) -> str:
    if lang == "en":
        return (
            "AI Trip Planner only helps create North Sumatra travel itineraries. "
            "Please describe your trip duration, travel style, interests, companions, or accessibility needs."
        )
    return (
        "AI Trip Planner hanya membantu membuat itinerary wisata Sumatera Utara. "
        "Silakan ceritakan durasi, gaya perjalanan, minat, teman perjalanan, atau kebutuhan aksesibilitas Anda."
    )
