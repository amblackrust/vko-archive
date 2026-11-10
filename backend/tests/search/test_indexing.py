"""T3.1: only public content is indexed; hiding a document removes its rows synchronously."""

from sqlalchemy import func, select

from app.config import get_settings
from app.models import Fund, News, SearchEntry, Tag
from app.models.base import EMBEDDING_DIM
from app.models.enums import DescriptionStatus, FileAccess, FundType, RoleCode, WorkflowStatus
from app.repositories import search as search_repo
from app.services import indexing, workflow
from tests.search.conftest import add_file, index, public_document, token


def _rows(session, obj_id) -> list[SearchEntry]:
    return list(session.scalars(select(SearchEntry).where(SearchEntry.object_id == obj_id)))


def test_public_document_is_indexed_with_tsvector(factory):
    word = token()
    document = public_document(factory, title={"ru": f"Приказ {word}", "kk": f"Бұйрық {word}"}, archive_code=f"ДЕМО {word}-1")
    assert index(factory, "document", document) == 2
    rows = _rows(factory.session, document.id)
    assert {r.lang for r in rows} == {"ru", "kk"}
    assert all(r.tsv is not None and r.embedding is None for r in rows)
    assert any(f"ДЕМО {word}-1" in r.body for r in rows)


def test_hidden_documents_are_not_indexed(factory):
    hidden = [
        public_document(factory, description_status=DescriptionStatus.DO_NOT_PUBLISH),
        public_document(factory, description_status=DescriptionStatus.NEEDS_REVIEW),
        public_document(factory, workflow_status=WorkflowStatus.APPROVED),
        public_document(factory, workflow_status=WorkflowStatus.ARCHIVED),
    ]
    for document in hidden:
        assert index(factory, "document", document) == 0
        assert _rows(factory.session, document.id) == []


def test_ocr_indexed_only_for_downloadable_files(factory):
    open_word, closed_word, review_word = token(), token(), token()
    document = public_document(factory)
    add_file(factory, document, ocr_text=f"Текст открытого скана {open_word}")
    add_file(factory, document, ocr_text=f"Текст закрытого скана {closed_word}", access=FileAccess.CLOSED)
    add_file(factory, document, ocr_text=f"Не проверено {review_word}", access=FileAccess.NEEDS_REVIEW)
    index(factory, "document", document)
    bodies = " ".join(r.body for r in _rows(factory.session, document.id))
    assert open_word in bodies
    assert closed_word not in bodies and review_word not in bodies

    # A document whose file_access is closed exposes no OCR even from an "open" file row.
    closed_doc = public_document(factory, file_access=FileAccess.CLOSED)
    add_file(factory, closed_doc, ocr_text=f"Скан {closed_word}")
    index(factory, "document", closed_doc)
    assert closed_word not in " ".join(r.body for r in _rows(factory.session, closed_doc.id))


def test_unpublished_fund_case_and_tags_do_not_reach_document_text(factory):
    fund_word, case_word, tag_word, open_tag_word = token(), token(), token(), token()
    fund, inventory, case = factory.catalog(None)  # draft fund/inventory/case
    fund.title = {"ru": f"Фонд {fund_word}"}
    case.title = {"ru": f"Дело {case_word}"}
    factory.session.commit()
    document = public_document(factory, case=case)
    document.tags = [factory.add(Tag(name={"ru": tag_word})),
                     factory.add(Tag(name={"ru": open_tag_word}, workflow_status=WorkflowStatus.PUBLISHED))]
    factory.session.commit()
    index(factory, "document", document)
    bodies = " ".join(r.body for r in _rows(factory.session, document.id))
    assert fund_word not in bodies and case_word not in bodies and tag_word not in bodies
    assert open_tag_word in bodies


def test_saving_a_container_reindexes_its_documents(factory):
    super_admin = factory.auth(factory.user(RoleCode.SUPER_ADMIN))
    fund_word, case_word = token(), token()
    fund, inventory, case = factory.catalog(None)
    document = public_document(factory, case=case)
    index(factory, "document", document)
    session = factory.session

    workflow.save_with_version(session, super_admin, "fund", fund, fund.version,
                               {"title": {"ru": f"Фонд {fund_word}"}, "workflow_status": WorkflowStatus.PUBLISHED})
    workflow.save_with_version(session, super_admin, "case", case, case.version,
                               {"title": {"ru": f"Дело {case_word}"}, "workflow_status": WorkflowStatus.PUBLISHED})
    bodies = " ".join(r.body for r in _rows(session, document.id))
    assert fund_word in bodies and case_word in bodies

    workflow.save_with_version(session, super_admin, "fund", fund, fund.version,
                               {"workflow_status": WorkflowStatus.ARCHIVED})
    session.commit()
    bodies = " ".join(r.body for r in _rows(session, document.id))
    assert fund_word not in bodies and case_word in bodies


def test_ocr_rows_remember_their_file(factory):
    document = public_document(factory)
    file = add_file(factory, document, ocr_text=f"Скан {token()}")
    index(factory, "document", document)
    rows = _rows(factory.session, document.id)
    assert {r.file_id for r in rows if r.chunk_no >= 1} == {file.id}
    assert all(r.file_id is None for r in rows if r.chunk_no == 0)


