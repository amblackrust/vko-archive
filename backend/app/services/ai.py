"""Public AI assistant: smart-search parse and the RAG answer (T4.2, T4.4, T4.7).

Flow (PLAN.md §4.1):
    guard (off-topic / injection / service) → query parser → public hybrid search
    → top 8 → [nothing?] «not found» (no LLM) → [only restricted documents?] «restricted»
    (no LLM) → LLM answer over the context → post-check → answer + server-built cards.

All database work happens in `prepare`, before any streaming starts; `answer` / `stream`
only talk to Ollama. Only public objects reach the model: candidates come from
`search.search` (which re-checks every hit against the live object), and documents
whose files are not open get no description in the context, only title, code, date and
access conditions. If Ollama or the model is unavailable the result has
`ai_available = false`, mode `unavailable` and the found cards — never an HTTP error.
"""

import json
import logging
import urllib.parse
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import Session

from app.ai import guards, ollama_client, prompts, query_parser, rag
from app.ai.ollama_client import OllamaUnavailable
from app.config import Settings
from app.models import Branch, Document, Fund
from app.models.enums import FileAccess
from app.repositories import search as search_repo
from app.schemas.ai import (
    AiAnswer,
    AiParseResponse,
    AiRequest,
    AiSource,
    AiStatus,
    AppliedFilters,
    ExternalLink,
    ParsedQuery,
    RouteLink,
)
from app.schemas.search import SearchFilters, SearchItem
from app.services import search as search_service
from app.services import rate_limit, search_log
from app.services.errors import RateLimited
from app.services.indexing import DOC_TYPE_LABELS, strip_html

logger = logging.getLogger(__name__)

EGOV = ExternalLink(id="egov", url="https://egov.kz")
MAX_PERIOD_YEARS = 100

TYPE_WORDS = {
    "document": {"ru": "документ", "kk": "құжат", "en": "document"},
    "fund": {"ru": "фонд", "kk": "қор", "en": "fund"},
    "page": {"ru": "страница сайта", "kk": "сайт беті", "en": "site page"},
    "branch": {"ru": "филиал архива", "kk": "мұрағат филиалы", "en": "archive branch"},
    "exhibition": {"ru": "выставка", "kk": "көрме", "en": "exhibition"},
    "collection": {"ru": "коллекция", "kk": "коллекция", "en": "collection"},
    "news": {"ru": "новость", "kk": "жаңалық", "en": "news"},
    "section": {"ru": "раздел сайта", "kk": "сайт бөлімі", "en": "site section"},
}

ACCESS_WORDS = {
    "open": {"ru": "открытый доступ", "kk": "ашық қолжетімділік", "en": "open access"},
    "restricted": {"ru": "ограниченный доступ", "kk": "шектеулі қолжетімділік", "en": "restricted access"},
    "closed": {"ru": "закрытый доступ", "kk": "жабық қолжетімділік", "en": "closed"},
    "needs_review": {"ru": "доступ уточняется", "kk": "қолжетімділік нақтылануда", "en": "access under review"},
}

