from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import DbSession
from app.models import MemorialDate
from app.models.enums import WorkflowStatus
from app.schemas.home import MemorialDateItem, MemorialDatesResponse
from app.services.catalog import pick

router = APIRouter(prefix="/home", tags=["home"])


@router.get("/memorial-dates", response_model=MemorialDatesResponse)
def memorial_dates(
    session: DbSession,
    lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru",
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> MemorialDatesResponse:
    """Published memorial dates. Without year/month: the current month, today's first (main page).
    With year (and optional month): that year's dates for the memorial calendar (T5.15)."""
    today = date.today()
    current_month = year is None and month is None
    if current_month:
        year, month = today.year, today.month
    year = year or today.year
    filters = [MemorialDate.workflow_status == WorkflowStatus.PUBLISHED, MemorialDate.year == year]
    if month is not None:
        filters.append(MemorialDate.month == month)
    rows = session.scalars(
        select(MemorialDate)
        .where(*filters)
        .order_by(MemorialDate.month, MemorialDate.day.nulls_last(), MemorialDate.event_year)
    )
    items = []
    for row in rows:
        text, text_lang = pick(row.text, lang)
        if text:
            items.append(MemorialDateItem(
                day=row.day, month=row.month, event_year=row.event_year, date_text=row.date_text,
                text=text, text_lang=text_lang, is_today=current_month and row.day == today.day,
            ))
    if current_month:
        items.sort(key=lambda i: not i.is_today)  # stable: today's first, then by day
    return MemorialDatesResponse(year=year, month=month, items=items)
