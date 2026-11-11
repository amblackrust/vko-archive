"""Closed material never leaks, whatever the path (T7.6): a document that is not public and a
closed file are linked from published exhibitions, persons and collections and share a case
with a public document — every public endpoint is then swept for their ids and title."""

import uuid
from typing import Any

import pytest

from app.models import Collection, CollectionItem, Exhibit, Exhibition, Person
from app.models.enums import DescriptionStatus, FileAccess, RoleCode, WorkflowStatus
from tests.admin.conftest import Factory, login
from tests.search.conftest import add_file, index, public_document, token

PUBLISHED = WorkflowStatus.PUBLISHED


@pytest.fixture(params=["draft", "description_hidden", "files_closed"])
def scene(request, factory: Factory) -> dict[str, Any]:
    word = token()
    fund, inventory, case = factory.catalog(None)
    for level in (fund, inventory, case):
        level.workflow_status = PUBLISHED
    factory.session.commit()
    public = public_document(factory, case, title={"ru": f"Открытый {word}"})
    hidden_values = {
        "draft": {"workflow_status": WorkflowStatus.DRAFT},
        "description_hidden": {"description_status": DescriptionStatus.DO_NOT_PUBLISH},
        # the card is public, its files are not
        "files_closed": {"file_access": FileAccess.CLOSED},
    }[request.param]
    marker = f"Скрытый{word}"
    hidden = public_document(factory, case, title={"ru": marker}, summary={"ru": marker}, **hidden_values)
    ocr_marker = f"Распознанный{word}"
    closed_file = add_file(factory, hidden, access=FileAccess.CLOSED, ocr_text=ocr_marker, mime="image/jpeg",
                           sha256=uuid.uuid4().hex * 2, preview_path="previews/x.webp")
    for document in (public, hidden):
        index(factory, "document", document)
    slug = f"t-{uuid.uuid4().hex[:8]}"
    exhibition = factory.add(Exhibition(slug=slug, title={"ru": "ДЕМО выставка"}, intro={}, workflow_status=PUBLISHED,
                                        cover_file_id=closed_file.id, is_demo=True))
    factory.add(Exhibit(exhibition_id=exhibition.id, title={"ru": "ДЕМО экспонат"}, workflow_status=PUBLISHED,
                        document_id=hidden.id, media_file_id=closed_file.id, is_demo=True))
    person = factory.add(Person(slug=slug, name={"ru": "ДЕМО персона"}, workflow_status=PUBLISHED, is_demo=True))
    person.documents = [hidden, public]
    collection = factory.add(Collection(slug=slug, title={"ru": "ДЕМО подборка"}, workflow_status=PUBLISHED, is_demo=True))
    factory.add(CollectionItem(collection_id=collection.id, item_type="document", item_id=hidden.id, position=0))
    factory.session.commit()
    return {"kind": request.param, "word": word, "marker": marker, "ocr_marker": ocr_marker, "public": public, "hidden": hidden,
            "file": closed_file, "slug": slug}


def _public_texts(api, scene: dict[str, Any]) -> dict[str, str]:
    word, slug, public = scene["word"], scene["slug"], scene["public"]
    urls = {
        "search": f"/api/search?q={word}",
        "catalog": f"/api/catalog/documents?q={word}",
        "catalog_case": f"/api/catalog/cases/{public.case_id}",
        "public_card": f"/api/catalog/documents/{public.id}",
        "exhibition": f"/api/exhibitions/{slug}",
        "exhibitions": "/api/exhibitions",
        "person": f"/api/memory/persons/{slug}",
        "collection": f"/api/memory/collections/{slug}",
        "recommendations": f"/api/ai/recommendations?type=document&id={public.id}",
    }
    texts = {}
    for name, path in urls.items():
        response = api.get(path)
        assert response.status_code == 200, (name, response.text)
        texts[name] = response.text
    return texts


def _assert_hidden(texts: dict[str, str], scene: dict[str, Any], *, card_public: bool) -> None:
    for name, body in texts.items():
        assert str(scene["file"].id) not in body and scene["ocr_marker"] not in body, name
        if not card_public:
            assert scene["marker"] not in body and str(scene["hidden"].id) not in body, name


def test_closed_material_is_absent_from_every_public_endpoint(api, scene):
    card_public = scene["kind"] == "files_closed"
    _assert_hidden(_public_texts(api, scene), scene, card_public=card_public)
    hidden = scene["hidden"]
    card = api.get(f"/api/catalog/documents/{hidden.id}")
    if card_public:
        assert card.status_code == 200 and card.json()["files"] == []
        assert scene["ocr_marker"] not in card.text
    else:
        assert card.status_code == 404
        assert api.post(f"/api/ai/documents/{hidden.id}/answer", json={"q": "о чём документ?"}).status_code == 404
        assert api.get(f"/api/ai/recommendations?type=document&id={hidden.id}").status_code == 404
    # The query is echoed back, so look at the hits only.
    assert api.get("/api/search", params={"q": scene["ocr_marker"]}).json()["total"] == 0
    for variant in ("", "?variant=preview"):
        assert api.get(f"/api/files/{scene['file'].id}{variant}").status_code == 404


def test_visitor_session_does_not_open_closed_material(api, scene):
    """A signed-in visitor is anonymous for access rules (cabinet ≠ staff)."""
    from tests.cabinet.conftest import register

    register(api, f"v-{uuid.uuid4().hex[:8]}@cabinet.test")
    _assert_hidden(_public_texts(api, scene), scene, card_public=scene["kind"] == "files_closed")
    assert api.get(f"/api/files/{scene['file'].id}").status_code == 404
    if scene["kind"] != "files_closed":
        added = api.post("/api/cabinet/favorites", json={"type": "document", "id": str(scene["hidden"].id)})
        assert added.status_code == 404


def test_staff_session_does_not_change_public_endpoints(api, factory, scene):
    """Public endpoints ignore the staff session: no admin preview leaks through them."""
    login(api, factory.user(RoleCode.SUPER_ADMIN).email)
    _assert_hidden(_public_texts(api, scene), scene, card_public=scene["kind"] == "files_closed")
