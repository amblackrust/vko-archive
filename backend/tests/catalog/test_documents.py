"""T3.3: `GET /api/catalog/documents` -- filters, sorting, pagination, facets, visibility."""

from datetime import date

import pytest

from app.models import Branch, Tag
from app.models.enums import BranchType, DescriptionStatus, FileAccess, FundType, RoleCode, WorkflowStatus
from app.services import indexing
from tests.admin.conftest import login
from tests.catalog.conftest import doc, get, published_tree, token
from tests.search.conftest import add_file


def titles(body: dict) -> list[str]:
    return [item["title"] for item in body["items"]]


def facet(body: dict, name: str) -> dict[str, int]:
    return {v["value"]: v["count"] for v in body["facets"][name]}


def test_only_public_documents_in_list_facets_and_counts(api, factory):
    word = token()
    _, _, case = published_tree(factory)
    shown = doc(factory, case, word, doc_type="order")
    doc(factory, case, word, workflow_status=WorkflowStatus.DRAFT, doc_type="secret1")
    doc(factory, case, word, description_status=DescriptionStatus.DO_NOT_PUBLISH, doc_type="secret2")
    doc(factory, case, word, description_status=DescriptionStatus.NEEDS_REVIEW, doc_type="secret3")
    doc(factory, case, word, workflow_status=WorkflowStatus.ARCHIVED, doc_type="secret4")

    body = get(api, "documents", title=word)
    assert body["total"] == 1 and [i["id"] for i in body["items"]] == [str(shown.id)]
    assert facet(body, "doc_type") == {"order": 1}
    assert get(api, "documents", title=word, doc_type="secret1")["total"] == 0
    assert "master_path" not in str(body) and "preview_path" not in str(body)  # no file paths in the contract


def test_sql_visibility_matches_the_python_rule(api, factory):
    word = token()
    for workflow in WorkflowStatus:
        for status in DescriptionStatus:
            d = doc(factory, None, word, workflow_status=workflow, description_status=status)
            expected = indexing.document_is_public(d)
            found = get(api, "documents", title=word, per_page=100)["items"]
            assert (str(d.id) in {i["id"] for i in found}) is expected, (workflow, status)


def test_hidden_parents_are_not_linked_or_matched(api, factory):
    word = token()
    fund, inventory, case = published_tree(factory)
    fund.number = f"Ф{word[-6:]}"
    factory.session.commit()
    d = doc(factory, case, word)
    item = get(api, "documents", title=word)["items"][0]
    assert item["fund"]["number"] == fund.number and item["case"]["href"] == f"/catalog/cases/{case.id}"
    assert get(api, "documents", title=word, fund_number=fund.number)["total"] == 1

    inventory.workflow_status = WorkflowStatus.DRAFT
    factory.session.commit()
    body = get(api, "documents", title=word)
    assert body["total"] == 1 and body["items"][0]["id"] == str(d.id)
    assert body["items"][0]["fund"] is None and body["items"][0]["case"] is None
    assert get(api, "documents", title=word, fund_number=fund.number)["total"] == 0
    assert facet(body, "fund_type") == {}


def test_filters(api, factory):
    word = token()
    fund, inventory, case = published_tree(factory, type=FundType.PERSONAL)
    branch = factory.add(Branch(name={"ru": "ДЕМО филиал"}, type=BranchType.DISTRICT, slug=f"b-{word}",
                                workflow_status=WorkflowStatus.PUBLISHED))
    tag = factory.add(Tag(name={"ru": f"Тема {word}"}, workflow_status=WorkflowStatus.PUBLISHED))
    a = doc(factory, case, word, doc_type="photo", period="1950s", language="ru", authors={"ru": "Автор Альфа"},
            places=[{"ru": "Риддер"}], date_from=date(1952, 3, 1), date_to=date(1953, 1, 1), has_digital_copy=True,
            branch_id=branch.id, summary={"ru": "Общее описание"})
    a.tags = [tag]
    factory.session.commit()
    b = doc(factory, None, word, doc_type="map", period="1960s", language="kk", date_from=date(1965, 1, 1),
            date_to=date(1965, 12, 31), authors={"ru": "Автор Бета"})

    def ids(**params) -> set[str]:
        return {i["id"] for i in get(api, "documents", title=word, **params)["items"]}

    assert ids() == {str(a.id), str(b.id)}
    assert ids(doc_type="photo") == {str(a.id)}
    assert ids(doc_type=["photo", "map"]) == {str(a.id), str(b.id)}
    assert ids(period="1960s") == {str(b.id)}
    assert ids(year=1953) == {str(a.id)} and ids(year=1951) == set()
    assert ids(date_from="1960-01-01") == {str(b.id)}
    assert ids(date_to="1952-12-31") == {str(a.id)}
    assert ids(author="альфа") == {str(a.id)}
    assert ids(place="ридд") == {str(a.id)}
    assert ids(keyword=word) == {str(a.id)}  # tag name
    assert ids(topic=str(tag.id)) == {str(a.id)}
    assert ids(branch_id=str(branch.id)) == {str(a.id)}
    assert ids(language="kk") == {str(b.id)}
    assert ids(has_digital_copy="true") == {str(a.id)}
    assert ids(has_digital_copy="false") == {str(b.id)}
    assert ids(category="photos") == {str(a.id)} and ids(category="maps") == {str(b.id)}
    assert ids(fund_type="personal") == {str(a.id)}
    assert ids(category="personal") == {str(a.id)}
    assert ids(case_number=case.number, inventory_number=inventory.number, fund_number=fund.number) == {str(a.id)}
    assert ids(q="общее описание") == {str(a.id)}
    assert ids(q="бета") == {str(b.id)}
    assert ids(q="50%") == set()  # LIKE wildcards are escaped
    assert ids(q="_") == set()
    assert ids(doc_type="photo", period="1960s") == set()


