"""Page bodies are rendered with dangerouslySetInnerHTML, so the API must never return active markup."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models import Page
from app.models.enums import WorkflowStatus
from app.services.sanitize import clean_html

XSS = (
    '<p onclick="alert(1)">Текст <b>жирный</b></p><script>alert(1)</script><style>p{}</style>'
    '<a href="javascript:alert(1)">bad</a><a href="https://example.kz/x">ok</a>'
    '<img src="x" onerror="alert(1)"><iframe src="https://evil.example"></iframe>'
    '<table><tr><td style="color:red">1</td></tr></table><ul><li>пункт</li></ul>'
)


def test_clean_html_drops_active_markup_and_keeps_structure():
    cleaned = clean_html(XSS)
    for bad in ("<script", "<style", "<iframe", "onclick", "onerror", "javascript:", "style="):
        assert bad not in cleaned
    for good in ("<b>жирный</b>", 'href="https://example.kz/x"', "<table>", "<td>1</td>", "<li>пункт</li>"):
        assert good in cleaned


def test_public_page_body_is_sanitized(client: TestClient, engine: Engine):
    key = f"test-{uuid.uuid4().hex[:12]}"
    with Session(engine) as session:
        page = Page(key=key, title={"ru": "ДЕМО"}, body={"ru": XSS}, workflow_status=WorkflowStatus.PUBLISHED,
                    translation_status={"ru": "verified"})
        session.add(page)
        session.commit()
        try:
            body = client.get(f"/api/pages/{key}").json()["body"]
        finally:
            session.delete(page)
            session.commit()
    assert "<script" not in body and "onerror" not in body and "javascript:" not in body
    assert "<b>жирный</b>" in body
