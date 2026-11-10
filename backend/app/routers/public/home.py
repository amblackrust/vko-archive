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
    session: DbSession, lang: Annotated[str, Query(pattern="^(kk|ru|en)$")] = "ru"
) -> MemorialDatesResponse:
    """Published memorial dates of the current month (calendar year of the table), today's first."""
    today = date.today()
    rows = session.scalars(
        select(MemorialDate)
        .where(
            MemorialDate.workflow_status == WorkflowStatus.PUBLISHED,
            MemorialDate.year == today.year,
            MemorialDate.month == today.month,
        )
        .order_by(MemorialDate.day.nulls_last(), MemorialDate.event_year)
    )
    items = []
    for row in rows:
        text, text_lang = pick(row.text, lang)
        if text:
            items.append(MemorialDateItem(
                day=row.day, month=row.month, event_year=row.event_year, date_text=row.date_text,
                text=text, text_lang=text_lang, is_today=row.day == today.day,
            ))
    items.sort(key=lambda i: not i.is_today)  # stable: today's first, then by day
    return MemorialDatesResponse(year=today.year, month=today.month, items=items)
