"""Catalog queries (T3.3): public documents with the 12 ТЗ filters, sorting and facets.

Visibility lives here, in one place, for the list, the counts and the facets:
- a document is public when it is published and `description_status = public`
  (SQL twin of `services.indexing.document_is_public`, cross-checked by a test);
- the fund -> inventory -> case chain of a document is joined only while every level is
  published, so a hidden fund/inventory/case never appears as a filter match or a link.
All user text is a bound parameter; LIKE wildcards in it are escaped.
"""

import uuid
from collections.abc import Sequence
from datetime import date
from typing import Any

from sqlalchemy import (
    ColumnElement,
    Select,
    String,
    Text,
    and_,
    case,
    cast,
    distinct,
    exists,
    extract,
    func,
    literal,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.models import Branch, Case, Document, Fund, Inventory, Tag, document_tags
from app.models.enums import DescriptionStatus, WorkflowStatus
from app.schemas.catalog import CatalogFilters

LANGS = ("kk", "ru", "en")
PUBLISHED = WorkflowStatus.PUBLISHED

PUBLIC_DOCUMENT = and_(
    Document.workflow_status == PUBLISHED, Document.description_status == DescriptionStatus.PUBLIC
)

# Visible chain of a case: all three levels published.
CHAIN = (
    select(
        Case.id.label("case_id"),
        Case.number.label("case_number"),
        Case.title.label("case_title"),
        Inventory.id.label("inventory_id"),
        Inventory.number.label("inventory_number"),
        Inventory.title.label("inventory_title"),
        Fund.id.label("fund_id"),
        Fund.number.label("fund_number"),
        Fund.title.label("fund_title"),
        Fund.type.label("fund_type"),
    )
    .join(Inventory, Inventory.id == Case.inventory_id)
    .join(Fund, Fund.id == Inventory.fund_id)
    .where(Case.workflow_status == PUBLISHED, Inventory.workflow_status == PUBLISHED, Fund.workflow_status == PUBLISHED)
    .subquery("chain")
)

# ТЗ §5.3 entry groups -> condition on the document and its visible fund.
_HISTORICAL_BEFORE = date(1992, 1, 1)
CATEGORY_CLAUSES: dict[str, ColumnElement[bool]] = {
    "historical": Document.date_from < _HISTORICAL_BEFORE,
    "photos": Document.doc_type == "photo",
    "maps": Document.doc_type.in_(("map", "drawing")),
    "written": Document.doc_type.not_in(("photo", "map", "drawing", "audio", "video")),
    "organizations": CHAIN.c.fund_type.in_(("organization", "party")),
    "personal": or_(CHAIN.c.fund_type == "personal", Document.doc_type == "personal"),
    "audio_video": Document.doc_type.in_(("audio", "video")),
}


def _like(value: str) -> str:
    escaped = value.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def ilike(expr: ColumnElement, value: str) -> ColumnElement[bool]:
    return expr.ilike(_like(value), escape="\\")


def i18n_text(column: Any) -> ColumnElement[str]:
    """All translations of an I18n column as one searchable string."""
    return func.concat_ws(" ", *(column[lang].astext for lang in LANGS))


def _tag_names() -> ColumnElement[str]:
    """Names of the document's published tags (topics / keywords)."""
    return (
        select(func.coalesce(func.string_agg(cast(Tag.name, Text), literal(" ")), ""))
        .join(document_tags, document_tags.c.tag_id == Tag.id)
        .where(document_tags.c.document_id == Document.id, Tag.workflow_status == PUBLISHED)
        .correlate(Document)
        .scalar_subquery()
    )


def _clauses(f: CatalogFilters, skip: str | None = None) -> list[ColumnElement[bool]]:
    """WHERE conditions of the filters; `skip` leaves one dimension out (disjunctive facets)."""
    out: list[ColumnElement[bool]] = []
    for token in f.q.split():
        haystack = func.concat_ws(
            " ",
            i18n_text(Document.title),
            Document.archive_code,
            i18n_text(Document.authors),
            i18n_text(Document.summary),
            cast(Document.places, Text),
            _tag_names(),
        )
        out.append(ilike(haystack, token))
    if f.title:
        out.append(ilike(i18n_text(Document.title), f.title))
    if f.fund_number:
        out.append(func.lower(CHAIN.c.fund_number) == f.fund_number.strip().lower())
    if f.inventory_number:
        out.append(func.lower(CHAIN.c.inventory_number) == f.inventory_number.strip().lower())
    if f.case_number:
        out.append(func.lower(CHAIN.c.case_number) == f.case_number.strip().lower())
    if f.period and skip != "period":
        out.append(Document.period.in_(f.period))
    if f.year is not None:
        out.append(
            and_(
                extract("year", Document.date_from) <= f.year,
                f.year <= extract("year", func.coalesce(Document.date_to, Document.date_from)),
            )
        )
    if f.date_from:  # overlap of [date_from, date_to] with the requested range
        out.append(func.coalesce(Document.date_to, Document.date_from) >= f.date_from)
    if f.date_to:
        out.append(Document.date_from <= f.date_to)
    if f.author:
        out.append(ilike(i18n_text(Document.authors), f.author))
    if f.topic and skip != "topic":
        out.append(
            exists().where(
                document_tags.c.document_id == Document.id,
                document_tags.c.tag_id.in_(f.topic),
                document_tags.c.tag_id.in_(select(Tag.id).where(Tag.workflow_status == PUBLISHED)),
            )
        )
    if f.place:
        out.append(ilike(cast(Document.places, Text), f.place))
    if f.keyword:
        out.append(ilike(func.concat_ws(" ", i18n_text(Document.summary), _tag_names()), f.keyword))
    if f.doc_type and skip != "doc_type":
        out.append(Document.doc_type.in_(f.doc_type))
    if f.branch_id and skip != "branch":
        out.append(Document.branch_id.in_(f.branch_id))
    if f.category and skip != "category":
        out.append(CATEGORY_CLAUSES[f.category])
    if f.fund_type and skip != "fund_type":
        out.append(CHAIN.c.fund_type.in_(f.fund_type))
    if f.language and skip != "language":
        out.append(Document.language.in_(f.language))
    if f.has_digital_copy is not None and skip != "with_digital_copy":
        out.append(Document.has_digital_copy.is_(f.has_digital_copy))
    return out


def _public_documents(stmt: Select, clauses: Sequence[ColumnElement[bool]]) -> Select:
    return (
        stmt.select_from(Document)
        .outerjoin(CHAIN, CHAIN.c.case_id == Document.case_id)
        .where(PUBLIC_DOCUMENT, *clauses)
    )


def _title(lang: str) -> ColumnElement[str]:
    return func.coalesce(
        func.nullif(Document.title[lang].astext, ""),
        func.nullif(Document.title["ru"].astext, ""),
        func.nullif(Document.title["kk"].astext, ""),
        Document.title["en"].astext,
        "",
    )


def _order_by(f: CatalogFilters) -> tuple[list[ColumnElement], str]:
    has_text = bool(f.q.strip() or f.title.strip() or f.keyword.strip())
    sort = f.sort
    if sort == "relevance" and not has_text:
        sort = "code"
    if sort == "relevance":
        phrase = (f.q or f.title or f.keyword).strip()
        rank = case(
            (ilike(i18n_text(Document.title), phrase), 0),
            (ilike(func.coalesce(Document.archive_code, ""), phrase), 1),
            else_=2,
        )
        order = [rank, Document.date_from.asc().nulls_last()]
    elif sort == "date_asc":
        order = [Document.date_from.asc().nulls_last()]
    elif sort == "date_desc":
        order = [Document.date_from.desc().nulls_last()]
    elif sort == "title":
        order = [func.lower(_title(f.lang))]
    else:
        order = [Document.archive_code.asc().nulls_last()]
    return [*order, Document.id], sort


def search_documents(
    session: Session, f: CatalogFilters, *, case_id: uuid.UUID | None = None
) -> tuple[int, list[Any], str]:
    """(total, rows of (Document, chain columns), effective sort) for one page."""
    clauses = _clauses(f)
    if case_id is not None:
        clauses.append(Document.case_id == case_id)
    total = session.scalar(_public_documents(select(func.count(Document.id)), clauses)) or 0
    order, sort = _order_by(f)
    stmt = _public_documents(select(Document, CHAIN), clauses).order_by(*order)
    rows = session.execute(stmt.limit(f.per_page).offset((f.page - 1) * f.per_page)).all()
    return total, rows, sort


def _grouped(session: Session, f: CatalogFilters, skip: str, *columns: Any) -> list[Any]:
    stmt = _public_documents(select(*columns, func.count(Document.id)), _clauses(f, skip))
    return list(session.execute(stmt.group_by(*columns).order_by(func.count(Document.id).desc(), *columns)).all())


def facets(session: Session, f: CatalogFilters) -> dict[str, Any]:
    """Counts per filter dimension, each computed with every filter except its own."""
    categories = {}
    for key, clause in CATEGORY_CLAUSES.items():
        stmt = _public_documents(select(func.count(Document.id)), [*_clauses(f, "category"), clause])
        categories[key] = session.scalar(stmt) or 0
    topic_stmt = _public_documents(
        select(Tag.id, Tag.name, func.count(distinct(Document.id))), _clauses(f, "topic")
    )
    topics = session.execute(
        topic_stmt.join(document_tags, document_tags.c.document_id == Document.id)
        .join(Tag, Tag.id == document_tags.c.tag_id)
        .where(Tag.workflow_status == PUBLISHED)
        .group_by(Tag.id, Tag.name)
        .order_by(func.count(distinct(Document.id)).desc(), Tag.id)
    ).all()
    branch_ids = [row[0] for row in _grouped(session, f, "branch", Document.branch_id) if row[0]]
    return {
        "doc_type": [r for r in _grouped(session, f, "doc_type", Document.doc_type) if r[0]],
        "period": [r for r in _grouped(session, f, "period", Document.period) if r[0]],
        "language": [r for r in _grouped(session, f, "language", Document.language) if r[0]],
        "branch": [r for r in _grouped(session, f, "branch", Document.branch_id) if r[0]],
        "fund_type": [r for r in _grouped(session, f, "fund_type", cast(CHAIN.c.fund_type, String)) if r[0]],
        "topic": list(topics),
        "category": categories,
        "with_digital_copy": session.scalar(
            _public_documents(
                select(func.count(Document.id)), [*_clauses(f, "with_digital_copy"), Document.has_digital_copy.is_(True)]
            )
        )
        or 0,
        "branch_names": published_branch_names(session, branch_ids),
    }


def published_branch_names(session: Session, ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, dict[str, str]]:
    if not ids:
        return {}
    rows = session.execute(select(Branch.id, Branch.name).where(Branch.id.in_(ids), Branch.workflow_status == PUBLISHED))
    return {row.id: row.name for row in rows}


def get_public_document(session: Session, document_id: uuid.UUID) -> Any | None:
    """Row of (Document, chain columns) when the document is public, else None."""
    stmt = _public_documents(select(Document, CHAIN), [Document.id == document_id])
    return session.execute(stmt).first()


def published_tags(session: Session, document_id: uuid.UUID) -> list[Tag]:
    stmt = (
        select(Tag)
        .join(document_tags, document_tags.c.tag_id == Tag.id)
        .where(document_tags.c.document_id == document_id, Tag.workflow_status == PUBLISHED)
        .order_by(Tag.id)
    )
    return list(session.scalars(stmt))
