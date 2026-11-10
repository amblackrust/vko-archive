"""Public catalog (T3.3, T3.4, T3.9). Everything here is anonymous and public-only:
visibility is decided by the repositories (published + description_status=public, published
parent chain); items never carry file paths, only the access status. Links are built here."""

import math
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Case, Document, Fund, Inventory
from app.repositories import catalog as repo
from app.repositories import catalog_tree as tree
from app.schemas.catalog import (
    DocumentDetail,
    DocumentFile,
    TagRef,
    CaseDetail,
    CaseItem,
    CasesResponse,
    CatalogFacets,
    CatalogFilters,
    DocumentItem,
    DocumentPage,
    DocumentsResponse,
    FacetValue,
    FundDetail,
    FundItem,
    FundListParams,
    FundsResponse,
    InventoriesResponse,
    InventoryDetail,
    InventoryItem,
    PageParams,
    Ref,
)
from app.repositories import files as files_repo
from app.services import files as files_service
from app.services import search_log
from app.services.authz import AuthUser
from app.services.errors import NotFound

_FALLBACK = ("ru", "kk", "en")


def pick(value: dict[str, str] | None, lang: str) -> tuple[str, str]:
    """(text, language of the text): requested language, then ru, kk, en."""
    for candidate in (lang, *_FALLBACK):
        text = ((value or {}).get(candidate) or "").strip()
        if text:
            return text, candidate
    return "", lang


def _pages(total: int, per_page: int) -> int:
    return max(1, math.ceil(total / per_page))


def _page(total: int, page: int, per_page: int) -> dict[str, int]:
    return {"total": total, "page": page, "per_page": per_page, "pages": _pages(total, per_page)}


def _ref(href: str, number: str, title: dict[str, str], id: uuid.UUID, lang: str) -> Ref:
    return Ref(id=id, number=number, title=pick(title, lang)[0], href=href)


def _fund_ref(fund_id: uuid.UUID, number: str, title: dict[str, str], lang: str) -> Ref:
    return _ref(f"/catalog/funds/{fund_id}", number, title, fund_id, lang)


def _inventory_ref(inventory_id: uuid.UUID, number: str, title: dict[str, str], lang: str) -> Ref:
    return _ref(f"/catalog/inventories/{inventory_id}", number, title, inventory_id, lang)


def _case_ref(case_id: uuid.UUID, number: str, title: dict[str, str], lang: str) -> Ref:
    return _ref(f"/catalog/cases/{case_id}", number, title, case_id, lang)


def _document_item(row: Any, lang: str) -> DocumentItem:
    document: Document = row.Document
    title, title_lang = pick(document.title, lang)
    in_chain = row.case_id is not None  # chain columns are NULL unless fund, inventory and case are published
    return DocumentItem(
        id=document.id,
        title=title,
        title_lang=title_lang,
        href=f"/catalog/documents/{document.id}",
        archive_code=document.archive_code,
        date_text=document.date_text,
        doc_type=document.doc_type,
        period=document.period,
        language=document.language,
        authors=pick(document.authors, lang)[0],
        places=[text for place in document.places if (text := pick(place, lang)[0])],
        sheets_count=document.sheets_count,
        file_access=document.file_access.value,
        has_digital_copy=document.has_digital_copy,
        branch_id=document.branch_id,
        is_demo=document.is_demo,
        fund=_fund_ref(row.fund_id, row.fund_number, row.fund_title, lang) if in_chain else None,
        inventory=_inventory_ref(row.inventory_id, row.inventory_number, row.inventory_title, lang) if in_chain else None,
        case=_case_ref(row.case_id, row.case_number, row.case_title, lang) if in_chain else None,
    )


def _facet_values(rows: list[Any]) -> list[FacetValue]:
    return [FacetValue(value=str(value), count=count) for value, count in rows]


