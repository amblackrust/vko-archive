"""Admin CMS: news, pages, FAQ, legal acts, price list, memorial dates (T6.10) on top of the generic
`admin_common` engine. Registry `KINDS` describes each object type; «Архив памяти» kinds live in
`admin_memory` and use the same functions. HTML bodies are sanitized here, publication is never done here."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import FAQ, LegalAct, MemorialDate, News, Page, PriceListItem
from app.models.enums import WorkflowStatus
from app.repositories import admin_cms as repo
from app.schemas.admin_cms import FaqIn, LegalActIn, MemorialDateIn, NewsIn, PageIn, PriceItemIn
from app.services import admin_common as common
from app.services.admin_common import Spec
from app.services.authz import AuthUser, require
from app.services.errors import Conflict, InvalidInput, NotFound
from app.services.sanitize import clean_html


@dataclass(frozen=True)
class Kind:
    spec: Spec
    title: Callable[[Any], dict[str, str]]
    number: Callable[[Any], str | None]
    search: tuple[str, ...]
    order: tuple[str, ...]
    extra: Callable[[Any], dict[str, Any]] = lambda obj: {}
    # Rich-text fields: HTML is cleaned before it is stored.
    html: tuple[str, ...] = ()
    # field -> owner_type of the uploaded file it may point to (file must belong to this object).
    files: dict[str, str] = field(default_factory=dict)
    # Extra validation of references: (session, existing object or None, values).
    check: Callable[[Session, Any, dict[str, Any]], None] | None = None
    # Deleting is refused while something depends on the object (reason code).
    blockers: Callable[[Session, Any], str | None] = lambda session, obj: None
    # Values shown in the form besides the input fields (links, items).
    extra_values: Callable[[Session, Any], dict[str, Any]] = lambda session, obj: {}


def _check_legal_ref(session: Session, obj: Any, values: dict[str, Any]) -> None:
    ref = values.get("legal_act_id")
    if ref is not None and session.get(LegalAct, ref) is None:
        raise InvalidInput("unknown_link")


def _spec(kind: str, model: type, schema: type, text: tuple[str, ...]) -> Spec:
    create_only = frozenset({"key"}) if kind == "page" else frozenset()
    return Spec(kind, model, schema, "content", text_required=text, create_only=create_only)


KINDS: dict[str, Kind] = {
    "news": Kind(
        _spec("news", News, NewsIn, ("title",)), lambda o: o.title, lambda o: o.slug, ("slug", "title"),
        ("-updated_at",), extra=lambda o: {"category": o.category}, html=("body",), files={"cover_file_id": "news"},
    ),
    "page": Kind(
        _spec("page", Page, PageIn, ("title",)), lambda o: o.title, lambda o: o.key, ("key", "title"),
        ("section", "position", "key"), extra=lambda o: {"section": o.section}, html=("body",),
    ),
    "faq": Kind(
        _spec("faq", FAQ, FaqIn, ("question", "answer")), lambda o: o.question, lambda o: o.category,
        ("category", "question"), ("category", "position"),
    ),
    "legal_act": Kind(
        _spec("legal_act", LegalAct, LegalActIn, ("title",)), lambda o: o.title, lambda o: o.number, ("slug", "title", "number"),
        ("-updated_at",), extra=lambda o: {"status": o.status.value}, files={"file_id": "legal_act"},
    ),
    "price_list_item": Kind(
        _spec("price_list_item", PriceListItem, PriceItemIn, ("name",)), lambda o: o.name, lambda o: o.act_ref,
        ("name", "act_ref"), ("position", "created_at"),
        extra=lambda o: {"price": None if o.price is None else str(o.price)}, check=_check_legal_ref,
    ),
    "memorial_date": Kind(
        _spec("memorial_date", MemorialDate, MemorialDateIn, ("text",)), lambda o: o.text,
        lambda o: f"{o.year}-{o.month:02d}" + (f"-{o.day:02d}" if o.day else ""), ("text", "date_text"),
        ("-year", "-month", "-day"), extra=lambda o: {"year": o.year},
    ),
}


def register(kinds: dict[str, Kind]) -> None:
    KINDS.update(kinds)


def kind_of(name: str) -> Kind:
    kind = KINDS.get(name)
    if kind is None:
        raise NotFound()
    return kind


def _prepare_values(session: Session, kind: Kind, obj: Any, values: dict[str, Any]) -> None:
    for name, value in values.items():
        if isinstance(value, list) and any(isinstance(item, BaseModel) for item in value):
            values[name] = [item.model_dump(mode="json") for item in value]  # JSONB columns take plain dicts
    for name in kind.html:
        if name in values and values[name] is not None:
            values[name] = {lang: clean_html(text) for lang, text in values[name].items()}
    for name, owner_type in kind.files.items():
        file_id = values.get(name)
        if file_id is not None and (obj is None or not repo.file_owned_by(session, file_id, owner_type, obj.id)):
            raise InvalidInput("file_not_owned")  # attach the file after the object exists
    if kind.check is not None:
        kind.check(session, obj, values)


def search(session: Session, user: AuthUser, name: str, *, q: str | None, page: int, page_size: int, ip: str | None) -> tuple[list[Any], int]:
    kind = kind_of(name)
    require(session, user, "content.view", ip=ip)
    return repo.search(session, kind.spec.model, kind.search, kind.order, q=q, offset=(page - 1) * page_size, limit=page_size)


def get(session: Session, user: AuthUser, name: str, object_id: uuid.UUID, *, ip: str | None) -> dict[str, Any]:
    kind = kind_of(name)
    obj = common.load(session, kind.spec, object_id)
    require(session, user, "content.view", obj, ip=ip)
    data = common.present(user, kind.spec, obj, counts={"files": repo.count_files(session, name, obj.id)})
    data["values"].update(kind.extra_values(session, obj))
    return data


def create(session: Session, user: AuthUser, name: str, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    kind = kind_of(name)

    def prepare(values: dict[str, Any]) -> None:
        _prepare_values(session, kind, None, values)
        if name == "page":
            values["slug"] = values["key"]

    obj = common.create(session, user, kind.spec, body, scope=lambda values: None, prepare=prepare, ip=ip)
    return get(session, user, name, obj.id, ip=ip)


def update(session: Session, user: AuthUser, name: str, object_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    kind = kind_of(name)

    def prepare(obj: Any, values: dict[str, Any]) -> None:
        if "slug" in values and values["slug"] != obj.slug and obj.workflow_status == WorkflowStatus.PUBLISHED:
            raise Conflict("slug_locked")
        _prepare_values(session, kind, obj, values)

    common.update(session, user, kind.spec, object_id, body, ip=ip, prepare=prepare)
    return get(session, user, name, object_id, ip=ip)


def delete(session: Session, user: AuthUser, name: str, object_id: uuid.UUID, *, ip: str | None) -> None:
    kind = kind_of(name)

    def blockers(obj: Any) -> str | None:
        if repo.count_files(session, name, obj.id):
            return "has_files"
        return kind.blockers(session, obj)

    common.delete(session, user, kind.spec, object_id, ip=ip, blockers=blockers)
