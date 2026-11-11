"""Shared pieces of the admin content API (B14): validated i18n text and the generic response shapes."""

import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict

LANGS = ("kk", "ru", "en")
I18N_MAX_CHARS = 10_000


def clean_i18n(value: dict[str, str]) -> dict[str, str]:
    """Only kk/ru/en keys, trimmed, empty translations dropped."""
    unknown = set(value) - set(LANGS)
    if unknown:
        raise ValueError("unknown language")
    cleaned = {lang: text.strip() for lang, text in value.items()}
    if any(len(text) > I18N_MAX_CHARS for text in cleaned.values()):
        raise ValueError("text too long")
    return {lang: text for lang, text in cleaned.items() if text}


I18nText = Annotated[dict[str, str], AfterValidator(clean_i18n)]


class StrictInput(BaseModel):
    """Request payload: unknown fields (workflow_status, version, created_by...) are rejected."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PathItem(BaseModel):
    kind: str
    id: uuid.UUID
    label: str


class ObjectOut(BaseModel):
    """An editable content object: `values` holds exactly the fields the input schema accepts."""

    id: uuid.UUID
    kind: str
    version: int
    workflow_status: str
    translation_status: dict[str, str]
    created_at: datetime
    updated_at: datetime
    available_actions: list[str]
    values: dict[str, Any]
    path: list[PathItem] = []
    counts: dict[str, int] = {}


class ListItem(BaseModel):
    id: uuid.UUID
    kind: str
    number: str | None
    title: dict[str, str]
    workflow_status: str
    version: int
    updated_at: datetime
    parent_id: uuid.UUID | None = None
    children: int | None = None
    extra: dict[str, Any] = {}


class ListPage(BaseModel):
    items: list[ListItem]
    total: int
    page: int
    page_size: int
