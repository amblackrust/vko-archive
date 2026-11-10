import uuid
from decimal import Decimal

from app.models import Branch
from app.models.enums import BranchType, WorkflowStatus
from tests.admin.conftest import Factory, api, factory, roles_ready  # noqa: F401  (fixtures)


def _branch(factory: Factory, **values) -> Branch:
    defaults = {
        "name": {"ru": "ДЕМО филиал"},
        "type": BranchType.DISTRICT,
        "slug": f"t-{uuid.uuid4().hex[:8]}",
        "workflow_status": WorkflowStatus.PUBLISHED,
        "lat": Decimal("49.5"),
        "lng": Decimal("83.5"),
    }
    return factory.add(Branch(**{**defaults, **values}))


def test_published_branch_listed_and_detail(api, factory):
    b = _branch(factory, address={"ru": "ул. Тестовая, 1"})
    items = {i["slug"]: i for i in api.get("/api/branches").json()["items"]}
    item = items[b.slug]
    assert item["href"] == f"/branches/{b.slug}"
    assert item["lat"] == 49.5 and item["show_on_map"] is True and item["coords_verified"] is False
    detail = api.get(f"/api/branches/{b.slug}", params={"lang": "en"})
    assert detail.status_code == 200
    assert detail.json()["name"] == "ДЕМО филиал" and detail.json()["name_lang"] == "ru"


def test_unpublished_branch_hidden(api, factory):
    b = _branch(factory, workflow_status=WorkflowStatus.DRAFT)
    assert b.slug not in {i["slug"] for i in api.get("/api/branches").json()["items"]}
    assert api.get(f"/api/branches/{b.slug}").status_code == 404


def test_hidden_from_map_has_no_coordinates(api, factory):
    b = _branch(factory, show_on_map=False)
    item = api.get(f"/api/branches/{b.slug}").json()
    assert item["lat"] is None and item["lng"] is None and item["show_on_map"] is False


def test_bad_lang_rejected(api):
    assert api.get("/api/branches", params={"lang": "xx"}).status_code == 422
