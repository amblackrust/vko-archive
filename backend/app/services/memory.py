"""Public «Архив памяти» (T5.10-T5.12): collections, persons, chronology, historical map.

Anonymous and published-only. Documents appear only when public (the catalog rule), and a preview
is returned only when the file is open to everyone; links are built here."""

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy.orm import Session

from app.models import Collection, HistoricalEvent, Person
from app.repositories import memory as repo
from app.schemas.memory import (
    CollectionDetail,
    CollectionItem,
    CollectionsResponse,
    EventItem,
    FacetCount,
    MapPointsResponse,
    MemoryDocument,
    PersonDetail,
    PersonItem,
    PersonsResponse,
    SourceRef,
    TimelineResponse,
)
from app.services import files as files_service
from app.services.catalog import _document_item, pick
from app.services.errors import NotFound


def _sources(raw: list[dict]) -> list[SourceRef]:
    return [SourceRef(title=s["title"], url=s.get("url")) for s in raw if s.get("title")]


def _documents(
    session: Session, ids: Sequence[uuid.UUID], lang: str, notes: dict[uuid.UUID, str] | None = None
) -> list[MemoryDocument]:
    rows = repo.public_documents(session, ids)
    out: list[MemoryDocument] = []
    for document_id in ids:
        row = rows.get(document_id)
        if row is None:
            continue
        files = files_service.visible_files(session, None, row.Document)
        out.append(
            MemoryDocument(
                **_document_item(row, lang).model_dump(),
                note=(notes or {}).get(document_id, ""),
                preview_url=next((f.preview_url for f in files if f.preview_url), None),
            )
        )
    return out


def _facets(rows: list[Any]) -> list[FacetCount]:
    return [FacetCount(value=value, count=count) for value, count in rows]


def _collection(collection: Collection, count: int, lang: str) -> CollectionItem:
    title, title_lang = pick(collection.title, lang)
    return CollectionItem(
        slug=collection.slug,
        href=f"/memory/collections/{collection.slug}",
        title=title,
        title_lang=title_lang,
        theme=collection.theme,
        period=collection.period,
        description=pick(collection.description, lang)[0],
        is_demo=collection.is_demo,
        item_count=count,
        translation_missing=title_lang != lang,
    )


def list_collections(session: Session, q: str, theme: str | None, period: str | None, lang: str) -> CollectionsResponse:
    rows = repo.list_collections(session, q.strip(), theme, period)
    counts = repo.public_item_counts(session, [c.id for c in rows])
    return CollectionsResponse(
        items=[_collection(c, counts.get(c.id, 0), lang) for c in rows],
        themes=_facets(repo.collection_facets(session, Collection.theme)),
        periods=_facets(repo.collection_facets(session, Collection.period)),
    )


def get_collection(session: Session, slug: str, lang: str) -> CollectionDetail:
    collection = repo.get_collection(session, slug)
    if collection is None:
        raise NotFound("collection")
    entries = repo.collection_documents(session, collection.id)
    notes = {e.item_id: pick(e.note, lang)[0] for e in entries}
    documents = _documents(session, [e.item_id for e in entries], lang, notes)
    return CollectionDetail(**_collection(collection, len(documents), lang).model_dump(), documents=documents)


def _person(person: Person, lang: str) -> PersonItem:
    name, name_lang = pick(person.name, lang)
    return PersonItem(
        slug=person.slug,
        href=f"/memory/persons/{person.slug}",
        name=name,
        name_lang=name_lang,
        years_text=person.years_text,
        birth_year=person.birth_year,
        death_year=person.death_year,
        bio=pick(person.bio, lang)[0],
        sources=_sources(person.sources),
        is_demo=person.is_demo,
        translation_missing=name_lang != lang,
    )


def list_persons(session: Session, q: str, lang: str) -> PersonsResponse:
    return PersonsResponse(items=[_person(p, lang) for p in repo.list_persons(session, q.strip())])


def get_person(session: Session, slug: str, lang: str) -> PersonDetail:
    person = repo.get_person(session, slug)
    if person is None:
        raise NotFound("person")
    documents = _documents(session, repo.person_document_ids(session, person.id), lang)
    return PersonDetail(**_person(person, lang).model_dump(), documents=documents)


def _events(session: Session, events: list[HistoricalEvent], lang: str) -> list[EventItem]:
    doc_ids = repo.event_document_ids(session, [e.id for e in events])
    items = []
    for event in events:
        title, title_lang = pick(event.title, lang)
        items.append(
            EventItem(
                slug=event.slug,
                href=f"/memory/timeline?event={event.slug}",
                title=title,
                title_lang=title_lang,
                date_text=event.date_text,
                year=event.date_from.year if event.date_from else None,
                theme=event.theme,
                description=pick(event.description, lang)[0],
                place=pick(event.place, lang)[0],
                lat=float(event.lat) if event.lat is not None else None,
                lng=float(event.lng) if event.lng is not None else None,
                sources=_sources(event.sources),
                is_demo=event.is_demo,
                translation_missing=title_lang != lang,
                documents=_documents(session, doc_ids.get(event.id, []), lang),
            )
        )
    return items


def _event_themes(events: list[HistoricalEvent]) -> list[FacetCount]:
    counts: dict[str, int] = {}
    for event in events:
        if event.theme:
            counts[event.theme] = counts.get(event.theme, 0) + 1
    return [FacetCount(value=v, count=n) for v, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


def timeline(session: Session, lang: str) -> TimelineResponse:
    events = repo.list_events(session, dated=True, mapped=False)
    return TimelineResponse(items=_events(session, events, lang), themes=_event_themes(events))


def map_points(session: Session, lang: str) -> MapPointsResponse:
    events = repo.list_events(session, dated=False, mapped=True)
    return MapPointsResponse(items=_events(session, events, lang), themes=_event_themes(events))
