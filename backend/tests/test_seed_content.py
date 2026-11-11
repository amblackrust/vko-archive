"""T2.4 requirements for the seeded content: exhibitions, memory archive, map, news, FAQ.
Everything shown there is built from the open materials (real images); nothing fictitious."""

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


def _is_open_material(document: Document | None) -> bool:
    return document is not None and not document.is_demo and document.slug.startswith("open-")


def test_exhibitions_show_open_materials_with_a_source_line(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    exhibitions = db_session.scalars(select(Exhibition)).all()
    assert {e.slug for e in exhibitions} == {
        "exhibition-ust-kamenogorsk", "exhibition-travellers", "exhibition-semipalatinsk-maps", "exhibition-industry",
    }  # fmt: skip
    for exhibition in exhibitions:
        assert not exhibition.is_demo and exhibition.workflow_status == WorkflowStatus.PUBLISHED
        assert 6 <= len(exhibition.exhibits) <= 10
        assert "Wikimedia Commons" in exhibition.intro["ru"] and "не входят в фонды" in exhibition.intro["ru"]
        cover = db_session.get(DigitalFile, exhibition.cover_file_id)
        assert cover is not None and cover.access == FileAccess.OPEN and not cover.is_demo
        assert [e.position for e in exhibition.exhibits] == list(range(1, len(exhibition.exhibits) + 1))
        for exhibit in exhibition.exhibits:
            document = db_session.get(Document, exhibit.document_id)
            media = db_session.get(DigitalFile, exhibit.media_file_id)
            assert _is_open_material(document) and media is not None
            # Exhibits only show open documents; the file must follow the document's access.
            assert document.file_access == FileAccess.OPEN and media.access == FileAccess.OPEN
            assert media.owner_id == document.id and exhibit.archive_code == document.archive_code
            assert not exhibit.is_demo and exhibit.caption["ru"] and exhibit.title["ru"] == document.title["ru"]
            # The customer wants the source on the exhibit itself: where from, whose, which licence.
            source = exhibit.source["ru"]
            assert source.startswith("Wikimedia Commons, автор") and ", лицензия: " in source
            assert not source.endswith("лицензия: ") and "автор: Автор" not in source
            assert (storage / media.master_path).read_bytes()


def test_memory_persons_and_chronology(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    persons = {p.slug: p for p in db_session.scalars(select(Person))}
    assert len(persons) == 8 and not any(p.is_demo for p in persons.values())
    calendar = [p for slug, p in persons.items() if slug.startswith("person-memorial-")]
    assert len(calendar) == 5
    for person in calendar:  # facts only from the customer's calendar
        assert person.sources and "Календарь памятных дат" in person.sources[0]["title"]
        assert person.bio["ru"] and person.birth_year and person.years_text
    for slug in ("person-kennan", "person-kornilov", "person-bazhov"):  # persons with a portrait in the open materials
        person = persons[slug]
        assert [_is_open_material(d) for d in person.documents] == [True]
        assert db_session.get(DigitalFile, person.photo_file_id).owner_id == person.documents[0].id
        assert any(s.get("url", "").startswith("https://commons.wikimedia.org/") for s in person.sources)
        assert any("документами архива" in s["title"] for s in person.sources)  # the editorial note
    # The unconfirmed birthplace is said in plain words: the person model has no flag for it.
    kornilov = persons["person-kornilov"].bio["ru"]
    assert "Усть-Каменогорск" in kornilov and "Каркаралинск" in kornilov and "не подтверждено" in kornilov

    events = db_session.scalars(
        select(HistoricalEvent).where(HistoricalEvent.date_from.is_not(None)).order_by(HistoricalEvent.date_from)
    ).all()
    assert 25 <= len(events) <= 30
    assert all(e.sources and not e.is_demo for e in events)
    assert all(e.theme for e in events)  # chronology filter has a theme for every event


def test_collections_point_to_open_materials(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    collections = db_session.scalars(select(Collection)).all()
    assert len(collections) == 8 and not any(c.is_demo for c in collections)
    # ТЗ directions that the material honestly supports; each collection says the images are not the archive's.
    assert {c.theme for c in collections} == {
        "region", "ust-kamenogorsk", "industry", "people", "education", "culture", "war", "periods",
    }  # fmt: skip
    assert all("не входят" in c.description["ru"] for c in collections)
    for collection in collections:
        assert 2 <= len(collection.items) <= 10
    for item in db_session.scalars(select(CollectionItem)).all():
        document = db_session.get(Document, item.item_id)
        assert item.item_type == "document" and _is_open_material(document)
        assert document.file_access == FileAccess.OPEN
    war = next(c for c in collections if c.theme == "war")
    assert "не на территории" in war.description["ru"] and all(i.note["ru"] for i in war.items)


def test_map_objects_are_real_places_with_documents(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    points = db_session.scalars(select(HistoricalEvent).where(HistoricalEvent.slug.like("map-%"))).all()
    assert len(points) == 12
    for point in points:
        assert not point.is_demo and "вымышлен" not in (point.title["ru"] + point.description["ru"]).lower()
        assert 46 < point.lat < 52 and 79 < point.lng < 88  # inside the region
        assert point.documents and all(_is_open_material(d) for d in point.documents)
        assert point.sources[1]["url"].startswith("https://ru.wikipedia.org/wiki/")  # where the coordinates are from
    assert not db_session.scalars(select(HistoricalEvent).where(HistoricalEvent.is_demo)).all()


def test_news_and_faq_counts(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    news = db_session.scalars(select(News)).all()
    assert len(news) == 9
    assert all(n.is_demo and "ДЕМО" not in n.title["ru"] and n.published_at is not None for n in news)
    assert not [n.slug for n in news if "вымышлен" in (n.title["ru"] + n.summary["ru"] + n.body["ru"]).lower()]
    exhibitions = {str(e.id): e.slug for e in db_session.scalars(select(Exhibition))}
    announced = {exhibitions[n.related[0]["id"]] for n in news if n.related}
    assert announced == set(exhibitions.values())  # one announcement per exhibition
    for item in news:
        if item.cover_file_id:  # a cover is an open image, credited in the text
            assert db_session.get(DigitalFile, item.cover_file_id).access == FileAccess.OPEN
            assert "Wikimedia Commons, автор" in item.body["ru"] and "лицензия: " in item.body["ru"]
    decree = next(n for n in news if n.slug == "news-branches-142")
    assert "№ 142" in decree.body["ru"] and "девять" in decree.body["ru"] and "четыре" in decree.body["ru"]

    faqs = db_session.scalars(select(FAQ)).all()
    assert len(faqs) == 20
    per_topic = db_session.execute(select(FAQ.category, func.count()).group_by(FAQ.category)).all()
    assert len(per_topic) == 5 and all(count == 4 for _, count in per_topic)
    assert all(f.question["ru"] and f.answer["ru"] for f in faqs)


def test_machine_translations_are_marked(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    exhibition = db_session.scalar(select(Exhibition).where(Exhibition.slug == "exhibition-industry"))
    assert exhibition.translation_status == {"ru": "verified", "kk": "machine", "en": "machine"}
    assert set(exhibition.title) == {"ru", "kk", "en"} and set(exhibition.intro) == {"ru", "kk", "en"}
    exhibit = db_session.scalar(select(Exhibit).where(Exhibit.exhibition_id == exhibition.id))
    assert exhibit.translation_status["kk"] == "machine" and set(exhibit.title) == {"ru", "kk", "en"}
    faq = db_session.scalar(select(FAQ).where(FAQ.slug == "faq-site-1"))
    assert faq.translation_status == {"ru": "verified", "kk": "missing", "en": "missing"}
    assert "kk" not in faq.question and "en" not in faq.question
