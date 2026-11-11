"""Catalog hierarchy queries (T3.9): fund -> inventory -> case, published levels only.

A level is visible only while all its parents are published too. Counts include only
public documents (see `repositories.catalog.PUBLIC_DOCUMENT`) in published cases.
"""

import uuid
from typing import Any

from sqlalchemy import ColumnElement, Numeric, Select, Text, and_, case, cast, exists, func, literal_column, or_, select
from sqlalchemy.orm import Session

from app.models import Branch, Case, Document, Fund, Inventory, Newspaper
from app.repositories.catalog import PUBLIC_DOCUMENT, PUBLISHED, ilike, i18n_text, title_text
from app.schemas.catalog import FundListParams


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


# pg_trgm word similarity from which a query word counts as a typo of a word in the text: one wrong
# letter in a word of 7+ letters (the default 0.6 would need 11+).
TYPO_SIMILARITY = 0.45


def _text_clauses(
    session: Session, haystack: ColumnElement[str], q: str, *where: ColumnElement[bool]
) -> list[ColumnElement[bool]]:
    """Conditions for "every word of `q` is in the text". Words match as substrings; only if that
    finds nothing (within `where`) may words of 5+ letters also be a typo away."""
    tokens = q.split()
    exact = [ilike(haystack, token) for token in tokens]
    if not tokens or session.scalar(select(exists().where(*where, *exact))):
        return exact
    return [
        or_(clause, func.word_similarity(token, haystack) >= TYPO_SIMILARITY) if len(token) >= 5 else clause
        for token, clause in zip(tokens, exact, strict=True)
    ]


def _former_names() -> ColumnElement[str]:
    """All names of the fund as one searchable string."""
    return cast(func.jsonb_path_query_array(Fund.former_names, literal_column("'$[*].name'::jsonpath")), Text)


def list_funds(session: Session, p: FundListParams) -> tuple[int, list[Any], str]:
    """(total, rows, effective sort) of the published funds for one page."""
    where: list[ColumnElement[bool]] = [Fund.workflow_status == PUBLISHED]
    if p.type:
        where.append(Fund.type == p.type)
    if p.branch_id:
        where.append(Fund.branch_id == p.branch_id)
    if p.category:
        where.append(Fund.category == p.category)
    first, last = p.year or p.year_from, p.year or p.year_to  # overlap with [dates_from, dates_to or still open]
    if last is not None:
        where.append(Fund.dates_from <= last)
    if first is not None:
        where.append(or_(Fund.dates_to >= first, and_(Fund.dates_to.is_(None), Fund.dates_from.is_not(None))))
    haystack = func.concat_ws(" ", Fund.number, i18n_text(Fund.title), _former_names())
    where += _text_clauses(session, haystack, p.q, *where)

    # Natural order of numbers («Р-2» before «Р-10»): the main list «Р-…» first, then party funds «…П»,
    # demo funds last.
    digits = func.regexp_replace(Fund.number, r"\D", "", "g")
    prefix = func.regexp_replace(Fund.number, r"\d", "", "g")
    by_number = [Fund.is_demo, prefix.desc(), cast(func.nullif(digits, ""), Numeric), Fund.number]
    phrase = p.q.strip()
    sort = p.sort if p.sort != "relevance" or phrase else "number"
    if sort == "relevance":  # the number itself, then the current name, then a former name, then the rest
        order = [
            case(
                (or_(func.lower(Fund.number) == phrase.lower(), digits == phrase), 0),
                (ilike(i18n_text(Fund.title), phrase), 1),
                (ilike(_former_names(), phrase), 2),
                else_=3,
            ),
            *by_number,
        ]
    elif sort == "title":
        order = [func.lower(title_text(Fund.title, p.lang))]
    elif sort == "year":
        order = [Fund.dates_from.asc().nulls_last(), *by_number]
    else:
        order = by_number
    stmt = (
        select(Fund, _inventory_count().label("inventory_count"), _doc_count_in_fund().label("document_count"))
        .where(*where)
        .order_by(*order, Fund.id)
    )
    return *_paginate(session, stmt, select(func.count(Fund.id)).where(*where), p.page, p.per_page), sort


def list_newspapers(session: Session, q: str, year: int | None, page: int, per_page: int) -> tuple[int, list[Any]]:
    where = [Newspaper.years_covered.contains([year])] if year is not None else []
    where += _text_clauses(session, func.concat_ws(" ", Newspaper.title, Newspaper.publisher), q, *where)
    stmt = select(Newspaper).where(*where).order_by(func.lower(Newspaper.title), Newspaper.year_from, Newspaper.id)
    return _paginate(session, stmt, select(func.count(Newspaper.id)).where(*where), page, per_page)


def get_fund(session: Session, fund_id: uuid.UUID) -> Any | None:
    """The published fund with its counts and its branch (None unless the branch has a public page)."""
    public_branch = and_(Branch.id == Fund.branch_id, Branch.workflow_status == PUBLISHED, Branch.slug.is_not(None))
    stmt = (
        select(Fund, _inventory_count().label("inventory_count"), _doc_count_in_fund().label("document_count"), Branch)
        .outerjoin(Branch, public_branch)
        .where(Fund.id == fund_id, Fund.workflow_status == PUBLISHED)
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
