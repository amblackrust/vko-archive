"""Fixtures for auth/authz/workflow/audit tests (B12).

Objects are committed to the test DB (the API uses its own sessions) and removed after
each test by `factory`. The API client talks HTTPS so the Secure session cookie is sent.
"""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, delete
from sqlalchemy.orm import Session, sessionmaker

from app.db import get_session
from app.main import app
from app.models import Branch, Fund, Inventory, Case, Document, User
from app.models.enums import BranchType, FundType, RoleCode
from app.repositories import roles as roles_repo
from app.security import CSRF_HEADER, hash_password
from app.services.authz import AuthUser, ensure_roles_and_permissions, load_auth_user

PASSWORD = "Demo-Test-Password-1"


@pytest.fixture(scope="session")
def roles_ready(engine: Engine) -> None:
    with Session(engine) as session:
        ensure_roles_and_permissions(session)
        session.commit()


class Factory:
    def __init__(self, engine: Engine) -> None:
        self.session = Session(engine, expire_on_commit=False)
        self._created: list[Any] = []

    def add(self, obj: Any) -> Any:
        self.session.add(obj)
        self.session.commit()
        self._created.append(obj)
        return obj

    def user(self, role: RoleCode | None, *, branch_id: uuid.UUID | None = None, password: str = PASSWORD) -> User:
        user = User(
            email=f"{role or 'norole'}-{uuid.uuid4().hex[:8]}@test.demo",
            password_hash=hash_password(password),
            full_name="ДЕМО Тестовый пользователь",
            branch_id=branch_id,
        )
        if role is not None:
            user.roles = [roles_repo.get_role(self.session, role.value)]
        return self.add(user)

    def auth(self, user: User) -> AuthUser:
        return load_auth_user(self.session, user)

    def branch(self) -> Branch:
        return self.add(Branch(name={"ru": "ДЕМО филиал"}, type=BranchType.DISTRICT, slug=f"b-{uuid.uuid4().hex[:8]}"))

    def catalog(self, branch: Branch | None) -> tuple[Fund, Inventory, Case]:
        fund = self.add(
            Fund(number=f"F{uuid.uuid4().hex[:6]}", title={"ru": "ДЕМО фонд"}, type=FundType.ORGANIZATION,
                 branch_id=branch.id if branch else None)
        )
        inventory = self.add(Inventory(fund_id=fund.id, number="1"))
        case = self.add(Case(inventory_id=inventory.id, number="1"))
        return fund, inventory, case

    def document(self, case: Case | None = None, **values: Any) -> Document:
        return self.add(Document(case_id=case.id if case else None, title={"ru": "ДЕМО документ"}, is_demo=True, **values))

    def cleanup(self) -> None:
        self.session.rollback()
        for obj in reversed(self._created):
            self.session.execute(delete(type(obj)).where(type(obj).id == obj.id))
        self.session.commit()
        self.session.close()


@pytest.fixture
def factory(engine: Engine, roles_ready: None) -> Iterator[Factory]:
    f = Factory(engine)
    yield f
    f.cleanup()


@pytest.fixture
def api(engine: Engine, roles_ready: None) -> Iterator[TestClient]:
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _session() -> Iterator[Session]:
        with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = _session
    with TestClient(app, base_url="https://testserver") as client:
        yield client
    app.dependency_overrides.clear()


def login(client: TestClient, email: str, password: str = PASSWORD) -> dict:
    response = client.post("/api/admin/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    body = response.json()
    client.headers[CSRF_HEADER] = body["csrf_token"]
    return body
