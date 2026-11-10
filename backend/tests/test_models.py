import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    EMBEDDING_DIM,
    Case,
    DescriptionStatus,
    DigitalFile,
    Document,
    FileAccess,
    Fund,
    FundType,
    Inventory,
    SearchEntry,
    User,
    WorkflowStatus,
)


def _hierarchy(session: Session) -> tuple[Fund, Document]:
    fund = Fund(number="ДЕМО-1", title={"ru": "Демо-фонд"}, type=FundType.ORGANIZATION, is_demo=True)
    inventory = Inventory(fund=fund, number="1", title={"ru": "Опись 1"})
    case = Case(inventory=inventory, number="1", title={"ru": "Дело 1"})
    document = Document(case=case, archive_code="ДЕМО-1-1-1", title={"ru": "Документ (ДЕМО)"}, is_demo=True)
    session.add(document)
    session.flush()
    return fund, document


def test_catalog_hierarchy_defaults(db_session: Session) -> None:
    _, document = _hierarchy(db_session)
    db_session.refresh(document)

    assert document.workflow_status == WorkflowStatus.DRAFT
    assert document.description_status == DescriptionStatus.NEEDS_REVIEW
    assert document.file_access == FileAccess.NEEDS_REVIEW
    assert document.version == 1
    assert document.case.inventory.fund.number == "ДЕМО-1"


def test_parent_with_children_cannot_be_deleted(db_session: Session) -> None:
    fund, _ = _hierarchy(db_session)

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(text("DELETE FROM funds WHERE id = :id"), {"id": fund.id})


def test_enum_check_constraint_rejects_unknown_value(db_session: Session) -> None:
    _, document = _hierarchy(db_session)

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(
                text("UPDATE documents SET file_access = 'public' WHERE id = :id"), {"id": document.id}
            )


def test_search_entry_stores_embedding(db_session: Session) -> None:
    _, document = _hierarchy(db_session)
    entry = SearchEntry(
        object_type="document", object_id=document.id, lang="ru", title="Документ", embedding=[0.1] * EMBEDDING_DIM
    )
    db_session.add(entry)
    db_session.flush()
    db_session.refresh(entry)

    assert len(entry.embedding) == EMBEDDING_DIM


def test_digital_file_access_defaults_to_needs_review(db_session: Session) -> None:
    file = DigitalFile(master_path="demo/a.pdf", mime="application/pdf", size=1, sha256="0" * 64)
    db_session.add(file)
    db_session.flush()
    db_session.refresh(file)

    assert file.access == FileAccess.NEEDS_REVIEW


def test_fund_number_unique_within_archive_even_without_branch(db_session: Session) -> None:
    _hierarchy(db_session)

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(Fund(number="ДЕМО-1", title={"ru": "Дубль"}, type=FundType.ORGANIZATION, is_demo=True))


def test_user_email_unique_case_insensitive(db_session: Session) -> None:
    db_session.add(User(email="demo@example.org", password_hash="x"))
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(User(email="DEMO@example.org", password_hash="x"))


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE documents SET date_from = '1950-01-02', date_to = '1950-01-01' WHERE id = :id",
        "INSERT INTO memorial_dates (id, year, month) VALUES (gen_random_uuid(), 2026, 13)",
        "INSERT INTO historical_events (id, lat) VALUES (gen_random_uuid(), 91)",
    ],
)
def test_range_check_constraints(db_session: Session, statement: str) -> None:
    _, document = _hierarchy(db_session)

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.execute(text(statement), {"id": document.id})
