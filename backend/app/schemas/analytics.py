"""Site analytics (T4.11): aggregates only. No user ids, no IPs, no raw rare queries."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class QueryStat(BaseModel):
    query: str  # masked: names, e-mails and long numbers replaced
    count: int
    avg_results: float


class DayStat(BaseModel):
    day: date
    searches: int
    zero_result: int


class StalePage(BaseModel):
    object_type: str
    id: str
    title: str
    updated_at: datetime


class Recommendation(BaseModel):
    """`code` + `params` are rendered by the UI in the user's language."""

    code: Literal["improve_zero_results", "add_content_for", "update_stale_pages", "few_data", "review_ai_questions"]
    params: dict[str, str | int | float] = {}


class AnalyticsReport(BaseModel):
    days: int
    total_searches: int
    zero_result_searches: int
    zero_result_rate: float
    by_source: dict[str, int]
    per_day: list[DayStat]
    top_queries: list[QueryStat]
    zero_queries: list[QueryStat]  # topics to add to the site
    ai_questions: list[QueryStat]
    rare_queries: int  # queries asked once: counted, never listed (they may hold personal data)
    stale_pages: list[StalePage]
    recommendations: list[Recommendation]
    views_available: bool  # page views are not collected (no trackers): always False


class AiSummaryOut(BaseModel):
    available: bool
    reason: str | None = None
    text: str = ""
    label: str = ""
