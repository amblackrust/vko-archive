"""T5.11/T5.12: themes for the chronology and the historical map.

Calendar events get a theme from their wording, and three events that name a town get that
town's approximate coordinates (the town centre, not the site). Existing values are never
overwritten (admin edits survive).
Map objects are real places shown in the open historical materials (seed/open_data.py), linked to
those documents. Their coordinates are approximate too: events have no "verified" flag."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HistoricalEvent, WorkflowStatus
from seed.common import Report, i18n, translation_status, upsert
from seed.open_data import MAP_OBJECTS, MAP_WIKI
from seed.open_materials import open_document

# (substring of the ru title, place ru, lat, lng): town centres, approximate
TOWN_EVENTS = [
    ("образования г. Усть-Каменогорска", "г. Усть-Каменогорск", "49.948300", "82.627800"),
    ("съезда Советов в г.Зыряновске", "г. Зыряновск", "49.738900", "84.270000"),
    ("газеты «Риддерский рабочий»", "г. Риддер", "50.345600", "83.512500"),
]

PEOPLE_MARKERS = ("рождения",)


def _theme(title_ru: str) -> str:
    return "people" if any(m in title_ru for m in PEOPLE_MARKERS) else "institutions"


def seed_history_map(session: Session, report: Report, refresh: bool, *, demo: bool) -> None:
    for event in session.scalars(select(HistoricalEvent).where(HistoricalEvent.date_from.is_not(None))):
        title = (event.title or {}).get("ru", "")
        if event.theme is None:
            event.theme = _theme(title)
        for needle, place, lat, lng in TOWN_EVENTS:
            if needle in title and event.lat is None:
                event.place = i18n(ru=place)
                event.lat, event.lng = Decimal(lat), Decimal(lng)
    if not demo:
        return
    for slug, title, theme, place, lat, lng, description, files, article in MAP_OBJECTS:
        event = upsert(
            session, report, HistoricalEvent, {"slug": slug},
            {
                "title": i18n(ru=title),
                "description": i18n(ru=description),
                "theme": theme,
                "place": i18n(ru=place),
                "lat": Decimal(lat),
                "lng": Decimal(lng),
                "sources": [
                    {"title": "Изображения и их описания: Wikimedia Commons (см. привязанные документы)"},
                    {"title": f"Координаты (приблизительно): Википедия, статья «{article.replace('_', ' ')}»",
                     "url": MAP_WIKI + article},
                ],
                "is_demo": False,
                "workflow_status": WorkflowStatus.PUBLISHED,
                "translation_status": translation_status(ru=title),
            },
            refresh,
        )  # fmt: skip
        if not event.documents:
            event.documents = [open_document(session, file) for file in files]