def test_facets_are_disjunctive_and_counted(api, factory):
    word = token()
    doc(factory, None, word, doc_type="photo", period="1950s")
    doc(factory, None, word, doc_type="photo", period="1960s")
    doc(factory, None, word, doc_type="map", period="1960s")
    body = get(api, "documents", title=word, doc_type="photo")
    assert body["total"] == 2
    assert facet(body, "doc_type") == {"photo": 2, "map": 1}  # own filter skipped
    assert facet(body, "period") == {"1950s": 1, "1960s": 1}  # other filters applied
    assert body["facets"]["category"][1] == {"value": "photos", "label": None, "count": 2}


def test_sorting_and_pagination(api, factory):
    word = token()
    for code, title, day in (("B-2", "Бета", 3), ("A-1", "Яблоко", 2), ("C-3", "Альфа", 1)):
        doc(factory, None, word, title={"ru": f"{title} {word}"}, archive_code=f"{word}-{code}", date_from=date(1950, 1, day))
    assert [i["archive_code"][-3:] for i in get(api, "documents", title=word, sort="code")["items"]] == ["A-1", "B-2", "C-3"]
    assert titles(get(api, "documents", title=word, sort="title"))[0].startswith("Альфа")
    assert titles(get(api, "documents", title=word, sort="date_asc"))[0].startswith("Альфа")
    assert titles(get(api, "documents", title=word, sort="date_desc"))[0].startswith("Бета")
    relevance = get(api, "documents", q=word)
    assert relevance["sort"] == "relevance" and relevance["total"] == 3
    assert get(api, "documents", title=word)["sort"] == "relevance"
    assert get(api, "documents")["sort"] == "code"  # no text query: relevance falls back to code

    second = get(api, "documents", title=word, sort="code", per_page=2, page=2)
    assert second["total"] == 3 and second["pages"] == 2 and len(second["items"]) == 1
    assert get(api, "documents", title=word, per_page=2, page=9)["items"] == []


def test_titles_fall_back_between_languages(api, factory):
    word = token()
    doc(factory, None, word, title={"ru": f"Русское {word}"})
    item = get(api, "documents", title=word, lang="en")["items"][0]
    assert item["title"].startswith("Русское") and item["title_lang"] == "ru"


@pytest.mark.parametrize(
    "params",
    [{"per_page": 0}, {"per_page": 101}, {"page": 0}, {"sort": "bad"}, {"year": 5}, {"category": "bad"}, {"topic": "x"},
     {"lang": "de"}, {"has_digital_copy": "maybe"}, {"fund_type": "x"}],
)
def test_bad_parameters_are_rejected(api, params):
    assert api.get("/api/catalog/documents", params=params).status_code == 422


def test_list_items_have_a_thumbnail_only_for_files_open_to_everyone(api, factory):
    word = token()
    _, _, case = published_tree(factory)
    shown = doc(factory, case, word, has_digital_copy=True)
    add_file(factory, shown, position=0, master_path="masters/secret/a.pdf", mime="application/pdf")  # no preview
    add_file(factory, shown, position=1, preview_path="previews/secret/closed.jpg", access=FileAccess.CLOSED)
    first_open = add_file(factory, shown, position=2, preview_path="previews/secret/b.jpg")
    add_file(factory, shown, position=3, preview_path="previews/secret/c.jpg")
    hidden = {
        access: doc(factory, case, word, file_access=access)
        for access in (FileAccess.RESTRICTED, FileAccess.CLOSED, FileAccess.NEEDS_REVIEW)
    }
    hidden_files = [add_file(factory, d, preview_path="previews/secret/x.jpg") for d in hidden.values()]
    unreviewed = doc(factory, case, word)  # an open document whose only copy is not reviewed yet
    add_file(factory, unreviewed, preview_path="previews/secret/y.jpg", access=FileAccess.NEEDS_REVIEW)
    bare = doc(factory, case, word)

    expected = {str(d.id): None for d in (*hidden.values(), unreviewed, bare)}
    expected[str(shown.id)] = f"/api/files/{first_open.id}?variant=preview"
    for body in (get(api, "documents", title=word), get(api, f"cases/{case.id}")["documents"]):
        assert {i["id"]: i["preview_url"] for i in body["items"]} == expected
        assert "secret" not in str(body) and "preview_path" not in str(body)
    card = get(api, f"documents/{bare.id}")
    assert card["preview_url"] is None
    assert {i["id"]: i["preview_url"] for i in card["related"]} == {k: v for k, v in expected.items() if k != str(bare.id)}

    # Staff rights do not widen the public list, and the file route still decides on its own.
    login(api, factory.user(RoleCode.ARCHIVIST).email)
    assert {i["id"]: i["preview_url"] for i in get(api, "documents", title=word)["items"]} == expected
    api.cookies.clear()
    for file in hidden_files:
        assert api.get(f"/api/files/{file.id}", params={"variant": "preview"}).status_code == 404

    # Closing the copies takes the thumbnail away at once.
    shown.file_access = FileAccess.RESTRICTED
    factory.session.commit()
    assert all(i["preview_url"] is None for i in get(api, "documents", title=word)["items"])
    assert api.get(f"/api/files/{first_open.id}", params={"variant": "preview"}).status_code == 404
