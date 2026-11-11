"""Seed tests run on the test database inside a rolled-back transaction."""

from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Branch,
    Document,
    DigitalFile,
    FileAccess,
    Fund,
    FundType,
    LegalAct,
    MemorialDate,
    OcrStatus,
    Page,
    SiteSetting,
)
from seed.runner import run


@pytest.fixture(scope="module")
def storage(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("storage")


def _count(session: Session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_seed_is_idempotent(db_session: Session, storage: Path) -> None:
    first = run(db_session, storage)
    tables = ("branches", "pages", "memorial_dates", "documents", "digital_files", "funds", "newspapers", "legal_acts",
              "exhibitions", "exhibits", "collections", "collection_items", "persons", "historical_events", "news")
    counts = {t: first.total(t) for t in tables}
    assert not first.existing  # empty test database: everything was created

    second = run(db_session, storage)
    assert not second.created
    assert {t: second.total(t) for t in tables} == counts


def test_info_content(db_session: Session, storage: Path) -> None:
    report = run(db_session, storage)
    branches = db_session.scalars(select(Branch)).all()
    assert len(branches) == 14  # head building + 13 branches
    head = next(b for b in branches if b.slug == "branch-head")
    assert "Бейбітшілік" in head.address["ru"]
    assert all(not b.coords_verified and b.lat is not None for b in branches)

    assert {p.key for p in db_session.scalars(select(Page))} >= {"history", "structure", "contacts", "compliance"}
    assert _count(db_session, MemorialDate) >= 150
    assert {d.year for d in db_session.scalars(select(MemorialDate))} == {2022, 2023, 2024, 2025, 2026}
    act = db_session.scalar(select(LegalAct).where(LegalAct.number == "142"))
    assert act is not None and act.file_id is not None
    assert db_session.get(SiteSetting, "contacts").value["email"] == "arhiv-ukg@yandex.kz"
    assert report.warnings == []


def test_demo_catalog_requirements(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    docs = db_session.scalars(select(Document).where(Document.is_demo)).all()  # the fictitious catalog only
    assert 40 <= len(docs) <= 50
    assert all("ДЕМО" not in d.title["ru"] and "ДЕМО" not in d.archive_code for d in docs)
    by_access = {a: sum(d.file_access == a for d in docs) for a in FileAccess}
    assert by_access[FileAccess.CLOSED] >= 5
    assert by_access[FileAccess.RESTRICTED] >= 3
    assert by_access[FileAccess.NEEDS_REVIEW] >= 3

    fund_types = [f.type for f in db_session.scalars(select(Fund).where(Fund.is_demo))]
    assert 5 <= len(fund_types) <= 6
    assert fund_types.count(FundType.PERSONAL) >= 2
    assert FundType.PARTY in fund_types and FundType.NEWSPAPER in fund_types

    multipage = db_session.execute(
        select(DigitalFile.owner_id)
        .where(DigitalFile.owner_type == "document", DigitalFile.ocr_status == OcrStatus.DONE)
        .group_by(DigitalFile.owner_id)
        .having(func.count() > 1)
    ).all()
    assert len(multipage) >= 3
    ivanov = next(d for d in docs if d.title["ru"].startswith("Справка о работе Иванова И.И."))
    ocr = db_session.scalars(select(DigitalFile.ocr_text).where(DigitalFile.owner_id == ivanov.id)).all()
    assert any("14 марта 1972" in (text or "") for text in ocr)


def test_seeded_slugs_and_paths_have_no_demo_word(db_session: Session, storage: Path) -> None:
    from app.models import HistoricalEvent, News

    run(db_session, storage)
    slugs = [
        *db_session.scalars(select(Document.slug)), *db_session.scalars(select(Fund.slug)),
        *db_session.scalars(select(News.slug)), *db_session.scalars(select(HistoricalEvent.slug)),
    ]
    paths = [*db_session.scalars(select(DigitalFile.master_path)), *db_session.scalars(select(DigitalFile.preview_path))]
    assert slugs and not [v for v in slugs if v and "demo" in v.lower()]
    assert paths and not [v for v in paths if v and "demo" in v.lower()]
    assert db_session.scalar(select(News.id).where(News.slug == "news-catalog-guide")) is not None


def test_files_follow_document_access(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    rows = db_session.execute(
        select(DigitalFile, Document).join(Document, Document.id == DigitalFile.owner_id).where(
            DigitalFile.owner_type == "document"
        )
    ).all()
    assert rows
    for file, document in rows:
        assert file.access == document.file_access and file.is_demo == document.is_demo
        assert (storage / file.master_path).read_bytes()
        assert not file.master_path.startswith("/")