# Site sections (frontend routes, see frontend nav-config) the assistant may point to.
SECTIONS: dict[str, tuple[str, dict[str, str]]] = {
    "state_service": (
        "/services/state",
        {"ru": "Государственная услуга", "kk": "Мемлекеттік қызмет", "en": "Public service"},
    ),
    "paid_services": ("/services/paid", {"ru": "Платные услуги", "kk": "Ақылы қызметтер", "en": "Paid services"}),
    "contacts": ("/contacts", {"ru": "Контакты", "kk": "Байланыс", "en": "Contacts"}),
    "branches": ("/branches", {"ru": "Филиалы", "kk": "Филиалдар", "en": "Branches"}),
    "catalog": ("/catalog", {"ru": "Электронный каталог", "kk": "Электрондық каталог", "en": "Catalog"}),
    "reading_room": ("/reading-room", {"ru": "Читальный зал", "kk": "Оқу залы", "en": "Reading room"}),
    "help": ("/help", {"ru": "Помощь", "kk": "Көмек", "en": "Help"}),
}
SECTION_NOTES = {
    "state_service": {
        "ru": "порядок получения архивных справок как госуслуги через eGov.kz; сайт заявлений не принимает",
        "kk": "мұрағаттық анықтаманы eGov.kz арқылы мемлекеттік қызмет ретінде алу тәртібі",
        "en": "how to obtain archival certificates as a public service via eGov.kz",
    },
    "contacts": {"ru": "телефоны, адрес и режим работы архива", "kk": "мұрағаттың телефондары, мекенжайы", "en": "phones and address"},
    "branches": {"ru": "список и карта филиалов архива", "kk": "филиалдар тізімі мен картасы", "en": "list and map of branches"},
    "catalog": {"ru": "поиск по фондам и документам с фильтрами", "kk": "қорлар мен құжаттар бойынша іздеу", "en": "search funds and documents"},
    "reading_room": {"ru": "работа читального зала", "kk": "оқу залының жұмысы", "en": "reading room rules"},
}


def _i18n(value: dict[str, str] | None, lang: str) -> str:
    value = value or {}
    for lng in (lang, "ru", "kk", "en"):
        if value.get(lng):
            return value[lng]
    return ""


def check_rate_limit(settings: Settings, ip: str | None) -> None:
    """Per-IP limit on requests that may start a generation (DoS); 429 with Retry-After."""
    retry_after = rate_limit.ai_limiter.hit(ip or "unknown", settings.ai_rate_limit_per_minute)
    if retry_after is not None:
        raise RateLimited(retry_after)


def status(settings: Settings) -> AiStatus:
    result = ollama_client.availability(settings)
    return AiStatus(ai_available=result.available, reason=result.reason)


# --- parse → filters ------------------------------------------------------------


