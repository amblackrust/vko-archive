import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.search import Lang, ObjectType
from app.services.indexing import DOC_TYPE_LABELS

DOC_TYPES: tuple[str, ...] = tuple(DOC_TYPE_LABELS)

Intent = Literal["search", "service", "branch", "site_help", "off_topic"]
# answer: LLM summary over found public materials; the others are fixed texts (no LLM).
Mode = Literal["answer", "not_found", "restricted", "off_topic", "service", "unavailable", "empty"]


class ParsedPeriod(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    from_: int | None = Field(default=None, alias="from")
    to: int | None = None


class ParsedQuery(BaseModel):
    """Output of the query parser (T4.2). `source`: llm, or fallback = plain full text."""

    intent: Intent = "search"
    doc_types: list[str] = Field(default_factory=list)  # filtered to DOC_TYPES by the parser
    places: list[str] = Field(default_factory=list)
    period: ParsedPeriod | None = None
    topics: list[str] = Field(default_factory=list)
    persons: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    lang: Lang = "ru"
    source: Literal["llm", "fallback"] = "fallback"


class AppliedFilters(BaseModel):
    """What the assistant searched with: chips for the UI and the exact `/api/search`
    parameters (`q`, `types`, `doc_type`, `period`) to show the same results."""

    q: str
    types: list[ObjectType] = Field(default_factory=list)
    doc_type: list[str] = Field(default_factory=list)
    period: list[str] = Field(default_factory=list)  # decade facet values, e.g. "1960s"
    period_range: ParsedPeriod | None = None
    places: list[str] = Field(default_factory=list)
    persons: list[str] = Field(default_factory=list)
    # canonical place → its name in the question's language (kk/en); a place absent here is
    # shown as is. Search still works by the canonical name in `places` / `q`.
    place_labels: dict[str, str] = Field(default_factory=dict)


HISTORY_MAX_TURNS = 6
HISTORY_USER_CHARS = 500
HISTORY_ASSISTANT_CHARS = 1500
HISTORY_TOTAL_CHARS = 4000


class HistoryTurn(BaseModel):
    """A previous message of the dialog: text only (no sources). Untrusted client data."""

    role: Literal["user", "assistant"]
    text: str = Field(max_length=HISTORY_ASSISTANT_CHARS)

    @model_validator(mode="after")
    def _limit_user_text(self) -> "HistoryTurn":
        if self.role == "user" and len(self.text) > HISTORY_USER_CHARS:
            raise ValueError(f"user turn is longer than {HISTORY_USER_CHARS} characters")
        return self


class AiRequest(BaseModel):
    q: str = Field(max_length=500)
    # Interface language: used only when the language of the query cannot be told.
    lang: Lang | None = None
    # Last turns of the dialog (oldest first) for follow-up questions; optional.
    history: list[HistoryTurn] = Field(default_factory=list, max_length=HISTORY_MAX_TURNS)

    @model_validator(mode="after")
    def _limit_history(self) -> "AiRequest":
        if sum(len(turn.text) for turn in self.history) > HISTORY_TOTAL_CHARS:
            raise ValueError(f"history is longer than {HISTORY_TOTAL_CHARS} characters")
        return self


class RouteLink(BaseModel):
    provider: Literal["2gis", "google", "yandex"]
    url: str


class AiSource(BaseModel):
    """A card built by the server. `ref` is the marker the answer text uses ([S1] …);
    `href` is an internal site path without the locale prefix, `url` an external link."""

    ref: str
    type: Literal["document", "fund", "page", "branch", "exhibition", "collection", "news", "section"]
    id: uuid.UUID | None = None
    title: str
    href: str | None = None
    url: str | None = None
    archive_code: str | None = None
    date_text: str | None = None
    doc_type: str | None = None
    # Documents: access status of the files (open / restricted / closed / needs_review).
    access: str | None = None
    access_conditions: str | None = None
    address: str | None = None
    phone: str | None = None
    hours: str | None = None
    routes: list[RouteLink] = Field(default_factory=list)
    # Document mode (T4.6): the page of the digital copy a fragment comes from and its file
    # (the viewer opens it via /api/files/{file_id}). None for other sources.
    page: int | None = None
    file_id: uuid.UUID | None = None


class ExternalLink(BaseModel):
    id: Literal["egov", "eotinish"]
    url: str


class AiAnswer(BaseModel):
    mode: Mode
    query: str
    lang: Lang
    ai_available: bool
    ai_generated: bool  # True only when the text was written by the model
    label: str | None = None  # "Сформировано ИИ, не является архивной справкой"
    answer: str
    sources: list[AiSource] = Field(default_factory=list)
    links: list[ExternalLink] = Field(default_factory=list)
    parsed: ParsedQuery | None = None
    filters: AppliedFilters | None = None
    # not_found: remove_doc_type | remove_period | rephrase | browse_catalog | ask_site_sections
    hints: list[str] = Field(default_factory=list)
    injection_ignored: bool = False


class AiStatus(BaseModel):
    ai_available: bool
    reason: str | None = None  # ollama_unavailable | model_missing


class AiParseResponse(BaseModel):
    query: str
    lang: Lang
    ai_available: bool
    parsed: ParsedQuery
    filters: AppliedFilters
