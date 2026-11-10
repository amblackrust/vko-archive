"""T5.6, T5.7: `GET /api/legal-acts` and `GET /api/compliance` -- published only, open files only."""

import uuid
from collections.abc import Iterator
from datetime import date
from typing import Any

import pytest
from sqlalchemy import select

from app.models import LegalAct, Page, SiteSetting
from app.models.enums import FileAccess, LegalActStatus, WorkflowStatus
from tests.admin.conftest import Factory, api, factory, roles_ready  # noqa: F401  (fixtures)
from tests.search.conftest import add_file, token  # noqa: F401


@pytest.fixture
def compliance(factory: Factory) -> Iterator[Any]:
    """The test DB may already hold the seeded compliance page and setting: the test rewrites
    them, then puts the original state back (rows that did not exist are removed)."""
    session = factory.session
    page = session.scalar(select(Page).where(Page.key == "compliance"))
    setting = session.get(SiteSetting, "compliance")
    saved_page = {c.name: getattr(page, c.name) for c in Page.__table__.columns} if page else None
    saved_setting = setting.value if setting else None
    try:
        yield session
    finally:
        session.rollback()
        page = session.scalar(select(Page).where(Page.key == "compliance"))
        if saved_page is None and page is not None:
            session.delete(page)
        elif saved_page is not None and page is not None:
            for name, value in saved_page.items():
                setattr(page, name, value)
        setting = session.get(SiteSetting, "compliance")
        if saved_setting is None and setting is not None:
            session.delete(setting)
        elif setting is not None:
            setting.value = saved_setting
        session.commit()


def set_compliance_page(compliance_session: Any, **values: Any) -> None:
    page = compliance_session.scalar(select(Page).where(Page.key == "compliance"))
    if page is None:
        page = Page(key="compliance", title={"ru": "x"}, body={"ru": "x"})
        compliance_session.add(page)
    for name, value in values.items():
        setattr(page, name, value)
    compliance_session.commit()


def act(factory: Factory, word: str, **values) -> LegalAct:
    defaults = {
        "title": {"ru": f"ДЕМО {word}"},
        "issuer": {"ru": "ДЕМО орган"},
        "status": LegalActStatus.ACTIVE,
        "workflow_status": WorkflowStatus.PUBLISHED,
        "slug": f"legal-{uuid.uuid4().hex}",
    }
    return factory.add(LegalAct(**{**defaults, **values}))


def items(api, **params) -> list[dict]:
    response = api.get("/api/legal-acts", params=params)
    assert response.status_code == 200, response.text
    return response.json()["items"]


def test_only_published_acts_are_listed(api, factory):
    word = token()
    shown = act(factory, word, number="1", date=date(2020, 1, 2))
    act(factory, word, workflow_status=WorkflowStatus.DRAFT)
    act(factory, word, workflow_status=WorkflowStatus.ARCHIVED)
    assert [i["id"] for i in items(api, q=word)] == [str(shown.id)]


def test_search_matches_title_number_and_issuer_case_insensitively(api, factory):
    word = token()
    shown = act(factory, word, number="№ 142-ДЕМО", issuer={"ru": "Акимат ДЕМО"})
    act(factory, token())
    assert [i["id"] for i in items(api, q=word.upper())] == [str(shown.id)]
    assert [i["id"] for i in items(api, q="142-демо")] == [str(shown.id)]
    assert [i["id"] for i in items(api, q="акимат демо")] == [str(shown.id)]


def test_status_filter(api, factory):
    word = token()
    expired = act(factory, word, status=LegalActStatus.EXPIRED)
    active = act(factory, word, status=LegalActStatus.ACTIVE)
    assert [i["id"] for i in items(api, q=word, status="expired")] == [str(expired.id)]
    assert {i["id"] for i in items(api, q=word)} == {str(expired.id), str(active.id)}


def test_file_is_offered_only_when_open_and_only_as_api_link(api, factory):
    word = token()
    open_file = add_file(factory, None, owner_type="legal_act", access=FileAccess.OPEN, mime="application/pdf", pages=3)
    closed_file = add_file(factory, None, owner_type="legal_act", access=FileAccess.CLOSED)
    with_open = act(factory, word, file_id=open_file.id)
    with_closed = act(factory, word, file_id=closed_file.id)
    by_id = {i["id"]: i for i in items(api, q=word)}
    assert by_id[str(with_open.id)]["file"] == {
        "url": f"/api/files/{open_file.id}", "mime": "application/pdf", "pages": 3,
    }  # fmt: skip
    assert by_id[str(with_closed.id)]["file"] is None
    assert "master_path" not in str(by_id) and "masters/" not in str(by_id)


def test_non_web_adilet_link_is_dropped(api, factory):
    word = token()
    act(factory, word, adilet_url="javascript:alert(1)")
    assert items(api, q=word)[0]["adilet_url"] is None


def test_compliance_page_with_officer_and_its_documents(api, factory, compliance):
    word = token()
    set_compliance_page(
        compliance, title={"ru": "Комплаенс-служба"}, body={"ru": "<p>Текст</p>"},
        workflow_status=WorkflowStatus.PUBLISHED,
    )  # fmt: skip
    compliance.merge(SiteSetting(key="compliance", value={"officer": "ДЕМО Офицер"}))
    compliance.commit()
    compliance_act = act(factory, word, slug=f"compliance-{uuid.uuid4().hex}")
    act(factory, word, slug=f"legal-{uuid.uuid4().hex}")

    response = api.get("/api/compliance", params={"lang": "kk"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Комплаенс-служба" and body["title_lang"] == "ru"
    assert body["body"] == "<p>Текст</p>" and body["body_lang"] == "ru"
    assert body["officer"] == "ДЕМО Офицер"
    assert [d["id"] for d in body["documents"] if d["title"].endswith(word)] == [str(compliance_act.id)]


def test_unpublished_compliance_page_is_not_found(api, factory, compliance):
    set_compliance_page(compliance, workflow_status=WorkflowStatus.DRAFT)
    assert api.get("/api/compliance").status_code == 404
