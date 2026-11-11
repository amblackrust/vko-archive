"""T2.4 requirements for the demo content: exhibitions, memory archive, news, FAQ."""

from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    FAQ,
    Collection,
    CollectionItem,
    Document,
    DigitalFile,
    Exhibit,
    Exhibition,
    FileAccess,
    HistoricalEvent,
    News,
    Person,
    WorkflowStatus,
)
from seed.runner import run


@pytest.fixture(scope="module")
def storage(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("storage_content")


def test_exhibitions_have_exhibits_with_open_files(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    exhibitions = db_session.scalars(select(Exhibition)).all()
    assert len(exhibitions) == 3
    for exhibition in exhibitions:
        assert exhibition.is_demo and exhibition.workflow_status == WorkflowStatus.PUBLISHED
        assert 6 <= len(exhibition.exhibits) <= 10
        assert exhibition.cover_file_id is not None
        for exhibit in exhibition.exhibits:
            document = db_session.get(Document, exhibit.document_id)
            media = db_session.get(DigitalFile, exhibit.media_file_id)
            assert document is not None and media is not None
            # Exhibits only show open documents; the file must follow the document's access.
            assert document.file_access == FileAccess.OPEN and media.access == FileAccess.OPEN
            assert media.owner_id == document.id
            assert exhibit.is_demo and "ДЕМО" not in exhibit.title["ru"]
            assert exhibit.source["ru"].endswith(document.archive_code)
            assert (storage / media.master_path).read_bytes()


def test_memory_persons_and_chronology_from_calendar(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    persons = db_session.scalars(select(Person)).all()
    assert len(persons) == 5
    for person in persons:
        assert not person.is_demo  # real public figures, facts only from the calendar
        assert person.sources and "Календарь памятных дат" in person.sources[0]["title"]
        assert person.bio["ru"] and person.birth_year and person.years_text

    events = db_session.scalars(select(HistoricalEvent).where(HistoricalEvent.is_demo.is_(False)).order_by(HistoricalEvent.date_from)).all()
    assert 25 <= len(events) <= 30
    assert all(e.date_from is not None and e.sources for e in events)
    assert events == sorted(events, key=lambda e: e.date_from)
    assert all(e.theme for e in events)  # chronology filter has a theme for every event


def test_collections_point_to_open_demo_documents(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    collections = db_session.scalars(select(Collection)).all()
    assert len(collections) == 3
    items = db_session.scalars(select(CollectionItem)).all()
    assert len(items) >= 12
    for item in items:
        document = db_session.get(Document, item.item_id)
        assert item.item_type == "document" and document is not None
        assert document.file_access == FileAccess.OPEN and document.is_demo


def test_news_and_faq_counts(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    news = db_session.scalars(select(News)).all()
    assert len(news) == 7
    assert all("ДЕМО" not in n.title["ru"] and n.published_at is not None for n in news)

    faqs = db_session.scalars(select(FAQ)).all()
    assert len(faqs) == 20
    per_topic = db_session.execute(select(FAQ.category, func.count()).group_by(FAQ.category)).all()
    assert len(per_topic) == 5 and all(count == 4 for _, count in per_topic)
    assert all(f.question["ru"] and f.answer["ru"] for f in faqs)


def test_machine_translations_are_marked(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    exhibition = db_session.scalar(select(Exhibition).where(Exhibition.slug == "exhibition-industry"))
    assert exhibition.translation_status == {"ru": "verified", "kk": "machine", "en": "machine"}
    assert set(exhibition.title) == {"ru", "kk", "en"}
    faq = db_session.scalar(select(FAQ).where(FAQ.slug == "faq-site-1"))
    assert faq.translation_status == {"ru": "verified", "kk": "missing", "en": "missing"}
    assert "kk" not in faq.question and "en" not in faq.question
