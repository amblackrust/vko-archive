"""T5.11/T5.12: themes for the chronology and the historical map.

Real part: calendar events get a theme from their wording, and three events that name a town
get that town's approximate coordinates (the town centre, not the site). Existing values are
never overwritten (admin edits survive).
DEMO part: fictitious historical objects (is_demo) linked to fictitious demo documents."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HistoricalEvent, WorkflowStatus
from seed.common import Report, demo_document, i18n, translation_status, upsert

# (substring of the ru title, place ru, lat, lng): town centres, approximate
TOWN_EVENTS = [
    ("образования г. Усть-Каменогорска", "г. Усть-Каменогорск", "49.948300", "82.627800"),
    ("съезда Советов в г.Зыряновске", "г. Зыряновск", "49.738900", "84.270000"),
    ("газеты «Риддерский рабочий»", "г. Риддер", "50.345600", "83.512500"),
]

# (slug, ru title, theme, ru place, lat, lng, ru description, demo document keys)
DEMO_OBJECTS = [
    ("map-demo-council", "Здание городского совета (вымышленный объект)", "building", "г. Усть-Каменогорск",
     "49.951000", "82.614000", "Вымышленный объект: здание, о котором рассказывают документы подборки.",
     ["d2-1-1-1", "d2-1-1-2"]),
    ("map-demo-school", "Школа № 1 (вымышленный объект)", "building", "г. Усть-Каменогорск",
     "49.944000", "82.633000", "Вымышленный объект: школа из документов об образовании.",
     ["d6-1-1-1"]),
    ("map-demo-plant", "Цех свинцово-цинкового комбината (вымышленный объект)", "enterprise", "г. Усть-Каменогорск",
     "49.985000", "82.560000", "Вымышленный объект: цех из документов о комбинате.",
     ["d1-1-1-1", "d1-2-1-1"]),
    ("map-demo-mine", "Рудник (вымышленный объект)", "enterprise", "г. Риддер",
     "50.350000", "83.500000", "Вымышленный объект. Реальный рудник не обозначается.", []),
    ("map-demo-monument", "Памятный знак (вымышленный объект)", "heritage", "г. Семей",
     "50.411100", "80.227500", "Вымышленный объект наследия. Реального памятника не обозначает.", []),
    ("map-demo-site", "Место исторического события (вымышленное)", "heritage", "г. Зыряновск",
     "49.741000", "84.266000", "Вымышленное место.", []),
]  # fmt: skip

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
    for slug, title, theme, place, lat, lng, description, keys in DEMO_OBJECTS:
        event = upsert(
            session, report, HistoricalEvent, {"slug": slug},
            {
                "title": i18n(ru=title),
                "description": i18n(ru=description),
                "theme": theme,
                "place": i18n(ru=place),
                "lat": Decimal(lat),
                "lng": Decimal(lng),
                "sources": [{"title": "Вымышленные данные"}],
                "is_demo": True,
                "workflow_status": WorkflowStatus.PUBLISHED,
                "translation_status": translation_status(ru=title),
            },
            refresh,
        )  # fmt: skip
        if not event.documents:
            event.documents = [demo_document(session, key) for key in keys]
