import uuid

from sqlalchemy import delete, select

from app.models import FAQ, News, Page, SiteSetting, Synonym, WorkflowHistory
from app.models.enums import RoleCode
from tests.admin.conftest import login

URL = "/api/admin"


def _as(api, user):
    api.cookies.clear()
    login(api, user.email)


def _slug() -> str:
    return f"demo-{uuid.uuid4().hex[:8]}"


def _drop(factory, model, object_id):
    s = factory.session
    s.rollback()
    s.execute(delete(WorkflowHistory).where(WorkflowHistory.object_id == uuid.UUID(object_id)))
    s.execute(delete(model).where(model.id == uuid.UUID(object_id)))
    s.commit()


def test_news_html_is_sanitized_and_publication_only_by_workflow(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    dirty = '<p onclick="x()">Привет</p><script>alert(1)</script><a href="javascript:alert(1)">ссылка</a>'
    created = api.post(f"{URL}/content/news", json={"slug": _slug(), "title": {"ru": "ДЕМО новость"}, "body": {"ru": dirty}})
    assert created.status_code == 201, created.text
    body = created.json()["values"]["body"]["ru"]
    assert "script" not in body and "onclick" not in body and "javascript:" not in body and "Привет" in body
    news_id = created.json()["id"]
    assert created.json()["workflow_status"] == "draft"

    assert api.patch(f"{URL}/content/news/{news_id}", json={"version": 1, "workflow_status": "published"}).status_code == 422
    updated = api.patch(f"{URL}/content/news/{news_id}", json={"version": 1, "body": {"ru": "<iframe src='x'></iframe><b>ok</b>"}})
    assert updated.status_code == 200 and updated.json()["version"] == 2
    assert "iframe" not in updated.json()["values"]["body"]["ru"]
    assert api.patch(f"{URL}/content/news/{news_id}", json={"version": 1, "category": "x"}).status_code == 409
    assert api.patch(f"{URL}/content/news/{news_id}", json={"version": 2, "cover_file_id": str(uuid.uuid4())}).json()["detail"] == "file_not_owned"
    # The editor cannot publish; the version history has both saves.
    assert api.post(f"{URL}/workflow/news/{news_id}/transitions", json={"action": "publish", "version": 2}).status_code in (403, 409)
    history = factory.session.scalars(select(WorkflowHistory).where(WorkflowHistory.object_id == uuid.UUID(news_id))).all()
    assert len(history) == 2
    assert api.delete(f"{URL}/content/news/{news_id}").status_code == 403
    _drop(factory, News, news_id)


def test_page_seo_key_and_faq_validation(api, factory):
    admin = factory.user(RoleCode.SITE_ADMIN)
    _as(api, admin)
    key = _slug()
    page = api.post(
        f"{URL}/content/page",
        json={"key": key, "title": {"ru": "ДЕМО страница"}, "seo_title": {"ru": "SEO"}, "seo_description": {"ru": "d"}, "seo_keywords": {"ru": "k"}},
    )
    assert page.status_code == 201, page.text
    assert page.json()["values"]["seo_title"] == {"ru": "SEO"}
    assert api.post(f"{URL}/content/page", json={"key": key, "title": {"ru": "x"}}).json()["detail"] == "slug_taken"
    assert api.patch(f"{URL}/content/page/{page.json()['id']}", json={"version": 1, "key": "other"}).status_code == 422
    assert factory.session.scalar(select(Page.slug).where(Page.key == key)) == key
    faq = api.post(f"{URL}/content/faq", json={"category": "site", "question": {"ru": "Вопрос"}})
    assert faq.json()["detail"] == "invalid_input"
    faq = api.post(f"{URL}/content/faq", json={"category": "site", "question": {"ru": "Вопрос?"}, "answer": {"ru": "Ответ."}})
    assert faq.status_code == 201
    assert api.get(f"{URL}/content/unknown").status_code == 404
    assert api.get(f"{URL}/content/collection").status_code == 404
    assert api.get(f"{URL}/content/news?q=zzz-none").json()["total"] == 0
    for kind, model, ident in (("page", Page, page.json()["id"]), ("faq", FAQ, faq.json()["id"])):
        assert api.delete(f"{URL}/content/{kind}/{ident}").status_code == 204
    factory.session.rollback()


def test_price_list_and_legal_links(api, factory):
    admin = factory.user(RoleCode.SITE_ADMIN)
    _as(api, admin)
    r = api.post(f"{URL}/content/price_list_item", json={"name": {"ru": "ДЕМО услуга"}, "price": "1500.50", "legal_act_id": str(uuid.uuid4())})
    assert r.json()["detail"] == "unknown_link"
    r = api.post(f"{URL}/content/price_list_item", json={"name": {"ru": "ДЕМО услуга"}, "price": "-1"})
    assert r.status_code == 422
    r = api.post(f"{URL}/content/price_list_item", json={"name": {"ru": "ДЕМО услуга"}, "price": "1500.50", "unit": {"ru": "за лист"}})
    assert r.status_code == 201 and r.json()["values"]["price"] == 1500.5
    assert api.post(f"{URL}/content/legal_act", json={"slug": _slug(), "title": {"ru": "ДЕМО НПА"}, "adilet_url": "javascript:1"}).status_code == 422
    act = api.post(f"{URL}/content/legal_act", json={"slug": _slug(), "title": {"ru": "ДЕМО НПА"}, "adilet_url": "https://adilet.zan.kz/rus/docs/X"})
    assert act.status_code == 201
    assert api.delete(f"{URL}/content/price_list_item/{r.json()['id']}").status_code == 204
    assert api.delete(f"{URL}/content/legal_act/{act.json()['id']}").status_code == 204
    factory.session.rollback()


def test_settings_and_synonyms_admins_only(api, factory):
    editor = factory.user(RoleCode.EDITOR)
    _as(api, editor)
    assert api.get(f"{URL}/settings").status_code == 403
    assert api.put(f"{URL}/settings/social", json={"value": {}}).status_code == 403
    assert api.post(f"{URL}/synonyms", json={"terms": ["a", "b"]}).status_code == 403
    admin = factory.user(RoleCode.SITE_ADMIN)
    _as(api, admin)
    before = api.get(f"{URL}/settings").json()
    assert set(before) == {"social", "widgets", "survey", "counter", "useful_links"}
    assert api.put(f"{URL}/settings/social", json={"value": {"instagram": {"url": "javascript:1"}}}).status_code == 422
    assert api.put(f"{URL}/settings/unknown", json={"value": {}}).status_code == 404
    seeded = factory.session.get(SiteSetting, "social")
    assert (seeded is None) or "instagram" in api.get(f"{URL}/settings").json()["social"]
    saved = api.put(f"{URL}/settings/survey", json={"value": {"enabled": True, "url": "https://example.org/s", "question": {"ru": "ДЕМО?"}}})
    assert saved.status_code == 200 and api.get(f"{URL}/settings").json()["survey"]["enabled"] is True
    factory.session.execute(delete(SiteSetting).where(SiteSetting.key == "survey"))
    factory.session.commit()

    syn = api.post(f"{URL}/synonyms", json={"terms": ["ДЕМО-Город", "ДЕМО-Қала", "ДЕМО-Город"]})
    assert syn.status_code == 201 and len(syn.json()["terms"]) == 2
    assert api.post(f"{URL}/synonyms", json={"terms": ["один"]}).status_code == 422
    assert api.patch(f"{URL}/synonyms/{syn.json()['id']}", json={"is_active": False}).json()["is_active"] is False
    assert api.delete(f"{URL}/synonyms/{syn.json()['id']}").status_code == 204
    factory.session.rollback()
    assert factory.session.get(Synonym, uuid.UUID(syn.json()["id"])) is None