def test_workflow_unpublish_removes_rows_in_same_transaction(factory):
    super_admin = factory.auth(factory.user(RoleCode.SUPER_ADMIN))
    document = public_document(factory, workflow_status=WorkflowStatus.APPROVED)
    session = factory.session

    workflow.transition(session, super_admin, "document", document.id, "publish", 1, None, ip=None)
    assert _rows(session, document.id), "published + public document must be indexed"

    workflow.transition(session, super_admin, "document", document.id, "archive", 2, None, ip=None)
    assert _rows(session, document.id) == []


def test_do_not_publish_save_removes_rows_before_commit(factory):
    super_admin = factory.auth(factory.user(RoleCode.SUPER_ADMIN))
    document = public_document(factory)
    index(factory, "document", document)
    session = factory.session
    workflow.save_with_version(
        session, super_admin, "document", document, document.version,
        {"description_status": DescriptionStatus.DO_NOT_PUBLISH},
    )
    # Not committed yet: the removal is part of the same transaction as the change.
    assert _rows(session, document.id) == []
    session.rollback()
    assert _rows(session, document.id), "rollback restores both the change and the rows"


def test_reindex_all_drops_rows_of_hidden_and_deleted_objects(factory):
    fund = factory.add(Fund(number=f"T{token()[-6:]}", title={"ru": "ДЕМО фонд"}, type=FundType.PERSONAL,
                            workflow_status=WorkflowStatus.PUBLISHED))
    news = factory.add(News(title={"ru": "ДЕМО новость"}, workflow_status=WorkflowStatus.PUBLISHED, is_demo=True))
    index(factory, "fund", fund)
    index(factory, "news", news)
    news.workflow_status = WorkflowStatus.ARCHIVED
    factory.session.commit()

    indexing.reindex_all(factory.session)
    factory.session.commit()
    assert _rows(factory.session, fund.id)
    assert _rows(factory.session, news.id) == []


def test_unchanged_text_keeps_its_vector(factory):
    document = public_document(factory, title={"ru": f"Документ {token()}"})
    index(factory, "document", document)
    row = _rows(factory.session, document.id)[0]
    row.embedding = [0.1] * EMBEDDING_DIM
    factory.session.commit()

    index(factory, "document", document)
    assert _rows(factory.session, document.id)[0].embedding is not None

    document.title = {"ru": f"Новое название {token()}"}
    factory.session.commit()
    index(factory, "document", document)
    assert _rows(factory.session, document.id)[0].embedding is None


def test_embed_pending_fills_vectors_and_survives_ollama_outage(factory, monkeypatch):
    document = public_document(factory)
    index(factory, "document", document)
    settings = get_settings()

    # Ollama down (autouse fixture): nothing embedded, no exception.
    assert indexing.embed_pending(factory.session, settings) == 0

    monkeypatch.setattr(indexing, "embed_texts", lambda texts, *a, **k: [[0.5] * EMBEDDING_DIM for _ in texts])
    assert indexing.embed_pending(factory.session, settings) >= 1
    missing = factory.session.scalar(
        select(func.count()).where(SearchEntry.object_id == document.id, SearchEntry.embedding.is_(None))
    )
    assert missing == 0


def test_embed_pending_does_not_run_concurrently(factory, engine, monkeypatch):
    document = public_document(factory, title={"ru": f"Документ {token()}"})
    index(factory, "document", document)
    calls: list[int] = []
    monkeypatch.setattr(indexing, "embed_texts", lambda texts, *a, **k: calls.append(1) or [[0.5] * EMBEDDING_DIM for _ in texts])
    with engine.connect() as other:
        assert search_repo.try_advisory_lock(other, indexing.EMBED_LOCK_KEY)
        try:
            assert indexing.embed_pending(factory.session, get_settings()) == 0
            assert calls == []
        finally:
            search_repo.advisory_unlock(other, indexing.EMBED_LOCK_KEY)
            other.commit()
    assert indexing.embed_pending(factory.session, get_settings(), max_rows=1) == 1
    assert calls == [1]


def test_embed_pending_keeps_no_transaction_open_during_ollama_call(factory, engine, monkeypatch):
    document = public_document(factory, title={"ru": f"Документ {token()}"})
    index(factory, "document", document)
    seen: list[bool] = []

    def fake_embed(texts, *a, **k):
        seen.append(factory.session.in_transaction())
        return [[0.5] * EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(indexing, "embed_texts", fake_embed)
    assert indexing.embed_pending(factory.session, get_settings(), max_rows=2) >= 1
    assert seen and not any(seen)


def test_chunk_text_respects_size():
    chunks = indexing.chunk_text("слово " * 1000 + "x" * 3000, size=100)
    assert all(len(c) <= 100 for c in chunks)
    assert "".join(chunks).replace(" ", "") == ("слово" * 1000 + "x" * 3000)


def test_strip_html():
    assert indexing.strip_html("<p>Архив&nbsp;<b>ВКО</b></p><script>x</script>") == "Архив ВКО x"
