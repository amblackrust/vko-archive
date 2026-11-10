"""Fixtures of the visitor cabinet tests. Reuses the admin API/factory fixtures (committed
objects, HTTPS test client) and removes every visitor created by a test."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session

from app.main import app
from app.models import DigitalFile, Document, Exhibition, News, Visitor
from app.models.enums import DescriptionStatus, FileAccess, WorkflowStatus
from app.security import CSRF_HEADER
from app.services import visitor_auth
from tests.admin.conftest import Factory, api, factory, roles_ready  # noqa: F401

PASSWORD = "Cabinet-Test-Pass-1"
PUBLISHED = WorkflowStatus.PUBLISHED


@pytest.fixture(autouse=True)
def _visitor_cleanup(engine: Engine) -> Iterator[None]:
    visitor_auth.limiter.reset()
    yield
    with Session(engine) as session:
        session.execute(delete(Visitor).where(Visitor.email.like("%@cabinet.test")))
        session.commit()
    visitor_auth.limiter.reset()


def new_email() -> str:
    return f"v-{uuid.uuid4().hex[:8]}@cabinet.test"


def register(client: TestClient, email: str | None = None, password: str = PASSWORD) -> dict[str, Any]:
    """Registers a visitor through the API; the client keeps the cookies and sends the CSRF header."""
    response = client.post("/api/cabinet/auth/register", json={"email": email or new_email(), "password": password})
    assert response.status_code == 201, response.text
    body = response.json()
    client.headers[CSRF_HEADER] = body["csrf_token"]
    return body


@pytest.fixture
def second_client(api: TestClient) -> Iterator[TestClient]:  # noqa: F811
    """Another browser with its own cookie jar (same app and database)."""
    with TestClient(app, base_url="https://testserver") as client:
        yield client


def public_document(factory: Factory, **values: Any) -> Document:  # noqa: F811
    values.setdefault("workflow_status", PUBLISHED)
    values.setdefault("description_status", DescriptionStatus.PUBLIC)
    values.setdefault("file_access", FileAccess.OPEN)
    return factory.document(**values)


def document_file(factory: Factory, document: Document, access: FileAccess = FileAccess.OPEN) -> DigitalFile:  # noqa: F811
    return factory.add(
        DigitalFile(
            owner_type="document", owner_id=document.id, master_path="x/master.jpg", preview_path="x/preview.jpg",
            mime="image/jpeg", size=1, sha256=uuid.uuid4().hex + uuid.uuid4().hex, access=access, is_demo=True,
        )
    )


def exhibition(factory: Factory, **values: Any) -> Exhibition:  # noqa: F811
    slug = f"ex-{uuid.uuid4().hex[:8]}"
    values.setdefault("title", {"ru": "ДЕМО выставка"})
    values.setdefault("workflow_status", PUBLISHED)
    return factory.add(Exhibition(slug=slug, intro={"ru": "Вступление"}, is_demo=True, **values))


def news(factory: Factory, **values: Any) -> News:  # noqa: F811
    values.setdefault("title", {"ru": "ДЕМО новость"})
    values.setdefault("workflow_status", PUBLISHED)
    return factory.add(News(slug=f"news-{uuid.uuid4().hex[:8]}", is_demo=True, **values))
