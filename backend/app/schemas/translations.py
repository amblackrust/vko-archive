import uuid
from typing import Literal

from pydantic import BaseModel

Lang = Literal["kk", "ru", "en"]
Status = Literal["verified", "machine", "missing"]


class TranslationItem(BaseModel):
    object_type: str
    id: uuid.UUID
    label: str
    workflow_status: str
    version: int
    translation_status: dict[str, str]


class TranslationPage(BaseModel):
    items: list[TranslationItem]
    total: int
    page: int
    page_size: int


class TranslationDetail(TranslationItem):
    fields: dict[str, dict[str, str]]
    can_machine_translate: bool


class MachineTranslateRequest(BaseModel):
    source_lang: Lang
    target_lang: Lang
    version: int
    overwrite: bool = False


class VerifyRequest(BaseModel):
    lang: Lang
    version: int


class AiUnavailableOut(BaseModel):
    detail: Literal["ai_unavailable"]
    reason: str
