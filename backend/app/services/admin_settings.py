"""Site settings (social links, widgets, survey, counter, useful links) and search synonyms (T6.10).
Administrators only: `settings.edit`. Every change is journaled without values."""

import logging
import uuid
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models import SiteSetting, Synonym
from app.models.enums import AuditResult
from app.repositories import admin_cms as repo
from app.schemas.admin_cms import SETTING_MODELS, SettingBody, SynonymIn, SynonymPatch
from app.services import admin_common as common
from app.services import audit
from app.services.authz import AuthUser, require
from app.services.errors import InvalidInput, NotFound

logger = logging.getLogger(__name__)


def list_settings(session: Session, user: AuthUser, *, ip: str | None) -> dict[str, Any]:
    require(session, user, "settings.edit", ip=ip)
    rows = repo.settings_rows(session, list(SETTING_MODELS))
    result = {}
    for key, model in SETTING_MODELS.items():
        try:
            result[key] = (model.model_validate(rows[key].value) if key in rows else model()).model_dump(mode="json")
        except ValidationError:
            # A value stored in an older shape must not break the page; saving replaces it.
            logger.warning("site setting %s has an unexpected shape, showing defaults", key)
            result[key] = model().model_dump(mode="json")
    return result


def put_setting(session: Session, user: AuthUser, key: str, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    require(session, user, "settings.edit", ip=ip)
    model = SETTING_MODELS.get(key)
    if model is None:
        raise NotFound()
    try:
        value = model.model_validate(SettingBody.model_validate(body).value).model_dump(mode="json")
    except ValidationError as exc:
        raise InvalidInput("invalid_input") from exc
    row = repo.get_setting(session, key)
    if row is None:
        session.add(SiteSetting(key=key, value=value, updated_by=user.id))
    else:
        row.value = value
        row.updated_by = user.id
    audit.record(
        session, action_type="settings.update", result=AuditResult.SUCCESS, user=user,
        object_type="site_setting", object_id=key, details={"key": key}, ip=ip,
    )
    session.commit()
    return value


def _synonym_out(row: Synonym) -> dict[str, Any]:
    return {"id": row.id, "terms": list(row.terms), "note": row.note, "is_active": row.is_active}


def _terms(values: dict[str, Any]) -> None:
    if "terms" in values:
        terms = list(dict.fromkeys(term.strip() for term in values["terms"] if term.strip()))
        if len(terms) < 2:
            raise InvalidInput("invalid_input")
        values["terms"] = terms


def list_synonyms(session: Session, user: AuthUser, *, ip: str | None) -> list[dict[str, Any]]:
    require(session, user, "settings.edit", ip=ip)
    return [_synonym_out(row) for row in repo.list_synonyms(session)]


def create_synonym(session: Session, user: AuthUser, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    require(session, user, "settings.edit", ip=ip)
    values = common.parse(SynonymIn, body)
    if "terms" not in values:
        raise InvalidInput("invalid_input")
    _terms(values)
    row = Synonym(**values)
    session.add(row)
    session.flush()
    audit.record(
        session, action_type="synonym.create", result=AuditResult.SUCCESS, user=user,
        object_type="synonym", object_id=row.id, details={"terms": len(row.terms)}, ip=ip,
    )
    session.commit()
    return _synonym_out(row)


def _load_synonym(session: Session, synonym_id: uuid.UUID) -> Synonym:
    row = session.get(Synonym, synonym_id)
    if row is None:
        raise NotFound()
    return row


def update_synonym(session: Session, user: AuthUser, synonym_id: uuid.UUID, body: dict[str, Any], *, ip: str | None) -> dict[str, Any]:
    require(session, user, "settings.edit", ip=ip)
    row = _load_synonym(session, synonym_id)
    values = common.parse(SynonymPatch, body)
    if values.get("terms") is None or values.get("is_active") is None:
        values = {k: v for k, v in values.items() if v is not None or k == "note"}
    _terms(values)
    for name, value in values.items():
        setattr(row, name, value)
    audit.record(
        session, action_type="synonym.update", result=AuditResult.SUCCESS, user=user,
        object_type="synonym", object_id=row.id, details={"fields": sorted(values)}, ip=ip,
    )
    session.commit()
    return _synonym_out(row)


def delete_synonym(session: Session, user: AuthUser, synonym_id: uuid.UUID, *, ip: str | None) -> None:
    require(session, user, "settings.edit", ip=ip)
    row = _load_synonym(session, synonym_id)
    audit.record(
        session, action_type="synonym.delete", result=AuditResult.SUCCESS, user=user,
        object_type="synonym", object_id=row.id, details={}, ip=ip,
    )
    session.delete(row)
    session.commit()
