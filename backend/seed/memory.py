"""T2.4: «Архив памяти» — persons and chronology taken from the Календарь памятных дат (info/),
plus demo collections built from the fictitious demo catalog.

Persons and events are real public facts from the customer's calendar: only what the calendar
states, with the calendar as the source. Biographies beyond that are not invented."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Collection,
    CollectionItem,
    HistoricalEvent,
    MemorialDate,
    Person,
    WorkflowStatus,
)
from seed.common import Report, demo_document, i18n, translation_status, upsert

PUBLISHED = WorkflowStatus.PUBLISHED
CALENDAR_SOURCE = "Календарь памятных дат (info/)"
BIO_NOTE = " Подробная биография будет добавлена после проверки по источнику."

# (calendar slug, nominative name, birth year, death year, years text)
CALENDAR_PERSONS = [
    ("memorial-2026-01", "Пермитин Ефим Николаевич", 1896, 1971, "1896–1971"),
    ("memorial-2026-04", "Бердус Иван Васильевич", 1906, 1970, "1906–1970"),
    ("memorial-2026-09", "Герасимов Семён Николаевич", 1901, 1989, "1901–1989"),
    ("memorial-2026-14", "Алексеенко Николай Владимирович", 1931, 2009, "1931–2009"),
    ("memorial-2026-21", "Седельников Александр Никитич", 1876, 1919, "1876–1919"),
]

# Chronology: every dated calendar entry of the 2025 and 2026 calendars, in order of the event date.
EVENT_CALENDAR_YEARS = (2025, 2026)
EVENTS_LIMIT = 30

# Demo collections: (slug, ru title, ru description, theme, period, demo document keys)
COLLECTIONS = [
    ("collection-ust-kamenogorsk", "Усть-Каменогорск в документах 1950–1960-х",
     "Подборка вымышленных документов о городе: решения горсовета, планы, фотографии и газеты.",
     "ust-kamenogorsk", "1950–1960-е",
     ["d2-1-1-1", "d2-1-1-2", "d2-1-2-1", "d2-1-2-2", "d4-1-1-2"]),  # fmt: skip
    ("collection-lead-zinc", "Свинцово-цинковый комбинат: цеха и люди",
     "Вымышленные документы о строительстве и работе цехов комбината, фотографии и воспоминания.",
     "lead-zinc", "1950–1980-е",
     ["d1-1-1-1", "d1-1-2-1", "d1-2-1-1", "d1-2-1-3", "d1-2-3-1"]),  # fmt: skip
    ("collection-education", "Образование в регионе",
     "Вымышленные школьные документы и материалы о работе учителей.",
     "education", "1960–1970-е",
     ["d6-1-1-1", "d6-1-2-1", "d6-1-2-2", "d2-1-3-1", "d2-1-3-2"]),  # fmt: skip
]


def seed_persons(session: Session, report: Report, refresh: bool) -> None:
    for calendar_slug, name, birth, death, years in CALENDAR_PERSONS:
        row = session.scalar(select(MemorialDate).where(MemorialDate.slug == calendar_slug))
        assert row is not None, f"calendar entry {calendar_slug} is missing: seed the calendar first"
        upsert(
            session, report, Person, {"slug": f"person-{calendar_slug}"},
            {
                "name": i18n(ru=name),
                "birth_year": birth,
                "death_year": death,
                "years_text": years,
                "bio": i18n(ru=row.text["ru"] + "." + BIO_NOTE),
                "sources": [{"title": f"{CALENDAR_SOURCE}, {row.year}"}],
                "is_demo": False,
                "workflow_status": PUBLISHED,
                "translation_status": translation_status(ru=row.text["ru"]),
            },
            refresh,
        )  # fmt: skip


def seed_chronology(session: Session, report: Report, refresh: bool) -> None:
    rows = session.scalars(
        select(MemorialDate)
        .where(
            MemorialDate.year.in_(EVENT_CALENDAR_YEARS),
            MemorialDate.event_year.is_not(None),
            MemorialDate.day.is_not(None),
        )
        .order_by(MemorialDate.event_year, MemorialDate.month, MemorialDate.day)
        .limit(EVENTS_LIMIT)
    ).all()
    assert len(rows) >= 25, "calendar must provide at least 25 dated events for the chronology"
    for row in rows:
        upsert(
            session, report, HistoricalEvent, {"slug": f"event-{row.slug}"},
            {
                "date_text": f"{row.day:02d}.{row.month:02d}.{row.event_year}",
                "date_from": date(row.event_year, row.month, row.day),
                "title": dict(row.text),
                "description": {},
                "sources": [{"title": f"{CALENDAR_SOURCE}, {row.year}"}],
                "workflow_status": PUBLISHED,
                "translation_status": translation_status(**row.text),
            },
            refresh,
        )  # fmt: skip


def seed_collections(session: Session, report: Report, refresh: bool) -> None:
    for slug, title, description, theme, period, keys in COLLECTIONS:
        collection = upsert(
            session, report, Collection, {"slug": slug},
            {
                "title": i18n(ru=title),
                "theme": theme,
                "period": period,
                "description": i18n(ru=description),
                "is_demo": True,
                "workflow_status": PUBLISHED,
                "translation_status": translation_status(ru=title),
            },
            refresh,
        )  # fmt: skip
        session.flush()
        for position, key in enumerate(keys):
            upsert(
                session, report, CollectionItem, {"collection_id": collection.id, "position": position},
                {"item_type": "document", "item_id": demo_document(session, key).id},
                refresh,
            )  # fmt: skip
