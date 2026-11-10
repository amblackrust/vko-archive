"""Public home-page data (T5.1)."""

from pydantic import BaseModel


class MemorialDateItem(BaseModel):
    day: int | None
    month: int
    event_year: int | None
    date_text: str | None
    text: str
    text_lang: str  # language of `text` (fallback when the requested one is missing)
    is_today: bool


class MemorialDatesResponse(BaseModel):
    year: int
    month: int
    items: list[MemorialDateItem]
