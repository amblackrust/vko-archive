"""T4.12 «similar materials»: by embeddings of public descriptions, live publicity re-check,
personal history from the browser, fallback (tags / fund) without vectors."""

import random
import uuid

from sqlalchemy import update

from app.models import SearchEntry, Tag
from app.models.base import EMBEDDING_DIM
from app.models.enums import DescriptionStatus, WorkflowStatus
from tests.catalog.conftest import doc, published_tree
from tests.search.conftest import index, public_document, token


def basis() -> tuple[int, int]:
    """Two random axes, so vectors of this test do not meet rows of other tests."""
    first = random.randrange(EMBEDDING_DIM - 1)
    return first, first + 1


def vector(**axes: float) -> list[float]:
    values = [0.0] * EMBEDDING_DIM
    for key, value in axes.items():
        values[int(key[1:])] = value
    return values


def embed(factory, document, values: list[float]) -> None:
    index(factory, "document", document)
    factory.session.execute(
        update(SearchEntry)
        .where(SearchEntry.object_id == document.id, SearchEntry.chunk_no == 0)
        .values(embedding=values, embedding_model="test")
    )
    factory.session.commit()


def recommend(api, document_id, **params):
    response = api.get("/api/ai/recommendations", params={"type": "document", "id": str(document_id), **params})
    assert response.status_code == 200, response.text
    return response.json()


def test_nearest_public_documents_by_embeddings(api, factory):
    x, y = basis()
    source = public_document(factory, title={"ru": f"Источник {token()}"})
    near = public_document(factory, title={"ru": f"Близкий {token()}"}, summary={"ru": "<b>Описание</b> близкого"})
    nearer = public_document(factory, title={"ru": f"Ближайший {token()}"})
    far = public_document(factory, title={"ru": f"Далёкий {token()}"})
    stale = public_document(factory, title={"ru": f"Снятый {token()}"})
    embed(factory, source, vector(**{f"a{x}": 1.0}))
    embed(factory, nearer, vector(**{f"a{x}": 1.0, f"a{y}": 0.1}))
    embed(factory, near, vector(**{f"a{x}": 1.0, f"a{y}": 0.5}))
    embed(factory, far, vector(**{f"a{y}": 1.0}))
    embed(factory, stale, vector(**{f"a{x}": 1.0}))
    stale.workflow_status = WorkflowStatus.DRAFT  # unpublished without reindexing: stale index row
    factory.session.commit()

    body = recommend(api, source.id)

    ids = [item["id"] for item in body["items"]]
    assert body["method"] == "vector" and body["personal"] is False
    assert ids[:2] == [str(nearer.id), str(near.id)]
    assert str(far.id) not in ids and str(stale.id) not in ids and str(source.id) not in ids
    item = body["items"][1]
    assert item["href"] == f"/catalog/documents/{near.id}" and item["summary"] == "Описание близкого"
    assert item["document"]["file_access"] == "open"


def test_personal_history_shifts_and_is_excluded(api, factory):
    x, y = basis()
    source = public_document(factory, title={"ru": f"Источник {token()}"})
    viewed = public_document(factory, title={"ru": f"Просмотренный {token()}"})
    toward_x = public_document(factory, title={"ru": f"К оси X {token()}"})
    toward_y = public_document(factory, title={"ru": f"К оси Y {token()}"})
    hidden = public_document(factory, title={"ru": f"Скрытый {token()}"}, description_status=DescriptionStatus.DO_NOT_PUBLISH)
    embed(factory, source, vector(**{f"a{x}": 1.0, f"a{y}": 1.0}))
    embed(factory, viewed, vector(**{f"a{y}": 1.0}))
    embed(factory, toward_x, vector(**{f"a{x}": 1.0, f"a{y}": 0.7}))
    embed(factory, toward_y, vector(**{f"a{x}": 0.7, f"a{y}": 1.0}))

    plain = recommend(api, source.id)
    personal = recommend(api, source.id, seen=[str(viewed.id), str(hidden.id), str(uuid.uuid4())])

    assert personal["personal"] is True and plain["personal"] is False
    personal_ids = [item["id"] for item in personal["items"]]
    assert str(viewed.id) not in personal_ids
    assert personal_ids.index(str(toward_y.id)) < personal_ids.index(str(toward_x.id))
    # A non-public id in `seen` is ignored, not an error.
    only_hidden = recommend(api, source.id, seen=[str(hidden.id)])
    assert only_hidden["personal"] is False


def test_fallback_without_vectors_uses_tags_then_fund(api, factory):
    word = token()
    _, _, case = published_tree(factory)
    tag = factory.add(Tag(name={"ru": f"ДЕМО тема {word}"}, workflow_status=WorkflowStatus.PUBLISHED))
    draft_tag = factory.add(Tag(name={"ru": f"ДЕМО черновик {word}"}, workflow_status=WorkflowStatus.DRAFT))
    source = doc(factory, None, word)
    source.tags = [tag, draft_tag]
    tagged = doc(factory, None, word)
    tagged.tags = [tag]
    only_draft_tag = doc(factory, None, word)
    only_draft_tag.tags = [draft_tag]
    hidden_tagged = doc(factory, None, word, workflow_status=WorkflowStatus.DRAFT)
    hidden_tagged.tags = [tag]
    factory.session.commit()

    body = recommend(api, source.id)
    ids = [item["id"] for item in body["items"]]
    assert body["method"] == "fallback" and ids[0] == str(tagged.id)
    assert str(only_draft_tag.id) not in ids and str(hidden_tagged.id) not in ids

    in_case = doc(factory, case, word)
    sibling = doc(factory, case, word)
    body = recommend(api, in_case.id)
    assert str(sibling.id) in [item["id"] for item in body["items"]]


def test_not_public_source_is_404(api, factory):
    draft = public_document(factory, workflow_status=WorkflowStatus.DRAFT)
    response = api.get("/api/ai/recommendations", params={"type": "document", "id": str(draft.id)})
    assert response.status_code == 404
    response = api.get("/api/ai/recommendations", params={"type": "page", "id": str(draft.id)})
    assert response.status_code == 422


def test_card_related_puts_embedding_neighbours_first(api, factory):
    x, y = basis()
    source = public_document(factory, title={"ru": f"Источник {token()}"})
    neighbour = public_document(factory, title={"ru": f"Сосед {token()}"})
    embed(factory, source, vector(**{f"a{x}": 1.0}))
    embed(factory, neighbour, vector(**{f"a{x}": 1.0, f"a{y}": 0.2}))
    body = api.get(f"/api/catalog/documents/{source.id}").json()
    assert body["related"][0]["id"] == str(neighbour.id)
