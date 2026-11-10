"""Public content contracts (T5.2, T5.3, T5.16). Texts are plain text, except page bodies,
which are sanitized HTML stored by the CMS. `lang` is the language actually returned: the
requested one when it exists, otherwise the fallback order from services.catalog.pick."""

import uuid
from typing import Literal

from pydantic import BaseModel

Lang = Literal["kk", "ru", "en"]
TranslationStatus = Literal["verified", "machine", "missing"]


class PageDetail(BaseModel):
    key: str
    title: str
    body: str
    lang: str
    translation_status: str


class FaqItem(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    lang: str
    translation_status: str


class FaqGroup(BaseModel):
    category: str
    items: list[FaqItem]


class FaqResponse(BaseModel):
    groups: list[FaqGroup]


class Phone(BaseModel):
    label: str
    value: str


class Contacts(BaseModel):
    """`site_settings.contacts`, seeded from info/Контакты.docx."""

    address: str
    director: str
    phones: list[Phone]
    email: str
    hours: str
    reading_room_hours: str