def _decades(parsed: ParsedQuery) -> list[str]:
    period = parsed.period
    if period is None or period.from_ is None or period.to is None:
        return []
    if period.to - period.from_ > MAX_PERIOD_YEARS:
        return []
    return [f"{decade}s" for decade in range(period.from_ // 10 * 10, period.to + 1, 10)]


def build_filters(parsed: ParsedQuery, text: str) -> AppliedFilters:
    """Search parameters from the parsed query. Places/persons/topics/keywords become the
    full-text query (synonyms are expanded by the search); types and period — filters.
    A fallback parse searches the query text as is."""
    terms = parsed.places + parsed.persons + parsed.topics + parsed.keywords
    if parsed.intent == "branch" and parsed.places:
        # «где филиал в Риддере и как доехать»: the place picks the branch; the rest is noise.
        terms = parsed.places
    q = " ".join(terms) if parsed.source == "llm" and terms else text
    return AppliedFilters(
        q=q,
        types=["branch"] if parsed.intent == "branch" else [],
        doc_type=parsed.doc_types,
        period=_decades(parsed),
        period_range=parsed.period,
        places=parsed.places,
        persons=parsed.persons,
    )


def _resolve_lang(text: str, ui_lang: str | None) -> str:
    if ui_lang and not any(ch.isalpha() for ch in text):
        return ui_lang
    return query_parser.detect_lang(text)


def parse(session: Session, settings: Settings, request: AiRequest) -> AiParseResponse:
    text = " ".join(request.q.split())
    lang = _resolve_lang(text, request.lang)
    guard = guards.check(text)
    available = ollama_client.availability(settings).available
    if guard.verdict != "ok":
        parsed = query_parser.fallback(guard.query or text).model_copy(
            update={"intent": "off_topic" if guard.verdict == "off_topic" else "search", "lang": lang}
        )
    elif available:
        parsed = query_parser.parse(guard.query, settings, search_repo.active_synonym_groups(session))
    else:
        parsed = query_parser.fallback(guard.query)
    if guard.service:
        parsed = parsed.model_copy(update={"intent": "service"})
    return AiParseResponse(
        query=text, lang=lang, ai_available=available, parsed=parsed, filters=build_filters(parsed, guard.query or text)
    )


# --- context ----------------------------------------------------------------------


def _routes(branch: Branch, lang: str) -> list[RouteLink]:
    if branch.lat is not None and branch.lng is not None:
        lat, lng = f"{branch.lat:.6f}", f"{branch.lng:.6f}"
        return [
            RouteLink(provider="2gis", url=f"https://2gis.kz/?m={lng}%2C{lat}%2F17"),
            RouteLink(provider="google", url=f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"),
            RouteLink(provider="yandex", url=f"https://yandex.kz/maps/?rtext=~{lat}%2C{lng}&rtt=auto"),
        ]
    address = _i18n(branch.address, lang)
    if not address:
        return []
    query = urllib.parse.quote(address)
    return [
        RouteLink(provider="2gis", url=f"https://2gis.kz/search/{query}"),
        RouteLink(provider="google", url=f"https://www.google.com/maps/search/?api=1&query={query}"),
        RouteLink(provider="yandex", url=f"https://yandex.kz/maps/?text={query}"),
    ]


def _item(session: Session, ref: str, hit: SearchItem, lang: str) -> rag.ContextItem | None:
    """None if the object vanished since the search (deleted concurrently)."""
    kind = TYPE_WORDS[hit.type].get(lang) or TYPE_WORDS[hit.type]["ru"]
    snippet = rag.shorten(strip_html(hit.snippet))
    source = AiSource(ref=ref, type=hit.type, id=hit.id, title=hit.title, href=hit.href)
    if hit.type == "document":
        document = session.get(Document, hit.id)
        if document is None:
            return None
        access = document.file_access.value
        source = source.model_copy(
            update={
                "archive_code": document.archive_code,
                "date_text": document.date_text,
                "doc_type": document.doc_type,
                "access": access,
                "access_conditions": _i18n(document.access_conditions, lang) or None,
            }
        )
        type_word = (DOC_TYPE_LABELS.get(document.doc_type or "") or {}).get(lang) or ""
        access_text = ACCESS_WORDS.get(access, ACCESS_WORDS["needs_review"])[lang]
        if document.file_access == FileAccess.OPEN:
            description = rag.shorten(strip_html(_i18n(document.summary, lang))) or snippet
            line = rag.field_line(kind, type_word, hit.title, document.archive_code, document.date_text, access_text, description)
        else:
            # Restricted materials: title and access conditions only, no content.
            conditions = source.access_conditions and f"условия доступа: {source.access_conditions}"
            line = rag.field_line(kind, type_word, hit.title, document.archive_code, document.date_text, access_text, conditions)
        return rag.ContextItem(source, line)
    if hit.type == "branch":
        branch = session.get(Branch, hit.id)
        if branch is None:
            return None
        source = source.model_copy(
            update={
                "address": _i18n(branch.address, lang) or None,
                "phone": branch.phone,
                "hours": _i18n(branch.hours, lang) or None,
                "routes": _routes(branch, lang),
            }
        )
        line = rag.field_line(
            kind, hit.title, source.address and f"адрес: {source.address}", branch.phone and f"телефон: {branch.phone}",
            source.hours and f"режим работы: {source.hours}",
            "маршрут: ссылки на 2GIS / Google Maps / Яндекс Карты есть в карточке" if source.routes else None,
        )
        return rag.ContextItem(source, line)
    if hit.type == "fund":
        fund = session.get(Fund, hit.id)
        if fund is None:
            return None
        years = f"{fund.dates_from or '…'}–{fund.dates_to or '…'}" if fund.dates_from or fund.dates_to else None
        line = rag.field_line(kind, hit.title, f"фонд № {fund.number}", years, snippet)
        return rag.ContextItem(source, line, codes=[f"Ф.{fund.number}", f"Фонд № {fund.number}", f"Фонд {fund.number}"])
    return rag.ContextItem(source, rag.field_line(kind, hit.title, snippet))


def _section_item(ref: str, key: str, lang: str) -> rag.ContextItem:
    path, titles = SECTIONS[key]
    title = titles.get(lang) or titles["ru"]
    note = (SECTION_NOTES.get(key) or {}).get(lang)
    source = AiSource(ref=ref, type="section", title=title, href=path)
    return rag.ContextItem(source, rag.field_line(TYPE_WORDS["section"][lang], title, note))


def _top_hits(session: Session, settings: Settings, filters: AppliedFilters, lang: str) -> list[SearchItem]:
    response = search_service.search(
        session,
        settings,
        SearchFilters(
            q=filters.q, lang=lang, types=filters.types, doc_type=filters.doc_type, period=filters.period,
            per_group=rag.MAX_ITEMS, log=False,
        ),
    )
    hits = [item for group in response.groups for item in group.items]
    hits.sort(key=lambda item: -item.score)
    hits = hits[: rag.MAX_ITEMS]
    search_log.log_search(session, query=filters.q, lang=lang, source="ai", results_count=len(hits))
    return hits


# --- prepared request -------------------------------------------------------------


@dataclass
class Prepared:
    """Everything the answer needs, computed before streaming. `messages` is None when
    the result is a fixed text (no LLM call)."""

    result: AiAnswer
    context: rag.Context = field(default_factory=rag.Context)
    messages: list[dict[str, str]] | None = None


def _fixed(base: dict[str, Any], mode: str, texts: dict[str, str], **extra: Any) -> AiAnswer:
    return AiAnswer(**base, mode=mode, ai_generated=False, answer=texts[base["lang"]], **extra)


def _hints(filters: AppliedFilters | None) -> list[str]:
    hints: list[str] = []
    if filters and filters.doc_type:
        hints.append("remove_doc_type")
    if filters and filters.period:
        hints.append("remove_period")
    return hints + ["rephrase", "browse_catalog", "ask_site_sections"]


def prepare(session: Session, settings: Settings, request: AiRequest) -> Prepared:
    text = " ".join(request.q.split())
    lang = _resolve_lang(text, request.lang)
    guard = guards.check(text)
    available = ollama_client.availability(settings).available
    base: dict[str, Any] = {
        "query": text, "lang": lang, "ai_available": available, "injection_ignored": guard.injection,
    }
    if guard.verdict == "empty":
        return Prepared(_fixed(base, "empty", prompts.EMPTY_QUERY))
    if guard.verdict == "off_topic":
        return Prepared(_fixed(base, "off_topic", prompts.OFF_TOPIC))
    query = guard.query

    if guard.service:
        parsed = query_parser.fallback(query).model_copy(update={"intent": "service"})
    elif available:
        parsed = query_parser.parse(query, settings, search_repo.active_synonym_groups(session))
    else:
        parsed = query_parser.fallback(query)
    parsed = parsed.model_copy(update={"lang": lang})
    base["parsed"] = parsed

    if parsed.intent == "off_topic":
        return Prepared(_fixed(base, "off_topic", prompts.OFF_TOPIC))
    if parsed.intent == "service" and not guard.service:
        # The fixed service answer only on a rule match (guards): the model also files
        # «покажи трудовую книжку» under service. Otherwise search, with the section in context.
        parsed = parsed.model_copy(update={"intent": "site_help"})
        base["parsed"] = parsed
    if parsed.intent == "service":
        sources = [_section_item(f"S{i}", key, lang).source for i, key in enumerate(("state_service", "paid_services"), 1)]
        return Prepared(_fixed(base, "service", prompts.SERVICE, sources=sources, links=[EGOV]))

    filters = build_filters(parsed, query)
    base["filters"] = filters
    hits = _top_hits(session, settings, filters, lang)
    items = [item for item in (_item(session, f"S{i}", hit, lang) for i, hit in enumerate(hits, 1)) if item]
    for number, item in enumerate(items, 1):
        item.source.ref = f"S{number}"
    if not items:
        return Prepared(_fixed(base, "not_found", prompts.NOT_FOUND, hints=_hints(filters)))

    documents = [i for i in items if i.source.type == "document"]
    if len(documents) == len(items) and all(i.source.access != FileAccess.OPEN.value for i in documents):
        contacts = _section_item(f"S{len(items) + 1}", "contacts", lang).source
        return Prepared(_fixed(base, "restricted", prompts.RESTRICTED, sources=[i.source for i in items] + [contacts]))

    if parsed.intent in ("site_help", "branch"):
        keys = ("contacts", "branches") if parsed.intent == "branch" else ("contacts", "branches", "catalog", "state_service", "reading_room")
        items += [_section_item(f"S{len(items) + n}", key, lang) for n, key in enumerate(keys, 1)]

    context = rag.Context(items)
    if not available:
        return Prepared(_fixed(base, "unavailable", prompts.UNAVAILABLE, sources=[i.source for i in items]), context)
    messages = [
        {"role": "system", "content": prompts.system_prompt(lang)},
        {"role": "user", "content": prompts.user_message(query, context.text())},
    ]
    result = AiAnswer(**base, mode="answer", ai_generated=True, label=prompts.AI_LABEL[lang], answer="")
    return Prepared(result, context, messages)


# --- generation ---------------------------------------------------------------------


def _finish(prepared: Prepared, sanitizer: rag.StreamSanitizer) -> AiAnswer:
    result = prepared.result
    text = sanitizer.text
    if rag.is_empty(text):
        return result.model_copy(
            update={
                "mode": "not_found", "ai_generated": False, "label": None,
                "answer": prompts.NOT_FOUND[result.lang], "hints": _hints(result.filters),
            }
        )
    refs = prepared.context.refs
    return result.model_copy(update={"answer": text, "sources": [refs[ref] for ref in sanitizer.cited]})


def _unavailable(prepared: Prepared) -> AiAnswer:
    return prepared.result.model_copy(
        update={
            "mode": "unavailable", "ai_available": False, "ai_generated": False, "label": None,
            "answer": prompts.UNAVAILABLE[prepared.result.lang],
            "sources": [i.source for i in prepared.context.items],
        }
    )


def stream(prepared: Prepared, settings: Settings) -> Iterator[dict[str, Any]]:
    """Events: {"type": "meta", ...} (mode, parsed, filters), then {"type": "delta",
    "text": …} (already post-checked, sentence by sentence), then {"type": "done",
    "result": AiAnswer}. A fixed answer has no deltas."""
    meta = prepared.result.model_dump(mode="json", include={"mode", "query", "lang", "ai_available", "parsed", "filters"})
    yield {"type": "meta", **meta}
    if prepared.messages is None:
        yield {"type": "done", "result": prepared.result.model_dump(mode="json")}
        return
    context = prepared.context
    sanitizer = rag.StreamSanitizer(set(context.refs), context.codes)
    try:
        for chunk in ollama_client.chat_stream(prepared.messages, settings):
            for text in sanitizer.feed(chunk):
                yield {"type": "delta", "text": text}
        for text in sanitizer.flush():
            yield {"type": "delta", "text": text}
    except OllamaUnavailable as exc:
        logger.warning("AI answer interrupted: %s", exc.reason)
        yield {"type": "done", "result": _unavailable(prepared).model_dump(mode="json")}
        return
    yield {"type": "done", "result": _finish(prepared, sanitizer).model_dump(mode="json")}


def answer(prepared: Prepared, settings: Settings) -> AiAnswer:
    result: dict[str, Any] | None = None
    for event in stream(prepared, settings):
        if event["type"] == "done":
            result = event["result"]
    assert result is not None
    return AiAnswer.model_validate(result)


def ndjson(events: Iterator[dict[str, Any]]) -> Iterator[str]:
    for event in events:
        yield json.dumps(event, ensure_ascii=False) + "\n"
