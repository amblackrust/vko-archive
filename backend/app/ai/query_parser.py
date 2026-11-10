"""Query parser (T4.2): natural-language query → structured filters.

The model is called with `format: <JSON schema>` (Ollama constrains the output), the
result is validated with Pydantic and normalised: unknown document types are dropped,
places are mapped to the canonical term of their synonym group, the period is checked.
Any failure (Ollama down, invalid JSON, timeout) falls back to plain full-text search:
the query text as is, no filters (`source = "fallback"`).
"""

import datetime
import logging
import re

from pydantic import ValidationError

from app.ai import ollama_client, prompts
from app.ai.ollama_client import OllamaUnavailable
from app.config import Settings
from app.schemas.ai import DOC_TYPES, ParsedPeriod, ParsedQuery

logger = logging.getLogger(__name__)

MAX_ITEMS = 8
MAX_ITEM_CHARS = 80
MIN_YEAR = 1700

_KK_LETTERS = re.compile(r"[әғқңөұүһі]", re.IGNORECASE)
_CYRILLIC = re.compile(r"[а-яё]", re.IGNORECASE)
# «1960-х», «1960-е», «1960s», «1960 жылдар…», «1960-жылдары»
_DECADE_RE = re.compile(r"\b(1[7-9]\d0|20[0-2]0)\s*-?\s*(?:х|е|ые|ых|s|'s|жыл\w*)", re.IGNORECASE)

# A document type is applied as a filter only if the query names it: the model tends to
# guess types from context («дед» → personal, «документы» → five types), and a wrong
# type filter hides the right answer. Word stems in ru / kk / en.
_DOC_TYPE_WORDS: dict[str, re.Pattern[str]] = {
    doc_type: re.compile(rf"(?<!\w)(?:{pattern})", re.IGNORECASE)
    for doc_type, pattern in {
        "order": r"приказ|бұйрық|order",
        "protocol": r"протокол|хаттам|minutes|protocol",
        "decision": r"решени|шешім|decision",
        "photo": r"фото|снимк|снимок|фотосурет|photo",
        "drawing": r"чертёж|чертеж|сызба|drawing",
        "map": r"карт[аыуе]\b|карталар|map\b|maps\b",
        "letter": r"письм|хат\b|хаттар|хатт[аы]\b|letter",
        "newspaper": r"газет|newspaper",
        "certificate": r"справк|анықтама|certificate",
        "personal": r"личн\w* документ|личн\w* дел|жеке құжат|personal (?:document|file)",
        "manuscript": r"рукопис|қолжазба|manuscript",
        "audio": r"аудио|звукозапис|audio",
        "video": r"видео|бейнежазба|кинохроник|video|film",
        "report": r"отчёт|отчет|есеп\b|есептер|report",
        "program": r"программ|бағдарлама|programme|program\b",
    }.items()
}

_STRINGS = {"type": "array", "items": {"type": "string"}}

JSON_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "intent": {"type": "string", "enum": ["search", "service", "branch", "site_help", "off_topic"]},
        "doc_types": {"type": "array", "items": {"type": "string", "enum": list(DOC_TYPES)}},
        "places": _STRINGS,
        "period": {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {"from": {"type": ["integer", "null"]}, "to": {"type": ["integer", "null"]}},
                    "required": ["from", "to"],
                },
                {"type": "null"},
            ]
        },
        "topics": _STRINGS,
        "persons": _STRINGS,
        "keywords": _STRINGS,
        "lang": {"type": "string", "enum": ["ru", "kk", "en"]},
    },
    "required": ["intent", "doc_types", "places", "period", "topics", "persons", "keywords", "lang"],
}


def detect_lang(text: str) -> str:
    """kk if Kazakh-specific letters, else ru for Cyrillic, else en."""
    if _KK_LETTERS.search(text):
        return "kk"
    if _CYRILLIC.search(text):
        return "ru"
    return "en"


def _stem(term: str) -> str:
    term = term.lower()
    return term if len(term) < 6 else term[: len(term) - 2]


def normalize_place(place: str, synonym_groups: list[list[str]]) -> str:
    """Canonical (first) term of the synonym group the place belongs to, also for
    inflected forms («Усть-Каменогорска», «Өскемендегі»); otherwise the place as is."""
    value = place.strip()
    lowered = value.lower()
    best: tuple[int, str] | None = None
    for group in synonym_groups:
        if not group:
            continue
        for term in group:
            stem = _stem(term)
            if lowered == term.lower() or (len(stem) >= 4 and lowered.startswith(stem)):
                if best is None or len(stem) > best[0]:
                    best = (len(stem), group[0])
    return best[1] if best else value


def _clean_list(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        value = " ".join(str(value).split())[:MAX_ITEM_CHARS]
        if value and value.lower() not in {v.lower() for v in result}:
            result.append(value)
    return result[:MAX_ITEMS]


def _clean_period(period: ParsedPeriod | None, text: str) -> ParsedPeriod | None:
    max_year = datetime.date.today().year
    start = period.from_ if period else None
    end = period.to if period else None
    if start is None and end is None:
        # The model sometimes drops a decade; a literal «1960-х» in the query is unambiguous.
        match = _DECADE_RE.search(text)
        if not match:
            return None
        start = int(match.group(1))
        end = start + 9
    start = start if start is not None else end
    end = end if end is not None else start
    if start > end:
        start, end = end, start
    if start < MIN_YEAR or end > max_year:
        return None
    return ParsedPeriod(**{"from": start, "to": end})


def named_doc_types(text: str) -> list[str]:
    return [doc_type for doc_type, pattern in _DOC_TYPE_WORDS.items() if pattern.search(text)]


def normalize(parsed: ParsedQuery, text: str, synonym_groups: list[list[str]]) -> ParsedQuery:
    return parsed.model_copy(
        update={
            "doc_types": named_doc_types(text),
            "places": _clean_list([normalize_place(p, synonym_groups) for p in parsed.places]),
            "topics": _clean_list(parsed.topics),
            "persons": _clean_list(parsed.persons),
            "keywords": _clean_list(parsed.keywords),
            "period": _clean_period(parsed.period, text),
            "lang": detect_lang(text),
        }
    )


def fallback(text: str) -> ParsedQuery:
    return ParsedQuery(intent="search", lang=detect_lang(text), source="fallback")


def parse(text: str, settings: Settings, synonym_groups: list[list[str]]) -> ParsedQuery:
    messages = [
        {"role": "system", "content": prompts.PARSER_PROMPT.format(doc_types=", ".join(DOC_TYPES))},
        {"role": "user", "content": text},
    ]
    try:
        raw = ollama_client.chat(messages, settings, fmt=JSON_SCHEMA, timeout=settings.ollama_parser_timeout_seconds)
        parsed = ParsedQuery.model_validate_json(raw)
    except OllamaUnavailable as exc:
        logger.info("Query parser: Ollama unavailable (%s), plain search", exc.reason)
        return fallback(text)
    except ValidationError as exc:
        logger.warning("Query parser: invalid model output (%d errors), plain search", exc.error_count())
        return fallback(text)
    return normalize(parsed.model_copy(update={"source": "llm"}), text, synonym_groups)
