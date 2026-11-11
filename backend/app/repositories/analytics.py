from datetime import datetime

from sqlalchemy import Date, Integer, cast, func, select
from sqlalchemy.orm import Session

from app.models import FAQ, Page, PriceListItem, SearchLog
from app.models.enums import WorkflowStatus

STALE_MODELS = {"page": Page, "faq": FAQ, "price_list_item": PriceListItem}


def totals(session: Session, since: datetime) -> tuple[int, int, dict[str, int]]:
    zero = func.sum(cast(SearchLog.zero_result, Integer))
    total, zeros = session.execute(select(func.count(), func.coalesce(zero, 0)).where(SearchLog.ts >= since)).one()
    source = func.coalesce(SearchLog.source, "unknown")
    sources = session.execute(select(source, func.count()).where(SearchLog.ts >= since).group_by(source))
    return int(total), int(zeros), {name: int(count) for name, count in sources}


def per_day(session: Session, since: datetime) -> list[tuple]:
    day = cast(SearchLog.ts, Date).label("day")
    zero = func.coalesce(func.sum(cast(SearchLog.zero_result, Integer)), 0)
    return list(session.execute(select(day, func.count(), zero).where(SearchLog.ts >= since).group_by(day).order_by(day)))


def grouped_queries(
    session: Session, since: datetime, *, zero_only: bool = False, source: str | None = None, limit: int = 500
) -> list[tuple[str, int, float]]:
    """(query as typed, count, average results) — the caller masks personal data (capital letters
    are how names are recognised, so the case is kept here) and merges variants."""
    key = func.trim(SearchLog.query)
    stmt = select(key, func.count().label("n"), func.avg(SearchLog.results_count)).where(SearchLog.ts >= since, key != "")
    if zero_only:
        stmt = stmt.where(SearchLog.zero_result.is_(True))
    if source:
        stmt = stmt.where(SearchLog.source == source)
    rows = session.execute(stmt.group_by(key).order_by(func.count().desc(), key).limit(limit))
    return [(query, int(n), float(avg or 0)) for query, n, avg in rows]


def stale_objects(session: Session, before: datetime, limit: int) -> list[tuple[str, object]]:
    found: list[tuple[str, object]] = []
    for kind, model in STALE_MODELS.items():
        stmt = select(model).where(model.workflow_status == WorkflowStatus.PUBLISHED, model.updated_at < before)
        found += [(kind, obj) for obj in session.scalars(stmt.order_by(model.updated_at).limit(limit))]
    found.sort(key=lambda item: item[1].updated_at)  # type: ignore[attr-defined]
    return found[:limit]
