"""T3.2: unified hybrid search; hidden documents never leak (results, facets, snippets)."""

import pytest

from app.ai import embeddings
from app.models import Branch, Fund, SearchEntry, Synonym
from app.models.base import EMBEDDING_DIM
from app.models.enums import BranchType, DescriptionStatus, FileAccess, FundType, WorkflowStatus
from app.repositories import search as search_repo
from app.services import search as search_service
from app.services.search import build_query
from tests.search.conftest import add_file, index, public_document, token


def _search(api, **params):
    response = api.get("/api/search", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _ids(body) -> set[str]:
    return {item["id"] for group in body["groups"] for item in group["items"]}


def test_build_query_expands_synonyms_and_quotes_only_words():
    plan = build_query("приказы Лениногорск 1952", [["Риддер", "Лениногорск"]])
    assert plan.and_query == "'прика':* & (('лениногор':*) | ('ридде':*)) & '1952'"
    assert plan.expanded == ["риддер"]
    multi = build_query("ВОВ", [["ВОВ", "Великая Отечественная война"]])
    assert "'велик':* <-> 'отечественн':* <-> 'война':*" in multi.and_query
    hostile = build_query("x' | !(:* & ) '; DROP TABLE", [])
    assert "drop" in hostile.and_query and ";" not in hostile.and_query and "!" not in hostile.and_query
    assert build_query("  ;; ", []).and_query is None
    assert build_query("о и в", []).and_query == "'о' & 'и' & 'в'"  # only stopwords: kept


def test_search_groups_items_and_builds_links(api, factory):
    word = token()
    document = public_document(factory, title={"ru": f"Приказ {word}"}, archive_code=f"ДЕМО-{word}", doc_type="order")
    fund = factory.add(Fund(number=f"T{word[-5:]}", title={"ru": f"Фонд {word}"}, type=FundType.ORGANIZATION,
                            workflow_status=WorkflowStatus.PUBLISHED))
    index(factory, "document", document)
    index(factory, "fund", fund)

    body = _search(api, q=word)
    assert body["total"] == 2 and body["semantic"] is False
    assert [g["type"] for g in body["groups"]] == ["document", "fund"]
    item = body["groups"][0]["items"][0]
    assert item["id"] == str(document.id)
    assert item["href"] == f"/catalog/documents/{document.id}"
    assert item["document"]["archive_code"] == f"ДЕМО-{word}"
    assert item["document"]["file_access"] == "open"
    assert "fts" in item["matched"]
    assert "<mark>" in item["snippet"]
    assert body["groups"][1]["items"][0]["href"] == f"/catalog/funds/{fund.id}"
    assert {f["value"]: f["count"] for f in body["facets"]["type"]} == {"document": 1, "fund": 1}


def test_hidden_documents_never_leak_even_with_stale_rows(api, factory):
    word = token()
    visible = public_document(factory, title={"ru": f"Открытый {word}"}, doc_type="order")
    index(factory, "document", visible)
    hidden = [
        public_document(factory, title={"ru": f"Скрытый {word}"}, doc_type="secret",
                        description_status=DescriptionStatus.DO_NOT_PUBLISH, summary={"ru": "тайная справка"}),
        public_document(factory, title={"ru": f"Непроверенный {word}"}, doc_type="secret",
                        description_status=DescriptionStatus.NEEDS_REVIEW),
        public_document(factory, title={"ru": f"Черновик {word}"}, doc_type="secret",
                        workflow_status=WorkflowStatus.DRAFT),
    ]
    # Simulate a stale index (e.g. a status changed by raw SQL without the hook).
    for document in hidden:
        search_repo.add_entry(factory.session, object_type="document", object_id=document.id, lang="ru",
                              chunk_no=0, title=document.title["ru"], body=f"тайная справка {word}")
    factory.session.commit()

    body = _search(api, q=word)
    assert _ids(body) == {str(visible.id)}
    assert body["total"] == 1
    assert {f["value"] for f in body["facets"]["doc_type"]} == {"order"}
    text = str(body)
    assert "тайная" not in text and "Скрытый" not in text and "secret" not in text


def test_closed_file_ocr_is_not_searchable(api, factory):
    closed_word, open_word = token(), token()
    document = public_document(factory, title={"ru": f"Документ {token()}"})
    add_file(factory, document, ocr_text=f"секретный текст {closed_word}", access=FileAccess.CLOSED)
    add_file(factory, document, ocr_text=f"открытый текст {open_word}")
    index(factory, "document", document)

    assert _search(api, q=closed_word)["total"] == 0
    body = _search(api, q=open_word)
    assert _ids(body) == {str(document.id)}
    assert open_word in body["groups"][0]["items"][0]["snippet"]  # snippet from the OCR chunk
    assert "master_path" not in str(body) and "masters/" not in str(body)


def test_synonyms_and_typos(api, factory):
    word = token()
    old_name, new_name = f"старгород{word[-6:]}", f"новгород{word[-6:]}"
    factory.add(Synonym(terms=[old_name.capitalize(), new_name.capitalize()]))
    document = public_document(factory, title={"ru": f"Справка о населении {old_name.capitalize()}а"})
    index(factory, "document", document)

    body = _search(api, q=new_name)
    assert str(document.id) in _ids(body)
    assert old_name in body["expanded"]

    # Typo inside the word: FTS finds nothing, trigram similarity to the title does.
    typo = old_name[:4] + ("ы" if old_name[4] != "ы" else "э") + old_name[5:]
    found = _search(api, q=typo)
    hit = next(i for g in found["groups"] for i in g["items"] if i["id"] == str(document.id))
    assert hit["matched"] == ["trigram"]


def test_facets_are_disjunctive_and_filters_apply(api, factory):
    word = token()
    branch = factory.add(Branch(name={"ru": "ДЕМО филиал"}, short_name={"ru": "ДЕМО"}, type=BranchType.DISTRICT,
                                slug=f"b-{word}", workflow_status=WorkflowStatus.PUBLISHED))
    order = public_document(factory, title={"ru": f"Приказ {word}"}, doc_type="order", period="1950s", branch_id=branch.id)
    photo = public_document(factory, title={"ru": f"Фото {word}"}, doc_type="photo", period="1960s")
    fund = factory.add(Fund(number=f"T{word[-5:]}", title={"ru": f"Фонд {word}"}, type=FundType.ORGANIZATION,
                            workflow_status=WorkflowStatus.PUBLISHED))
    for object_type, obj in (("document", order), ("document", photo), ("fund", fund)):
        index(factory, object_type, obj)

    body = _search(api, q=word, doc_type="order")
    assert _ids(body) == {str(order.id)}  # document filter hides other types
    assert {f["value"]: f["count"] for f in body["facets"]["doc_type"]} == {"order": 1, "photo": 1}
    assert {f["value"]: f["count"] for f in body["facets"]["period"]} == {"1950s": 1}
    assert body["facets"]["branch"] == [{"value": str(branch.id), "label": "ДЕМО", "count": 1}]

    only_funds = _search(api, q=word, types="fund")
    assert _ids(only_funds) == {str(fund.id)}
    assert {f["value"]: f["count"] for f in only_funds["facets"]["type"]} == {"document": 2, "fund": 1}

    paged = _search(api, q=word, types="document", per_group=1, offset=1)
    assert paged["groups"][0]["total"] == 2 and len(paged["groups"][0]["items"]) == 1


def test_snippet_is_html_escaped(api, factory):
    word = token()
    document = public_document(factory, title={"ru": f"Документ {word}"},
                               summary={"ru": f"{word} условие 5 < 6 & 7 > 2 <script>alert(1)</script> <img src=x onerror=y>"})
    index(factory, "document", document)
    snippet = _search(api, q=word)["groups"][0]["items"][0]["snippet"]
    assert "<script" not in snippet and "<img" not in snippet
    assert "&lt;" in snippet and "&amp;" in snippet
    assert snippet.replace("<mark>", "").replace("</mark>", "").count("<") == 0


def test_snippet_markers_become_mark_tags():
    raw = f"a <b> {search_repo.HL_START}слово{search_repo.HL_STOP}"
    assert search_service._snippet_html(raw) == "a &lt;b&gt; <mark>слово</mark>"


def test_language_fallback(api, factory):
    word = token()
    document = public_document(factory, title={"ru": f"Только по-русски {word}"})
    index(factory, "document", document)
    item = _search(api, q=word, lang="kk")["groups"][0]["items"][0]
    assert item["lang"] == "ru" and word in item["title"]


def test_vector_hits_are_fused(api, factory, monkeypatch):
    word = token()
    document = public_document(factory, title={"ru": f"Семантика {word}"})
    index(factory, "document", document)
    vector = [0.0] * EMBEDDING_DIM
    vector[0] = 1.0
    entry = factory.session.query(SearchEntry).filter(SearchEntry.object_id == document.id).one()
    entry.embedding = vector
    factory.session.commit()

    monkeypatch.setattr(search_service, "embed_query", lambda *a, **k: vector)
    body = _search(api, q="совсем другие слова")
    assert body["semantic"] is True
    hit = next(i for g in body["groups"] for i in g["items"] if i["id"] == str(document.id))
    assert hit["matched"] == ["vector"]


def test_degrades_without_ollama(api, factory, monkeypatch):
    from app.config import get_settings
    from app.main import app

    word = token()
    document = public_document(factory, title={"ru": f"Без ИИ {word}"})
    index(factory, "document", document)
    monkeypatch.setattr(search_service, "embed_query", embeddings.embed_query)  # real client
    embeddings.reset_failure_state()
    dead = get_settings().model_copy(update={"ollama_url": "http://127.0.0.1:9"})
    app.dependency_overrides[get_settings] = lambda: dead
    try:
        body = _search(api, q=word)
    finally:
        app.dependency_overrides.pop(get_settings, None)
        embeddings.reset_failure_state()
    assert body["semantic"] is False
    assert _ids(body) == {str(document.id)}


@pytest.mark.parametrize("params", [{"q": ""}, {"q": "   "}, {"q": "!!!"}])
def test_empty_query(api, params):
    body = _search(api, **params)
    assert body["total"] == 0 and body["groups"] == []


def test_invalid_params(api):
    assert api.get("/api/search", params={"q": "x", "lang": "de"}).status_code == 422
    assert api.get("/api/search", params={"q": "x", "types": "user"}).status_code == 422
    assert api.get("/api/search", params={"q": "x", "per_group": 500}).status_code == 422