def search_documents(session: Session, filters: CatalogFilters) -> DocumentsResponse:
    total, rows, sort = repo.search_documents(session, filters)
    raw = repo.facets(session, filters)
    lang = filters.lang
    branches = [
        FacetValue(value=str(branch_id), label=pick(raw["branch_names"][branch_id], lang)[0], count=count)
        for branch_id, count in raw["branch"]
        if branch_id in raw["branch_names"]  # only published branches are offered
    ]
    topics = [
        FacetValue(value=str(tag_id), label=pick(name, lang)[0], count=count) for tag_id, name, count in raw["topic"]
    ]
    facets = CatalogFacets(
        doc_type=_facet_values(raw["doc_type"]),
        period=sorted(_facet_values(raw["period"]), key=lambda v: v.value),
        language=_facet_values(raw["language"]),
        branch=branches,
        topic=topics,
        fund_type=_facet_values(raw["fund_type"]),
        category=[FacetValue(value=key, count=count) for key, count in raw["category"].items()],
        with_digital_copy=raw["with_digital_copy"],
    )
    # Only page 1 is logged (paging is not a new search); filters alone count when nothing was found.
    query = filters.q or filters.title or filters.keyword
    if filters.page == 1 and (query.strip() or total == 0):
        search_log.log_search(session, query=query, lang=lang, source="catalog", results_count=total)
    return DocumentsResponse(
        **_page(total, filters.page, filters.per_page),
        items=[_document_item(row, lang) for row in rows],
        facets=facets,
        sort=sort,
    )


def _fund_item(fund: Fund, inventory_count: int, document_count: int, lang: str) -> FundItem:
    title, title_lang = pick(fund.title, lang)
    return FundItem(
        id=fund.id,
        number=fund.number,
        title=title,
        title_lang=title_lang,
        type=fund.type.value,
        dates_from=fund.dates_from,
        dates_to=fund.dates_to,
        branch_id=fund.branch_id,
        annotation=pick(fund.annotation, lang)[0],
        is_demo=fund.is_demo,
        inventory_count=inventory_count,
        document_count=document_count,
        href=f"/catalog/funds/{fund.id}",
    )


def _inventory_item(inventory: Inventory, fund: Fund, case_count: int, document_count: int, lang: str) -> InventoryItem:
    title, title_lang = pick(inventory.title, lang)
    return InventoryItem(
        id=inventory.id,
        number=inventory.number,
        title=title,
        title_lang=title_lang,
        dates_text=inventory.dates_text,
        is_demo=inventory.is_demo,
        case_count=case_count,
        document_count=document_count,
        href=f"/catalog/inventories/{inventory.id}",
        fund=_fund_ref(fund.id, fund.number, fund.title, lang),
    )


def _case_item(case: Case, inventory: Inventory, fund: Fund, document_count: int, lang: str) -> CaseItem:
    title, title_lang = pick(case.title, lang)
    return CaseItem(
        id=case.id,
        number=case.number,
        title=title,
        title_lang=title_lang,
        dates_text=case.dates_text,
        sheets_count=case.sheets_count,
        is_demo=case.is_demo,
        document_count=document_count,
        href=f"/catalog/cases/{case.id}",
        inventory=_inventory_ref(inventory.id, inventory.number, inventory.title, lang),
        fund=_fund_ref(fund.id, fund.number, fund.title, lang),
    )


def list_funds(session: Session, params: FundListParams) -> FundsResponse:
    total, rows = tree.list_funds(session, params.q, params.type, params.branch_id, params.page, params.per_page)
    return FundsResponse(
        **_page(total, params.page, params.per_page),
        items=[_fund_item(r.Fund, r.inventory_count, r.document_count, params.lang) for r in rows],
    )


def get_fund(session: Session, fund_id: uuid.UUID, lang: str) -> FundDetail:
    row = tree.get_fund(session, fund_id)
    if row is None:
        raise NotFound()
    fund_item = _fund_item(row.Fund, row.inventory_count, row.document_count, lang)
    inventories = [
        _inventory_item(r.Inventory, row.Fund, r.case_count, r.document_count, lang)
        for r in tree.fund_inventories(session, fund_id)
    ]
    return FundDetail(**fund_item.model_dump(), inventories=inventories)


def list_inventories(session: Session, params: PageParams) -> InventoriesResponse:
    total, rows = tree.list_inventories(session, params.q, params.page, params.per_page)
    return InventoriesResponse(
        **_page(total, params.page, params.per_page),
        items=[_inventory_item(r.Inventory, r.Fund, r.case_count, r.document_count, params.lang) for r in rows],
    )


