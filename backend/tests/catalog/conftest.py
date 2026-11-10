"""Fixtures for catalog tests (B06). Reuses the B12 factory and API client. The dev/test DB
may hold demo data, so tests isolate their documents with a unique word in the title."""

from datetime import date
from typing import Any

from app.models import Case, Document, Fund, Inventory
from app.models.enums import DescriptionStatus, FileAccess, FundType, WorkflowStatus
from tests.admin.conftest import Factory, api, factory, roles_ready  # noqa: F401  (fixtures)
from tests.search.conftest import token  # noqa: F401


def published_tree(factory: Factory, **fund_values: Any) -> tuple[Fund, Inventory, Case]:
    defaults: dict[str, Any] = {"workflow_status": WorkflowStatus.PUBLISHED}
    fund, inventory, case = factory.catalog(None)
    for obj, values in ((fund, {**defaults, **fund_values}), (inventory, defaults), (case, defaults)):
        for key, value in values.items():
            setattr(obj, key, value)
    factory.session.commit()
    return fund, inventory, case


def doc(factory: Factory, case: Case | None, word: str, **values: Any) -> Document:
    defaults: dict[str, Any] = {
        "title": {"ru": f"ДЕМО {word}"},
        "workflow_status": WorkflowStatus.PUBLISHED,
        "description_status": DescriptionStatus.PUBLIC,
        "file_access": FileAccess.OPEN,
        "date_from": date(1950, 1, 1),
    }
    return factory.add(Document(case_id=case.id if case else None, is_demo=True, **{**defaults, **values}))


def get(api, path: str, **params: Any) -> dict:
    response = api.get(f"/api/catalog/{path}", params=params)
    assert response.status_code == 200, response.text
    return response.json()
