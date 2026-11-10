"""T3.4/T3.9: fund -> inventory -> case -> documents; only published levels, public documents."""

import uuid

from app.models.enums import DescriptionStatus, FundType, WorkflowStatus
from tests.catalog.conftest import doc, get, published_tree, token


def test_tree_navigation_counts_and_links(api, factory):
    word = token()
    fund, inventory, case = published_tree(factory, type=FundType.PERSONAL)
    fund.title = {"ru": f"Фонд {word}"}
    factory.session.commit()
    first = doc(factory, case, word, archive_code=f"{word}-1")
    doc(factory, case, word, archive_code=f"{word}-2")
    doc(factory, case, word, workflow_status=WorkflowStatus.DRAFT)
    doc(factory, case, word, description_status=DescriptionStatus.DO_NOT_PUBLISH)

    funds = get(api, "funds", q=word)
    assert funds["total"] == 1
    item = funds["items"][0]
    assert (item["inventory_count"], item["document_count"], item["href"]) == (1, 2, f"/catalog/funds/{fund.id}")
    assert get(api, "funds", q=word, type="personal")["total"] == 1
    assert get(api, "funds", q=word, type="party")["total"] == 0

    detail = get(api, f"funds/{fund.id}")
    assert detail["inventories"][0]["href"] == f"/catalog/inventories/{inventory.id}"
    assert detail["inventories"][0]["case_count"] == 1 and detail["inventories"][0]["document_count"] == 2

    inv = get(api, f"inventories/{inventory.id}")
    assert inv["fund"]["href"] == f"/catalog/funds/{fund.id}" and inv["cases"]["items"][0]["document_count"] == 2
    assert inv["cases"]["items"][0]["href"] == f"/catalog/cases/{case.id}"

    got = get(api, f"cases/{case.id}")
    assert got["inventory"]["id"] == str(inventory.id) and got["fund"]["id"] == str(fund.id)
    assert got["documents"]["total"] == 2
    assert got["documents"]["items"][0]["id"] == str(first.id)
    assert got["documents"]["items"][0]["href"] == f"/catalog/documents/{first.id}"
    assert get(api, "inventories", q=str(inventory.number))["total"] >= 1
    assert get(api, "cases", q=word)["total"] == 0  # cases have no word in their title/number


def test_hidden_levels_are_404_and_not_listed(api, factory):
    word = token()
    fund, inventory, case = published_tree(factory)
    fund.title = {"ru": f"Фонд {word}"}
    factory.session.commit()
    doc(factory, case, word)

    fund.workflow_status = WorkflowStatus.DRAFT
    factory.session.commit()
    assert get(api, "funds", q=word)["total"] == 0
    for path in (f"funds/{fund.id}", f"inventories/{inventory.id}", f"cases/{case.id}"):
        assert api.get(f"/api/catalog/{path}").status_code == 404
    assert inventory.id not in {uuid.UUID(i["id"]) for i in get(api, "inventories", per_page=100)["items"]}
    assert case.id not in {uuid.UUID(i["id"]) for i in get(api, "cases", per_page=100)["items"]}

    fund.workflow_status = WorkflowStatus.PUBLISHED
    inventory.workflow_status = WorkflowStatus.DRAFT
    factory.session.commit()
    assert get(api, f"funds/{fund.id}")["inventories"] == []
    assert api.get(f"/api/catalog/inventories/{inventory.id}").status_code == 404
    assert api.get(f"/api/catalog/cases/{case.id}").status_code == 404

    inventory.workflow_status = WorkflowStatus.PUBLISHED
    case.workflow_status = WorkflowStatus.DRAFT
    factory.session.commit()
    assert get(api, f"inventories/{inventory.id}")["cases"]["items"] == []
    assert api.get(f"/api/catalog/cases/{case.id}").status_code == 404
    assert get(api, f"funds/{fund.id}")["document_count"] == 0


def test_unknown_and_malformed_ids(api):
    assert api.get(f"/api/catalog/funds/{uuid.uuid4()}").status_code == 404
    assert api.get("/api/catalog/cases/not-a-uuid").status_code == 422
    assert api.get("/api/catalog/funds", params={"type": "x"}).status_code == 422
