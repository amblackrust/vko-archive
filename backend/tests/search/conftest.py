"""Fixtures for search/indexing/files tests (B05). Reuses the B12 factory and API client;
index rows of created objects are removed after each test (search_entries has no FK)."""

import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, delete

from app.config import get_settings
from app.main import app
from app.models import DigitalFile, Document, SearchEntry
from app.models.enums import DescriptionStatus, FileAccess, WorkflowStatus
from app.services import indexing
from tests.admin.conftest import Factory, api, roles_ready  # noqa: F401  (fixtures)


@pytest.fixture
def factory(engine: Engine, roles_ready: None) -> Iterator[Factory]:  # noqa: F811
    f = Factory(engine)
    yield f
    ids = [obj.id for obj in f._created]
    f.session.rollback()
    if ids:
        f.session.execute(delete(SearchEntry).where(SearchEntry.object_id.in_(ids)))
        f.session.commit()
    f.cleanup()


@pytest.fixture
def storage(tmp_path: Path) -> Iterator[Path]:
    """API settings with a temporary storage dir."""
    settings = get_settings().model_copy(update={"storage_dir": tmp_path})
    app.dependency_overrides[get_settings] = lambda: settings
    yield tmp_path
    app.dependency_overrides.pop(get_settings, None)


def token() -> str:
    """A unique searchable word (letters only, so FTS/trigram treat it as one word)."""
    return "демо" + "".join("абвгдежзиклмнопрстуф"[int(c, 16)] for c in uuid.uuid4().hex[:10])


def public_document(factory: Factory, case: Any = None, **values: Any) -> Document:
    defaults: dict[str, Any] = {
        "title": {"ru": "ДЕМО документ"},
        "is_demo": True,
        "workflow_status": WorkflowStatus.PUBLISHED,
        "description_status": DescriptionStatus.PUBLIC,
        "file_access": FileAccess.OPEN,
    }
    return factory.add(Document(case_id=case.id if case else None, **{**defaults, **values}))


def add_file(factory: Factory, owner: Any, owner_type: str = "document", **values: Any) -> DigitalFile:
    defaults: dict[str, Any] = {
        "master_path": "masters/test.txt",
        "mime": "text/plain",
        "size": 1,
        "sha256": "0" * 64,
        "access": FileAccess.OPEN,
        "is_demo": True,
    }
    return factory.add(DigitalFile(owner_type=owner_type, owner_id=owner.id if owner else None, **{**defaults, **values}))


def index(factory: Factory, object_type: str, obj: Any) -> int:
    written = indexing.reindex_object(factory.session, object_type, obj)
    factory.session.commit()
    return written
