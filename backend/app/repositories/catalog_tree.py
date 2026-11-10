"""Catalog hierarchy queries (T3.9): fund -> inventory -> case, published levels only.

A level is visible only while all its parents are published too. Counts include only
public documents (see `repositories.catalog.PUBLIC_DOCUMENT`) in published cases.
"""

import uuid
from typing import Any

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import Session

from app.models import Case, Document, Fund, Inventory
from app.repositories.catalog import PUBLIC_DOCUMENT, PUBLISHED, ilike, i18n_text


def _case_documents(*where: ColumnElement[bool]) -> Select:
    return (
        select(func.count(Document.id))
        .join(Case, Case.id == Document.case_id)
        .where(PUBLIC_DOCUMENT, Case.workflow_status == PUBLISHED, *where)
    )


def _doc_count_in_inventory() -> ColumnElement[int]:
    return _case_documents(Case.inventory_id == Inventory.id).correlate(Inventory).scalar_subquery()


def _doc_count_in_fund() -> ColumnElement[int]:
    stmt = _case_documents(Inventory.fund_id == Fund.id, Inventory.workflow_status == PUBLISHED)
    return stmt.join(Inventory, Inventory.id == Case.inventory_id).correlate(Fund).scalar_subquery()


def _doc_count_in_case() -> ColumnElement[int]:
    return select(func.count(Document.id)).where(PUBLIC_DOCUMENT, Document.case_id == Case.id).correlate(Case).scalar_subquery()


def _inventory_count() -> ColumnElement[int]:
    return (
        select(func.count(Inventory.id))
        .where(Inventory.fund_id == Fund.id, Inventory.workflow_status == PUBLISHED)
        .correlate(Fund)
        .scalar_subquery()
    )


def _case_count() -> ColumnElement[int]:
    return (
        select(func.count(Case.id))
        .where(Case.inventory_id == Inventory.id, Case.workflow_status == PUBLISHED)
        .correlate(Inventory)
        .scalar_subquery()
    )


def _natural(number: Any) -> list[Any]:
    return [func.length(number), number]


def _paginate(session: Session, stmt: Select, count_stmt: Select, page: int, per_page: int) -> tuple[int, list[Any]]:
    total = session.scalar(count_stmt) or 0
    return total, list(session.execute(stmt.limit(per_page).offset((page - 1) * per_page)).all())


def list_funds(
    session: Session, q: str, fund_type: str | None, branch_id: uuid.UUID | None, page: int, per_page: int
) -> tuple[int, list[Any]]:
    where: list[ColumnElement[bool]] = [Fund.workflow_status == PUBLISHED]
    for token in q.split():
        where.append(ilike(func.concat_ws(" ", Fund.number, i18n_text(Fund.title)), token))
    if fund_type:
        where.append(Fund.type == fund_type)
    if branch_id:
        where.append(Fund.branch_id == branch_id)
    stmt = (
        select(Fund, _inventory_count().label("inventory_count"), _doc_count_in_fund().label("document_count"))
        .where(*where)
        .order_by(*_natural(Fund.number), Fund.id)
    )
    return _paginate(session, stmt, select(func.count(Fund.id)).where(*where), page, per_page)


def get_fund(session: Session, fund_id: uuid.UUID) -> Any | None:
    stmt = select(Fund, _inventory_count().label("inventory_count"), _doc_count_in_fund().label("document_count")).where(
        Fund.id == fund_id, Fund.workflow_status == PUBLISHED
    )
    return session.execute(stmt).first()


def fund_inventories(session: Session, fund_id: uuid.UUID) -> list[Any]:
    stmt = (
        select(Inventory, _case_count().label("case_count"), _doc_count_in_inventory().label("document_count"))
        .where(Inventory.fund_id == fund_id, Inventory.workflow_status == PUBLISHED)
        .order_by(*_natural(Inventory.number), Inventory.id)
    )
    return list(session.execute(stmt).all())


def list_inventories(session: Session, q: str, page: int, per_page: int) -> tuple[int, list[Any]]:
    where: list[ColumnElement[bool]] = [Inventory.workflow_status == PUBLISHED, Fund.workflow_status == PUBLISHED]
    for token in q.split():
        where.append(ilike(func.concat_ws(" ", Inventory.number, i18n_text(Inventory.title), Fund.number), token))
    stmt = (
        select(Inventory, Fund, _case_count().label("case_count"), _doc_count_in_inventory().label("document_count"))
        .join(Fund, Fund.id == Inventory.fund_id)
        .where(*where)
        .order_by(*_natural(Fund.number), *_natural(Inventory.number), Inventory.id)
    )
    count_stmt = select(func.count(Inventory.id)).join(Fund, Fund.id == Inventory.fund_id).where(*where)
    return _paginate(session, stmt, count_stmt, page, per_page)


def get_inventory(session: Session, inventory_id: uuid.UUID) -> Any | None:
    stmt = (
        select(Inventory, Fund, _case_count().label("case_count"), _doc_count_in_inventory().label("document_count"))
        .join(Fund, Fund.id == Inventory.fund_id)
        .where(Inventory.id == inventory_id, Inventory.workflow_status == PUBLISHED, Fund.workflow_status == PUBLISHED)
    )
    return session.execute(stmt).first()


def _case_select() -> Select:
    return (
        select(Case, Inventory, Fund, _doc_count_in_case().label("document_count"))
        .join(Inventory, Inventory.id == Case.inventory_id)
        .join(Fund, Fund.id == Inventory.fund_id)
        .where(Case.workflow_status == PUBLISHED, Inventory.workflow_status == PUBLISHED, Fund.workflow_status == PUBLISHED)
    )


def list_cases(
    session: Session, q: str, inventory_id: uuid.UUID | None, page: int, per_page: int
) -> tuple[int, list[Any]]:
    where: list[ColumnElement[bool]] = []
    for token in q.split():
        where.append(ilike(func.concat_ws(" ", Case.number, i18n_text(Case.title)), token))
    if inventory_id:
        where.append(Case.inventory_id == inventory_id)
    stmt = _case_select().where(*where).order_by(*_natural(Fund.number), *_natural(Inventory.number), *_natural(Case.number), Case.id)
    count_stmt = (
        select(func.count(Case.id))
        .join(Inventory, Inventory.id == Case.inventory_id)
        .join(Fund, Fund.id == Inventory.fund_id)
        .where(Case.workflow_status == PUBLISHED, Inventory.workflow_status == PUBLISHED, Fund.workflow_status == PUBLISHED, *where)
    )
    return _paginate(session, stmt, count_stmt, page, per_page)


def get_case(session: Session, case_id: uuid.UUID) -> Any | None:
    return session.execute(_case_select().where(Case.id == case_id)).first()