def _cases_response(session: Session, q: str, inventory_id: uuid.UUID | None, params: PageParams) -> CasesResponse:
    total, rows = tree.list_cases(session, q, inventory_id, params.page, params.per_page)
    return CasesResponse(
        **_page(total, params.page, params.per_page),
        items=[_case_item(r.Case, r.Inventory, r.Fund, r.document_count, params.lang) for r in rows],
    )


def get_inventory(session: Session, inventory_id: uuid.UUID, params: PageParams) -> InventoryDetail:
    row = tree.get_inventory(session, inventory_id)
    if row is None:
        raise NotFound()
    item = _inventory_item(row.Inventory, row.Fund, row.case_count, row.document_count, params.lang)
    return InventoryDetail(**item.model_dump(), cases=_cases_response(session, params.q, inventory_id, params))


def list_cases(session: Session, params: PageParams) -> CasesResponse:
    return _cases_response(session, params.q, None, params)


def get_case(session: Session, case_id: uuid.UUID, params: PageParams) -> CaseDetail:
    row = tree.get_case(session, case_id)
    if row is None:
        raise NotFound()
    item = _case_item(row.Case, row.Inventory, row.Fund, row.document_count, params.lang)
    filters = CatalogFilters(lang=params.lang, q=params.q, sort="code", page=params.page, per_page=params.per_page)
    total, rows, _ = repo.search_documents(session, filters, case_id=case_id)
    documents = DocumentPage(
        **_page(total, params.page, params.per_page), items=[_document_item(r, params.lang) for r in rows]
    )
    return CaseDetail(**item.model_dump(), documents=documents)


RELATED_LIMIT = 6


def _related(session: Session, row: Any, tags: list[Any], lang: str) -> list[DocumentItem]:
    """Other public documents: the same case first, then those sharing a topic."""
    document: Document = row.Document
    found: dict[uuid.UUID, DocumentItem] = {}
    queries = []
    if document.case_id is not None:
        queries.append(({"sort": "code"}, document.case_id))
    if tags:
        queries.append(({"sort": "code", "topic": [tag.id for tag in tags]}, None))
    for extra, case_id in queries:
        filters = CatalogFilters(lang=lang, per_page=RELATED_LIMIT + 1, **extra)
        for related in repo.search_documents(session, filters, case_id=case_id)[1]:
            if related.Document.id != document.id and len(found) < RELATED_LIMIT:
                found.setdefault(related.Document.id, _document_item(related, lang))
    return list(found.values())


def get_document(session: Session, user: AuthUser | None, document_id: uuid.UUID, lang: str) -> DocumentDetail:
    """Public document card. Not public (draft, needs review, do_not_publish) or unknown -> 404."""
    row = repo.get_public_document(session, document_id)
    if row is None:
        raise NotFound()
    document: Document = row.Document
    tags = repo.published_tags(session, document.id)
    visible = {ref.id: ref for ref in files_service.visible_files(session, user, document)}
    files = [
        DocumentFile(
            id=file.id,
            position=file.position,
            mime=visible[file.id].mime,
            pages=file.pages,
            url=visible[file.id].url,
            preview_url=visible[file.id].preview_url,
            caption=pick(file.caption, lang)[0],
            ocr_text=file.ocr_text or None,
        )
        for file in files_repo.files_of_owner(session, "document", document.id)
        if file.id in visible
    ]
    branch_names = repo.published_branch_names(session, [document.branch_id] if document.branch_id else [])
    return DocumentDetail(
        **_document_item(row, lang).model_dump(),
        historical_note=pick(document.historical_note, lang)[0],
        summary=pick(document.summary, lang)[0],
        storage_location=document.storage_location,
        access_conditions=pick(document.access_conditions, lang)[0],
        branch=pick(branch_names[document.branch_id], lang)[0] if document.branch_id in branch_names else None,
        tags=[TagRef(id=tag.id, name=pick(tag.name, lang)[0], href=f"/catalog?topic={tag.id}") for tag in tags],
        files=files,
        related=_related(session, row, tags, lang),
    )
