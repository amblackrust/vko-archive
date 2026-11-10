import uuid
from datetime import date
from decimal import Decimal

from app.models import Collection, CollectionItem, HistoricalEvent, Person
from app.models.enums import DescriptionStatus, WorkflowStatus
from tests.catalog.conftest import doc, published_tree
from tests.admin.conftest import api, factory, roles_ready  # noqa: F401  (fixtures)

PUBLISHED = WorkflowStatus.PUBLISHED


def _slug() -> str:
    return f"t-{uuid.uuid4().hex[:8]}"


def test_collection_lists_only_public_documents(api, factory):
    _, _, case = published_tree(factory)
    shown = doc(factory, case, "показан")
    draft = doc(factory, case, "черновик", workflow_status=WorkflowStatus.DRAFT)
    hidden = doc(factory, case, "закрыт", description_status=DescriptionStatus.NEEDS_REVIEW)
    collection = factory.add(
        Collection(slug=_slug(), title={"ru": "ДЕМО подборка"}, theme="t-memory", workflow_status=PUBLISHED, is_demo=True)
    )
    for position, d in enumerate((shown, draft, hidden)):
        factory.add(CollectionItem(collection_id=collection.id, position=position, item_type="document", item_id=d.id,
                                   note={"ru": "заметка"} if d is shown else {}))
    body = api.get(f"/api/memory/collections/{collection.slug}").json()
    assert body["href"] == f"/memory/collections/{collection.slug}"
    assert [d["id"] for d in body["documents"]] == [str(shown.id)]
    assert body["documents"][0]["note"] == "заметка" and body["item_count"] == 1 and body["is_demo"] is True
    listed = {i["slug"]: i for i in api.get("/api/memory/collections", params={"theme": "t-memory"}).json()["items"]}
    assert listed[collection.slug]["item_count"] == 1


def test_unpublished_collection_person_hidden(api, factory):
    collection = factory.add(Collection(slug=_slug(), title={"ru": "ДЕМО"}, workflow_status=WorkflowStatus.DRAFT))
    person = factory.add(Person(slug=_slug(), name={"ru": "ДЕМО Человек"}, workflow_status=WorkflowStatus.DRAFT))
    assert api.get(f"/api/memory/collections/{collection.slug}").status_code == 404
    assert api.get(f"/api/memory/persons/{person.slug}").status_code == 404
    assert person.slug not in {p["slug"] for p in api.get("/api/memory/persons").json()["items"]}


def test_collection_search_and_language_fallback(api, factory):
    word = uuid.uuid4().hex[:10]
    collection = factory.add(
        Collection(slug=_slug(), title={"ru": f"ДЕМО {word}"}, workflow_status=PUBLISHED)
    )
    found = api.get("/api/memory/collections", params={"q": word, "lang": "en"}).json()["items"]
    assert [i["slug"] for i in found] == [collection.slug]
    assert found[0]["title_lang"] == "ru" and found[0]["translation_missing"] is True


def test_person_detail_with_sources(api, factory):
    person = factory.add(
        Person(slug=_slug(), name={"ru": "ДЕМО Человек"}, years_text="1900–1970", workflow_status=PUBLISHED,
               sources=[{"title": "Календарь"}, {"title": ""}], is_demo=True)
    )
    body = api.get(f"/api/memory/persons/{person.slug}").json()
    assert body["href"] == f"/memory/persons/{person.slug}"
    assert body["sources"] == [{"title": "Календарь", "url": None}] and body["documents"] == []


def test_timeline_dated_only_and_documents(api, factory):
    _, _, case = published_tree(factory)
    d = doc(factory, case, "событие")
    event = factory.add(
        HistoricalEvent(slug=_slug(), title={"ru": "ДЕМО событие"}, date_from=date(1800, 5, 1), theme="t-th",
                        workflow_status=PUBLISHED)
    )
    undated = factory.add(HistoricalEvent(slug=_slug(), title={"ru": "ДЕМО без даты"}, workflow_status=PUBLISHED))
    draft = factory.add(
        HistoricalEvent(slug=_slug(), title={"ru": "ДЕМО"}, date_from=date(1801, 1, 1), workflow_status=WorkflowStatus.DRAFT)
    )
    event.documents = [d]
    factory.session.commit()
    body = api.get("/api/memory/timeline").json()
    items = {i["slug"]: i for i in body["items"]}
    assert items[event.slug]["year"] == 1800 and items[event.slug]["documents"][0]["id"] == str(d.id)
    assert undated.slug not in items and draft.slug not in items
    assert {"value": "t-th", "count": 1} in body["themes"]
    years = [i["year"] for i in body["items"]]
    assert years == sorted(years)


def test_map_points_need_coordinates(api, factory):
    point = factory.add(
        HistoricalEvent(slug=_slug(), title={"ru": "ДЕМО точка"}, lat=Decimal("49.5"), lng=Decimal("82.5"),
                        theme="heritage", workflow_status=PUBLISHED, is_demo=True)
    )
    nowhere = factory.add(HistoricalEvent(slug=_slug(), title={"ru": "ДЕМО"}, workflow_status=PUBLISHED))
    items = {i["slug"]: i for i in api.get("/api/memory/map-points").json()["items"]}
    assert items[point.slug]["lat"] == 49.5 and items[point.slug]["is_demo"] is True
    assert nowhere.slug not in items


def test_bad_lang_rejected(api):
    assert api.get("/api/memory/timeline", params={"lang": "xx"}).status_code == 422
