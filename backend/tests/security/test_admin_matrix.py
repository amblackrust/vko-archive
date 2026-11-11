"""Role × endpoint matrix of the whole admin API (T7.6, PLAN.md §5).

`OPS` lists every admin operation with the permissions it needs; a test fails if the API
gains an operation that is not listed here. Checked for every operation: anonymous → 401,
a signed-in employee without permissions → 403 (on real objects, so no 404 shortcut), no
CSRF header → 403. Reads are checked for every role against the default matrix; mutations
of a branch-scoped role on another branch's objects → 403.
"""

import re
import uuid
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Collection, DigitalFile, Exhibit, Exhibition, News, Notification, Person, Synonym
from app.models.enums import FileAccess, RoleCode
from app.security import CSRF_HEADER
from app.services.authz import DEFAULT_ROLE_PERMISSIONS
from tests.admin.conftest import Factory, login

ADMIN = "/api/admin"
SELF = ()  # any signed-in employee (own session, own notifications)


@dataclass(frozen=True)
class Op:
    method: str
    path: str  # relative to /api/admin, placeholders filled from the `world` fixture
    needs: tuple[str, ...]  # permissions that all must be granted
    body: Any = None
    raw: bytes | None = None


CATALOG_DOC = "/catalog/document/{doc}"
OPS: list[Op] = [
    # session and own data
    Op("GET", "/auth/me", SELF),
    Op("POST", "/auth/password", SELF, {"current_password": "wrong-password", "new_password": "Another-Pass-42"}),
    Op("POST", "/auth/logout", SELF),
    Op("GET", "/notifications", SELF),
    Op("POST", "/notifications/read-all", SELF),
    Op("POST", "/notifications/{notification}/read", SELF),
    Op("GET", "/dashboard", SELF),
    Op("GET", "/import/fields", SELF),  # static description of the import format
    # catalog
    Op("GET", "/catalog/branch-options", ("catalog.view",)),
    Op("GET", "/catalog/document", ("catalog.view",)),
    Op("POST", "/catalog/document", ("catalog.create",), {}),
    Op("GET", CATALOG_DOC, ("catalog.view",)),
    Op("PATCH", CATALOG_DOC, ("catalog.edit",), {"version": 1}),
    Op("DELETE", CATALOG_DOC, ("catalog.delete",)),
    Op("GET", "/import/branches", ("catalog.import",)),
    Op("POST", "/import/preview", ("catalog.import",), raw=b"archive_code;title_ru\n"),
    Op("POST", "/import/apply", ("catalog.import",), raw=b"archive_code;title_ru\n"),
    Op("GET", "/export/documents", ("catalog.export",)),
    Op("GET", "/workflow/document/{doc}/history", ("catalog.view",)),
    Op("POST", "/workflow/document/{doc}/transitions", ("workflow.submit", "catalog.edit"), {"action": "submit", "version": 1}),
    # files
    Op("GET", "/uploads?owner_type=document&owner_id={doc}", ("files.view", "catalog.view")),
    Op("POST", "/uploads?owner_type=document&owner_id={doc}&filename=a.jpg", ("files.upload", "catalog.edit"), raw=b"x"),
    Op("PATCH", "/uploads/{file}", ("files.upload", "catalog.edit"), {}),
    Op("DELETE", "/uploads/{file}", ("files.delete", "catalog.edit")),
    # content
    Op("GET", "/content/news", ("content.view",)),
    Op("POST", "/content/news", ("content.create",), {}),
    Op("GET", "/content/news/{news}", ("content.view",)),
    Op("PATCH", "/content/news/{news}", ("content.edit",), {"version": 1}),
    Op("DELETE", "/content/news/{news}", ("content.delete",)),
    Op("GET", "/memory/person", ("content.view",)),
    Op("POST", "/memory/person", ("content.create",), {}),
    Op("GET", "/memory/person/{person}", ("content.view",)),
    Op("PATCH", "/memory/person/{person}", ("content.edit",), {"version": 1}),
    Op("DELETE", "/memory/person/{person}", ("content.delete",)),
    Op("PUT", "/memory/person/{person}/documents", ("content.edit",), {"version": 1, "document_ids": []}),
    Op("PUT", "/memory/collection/{collection}/items", ("content.edit",), {"version": 1, "items": []}),
    Op("GET", "/exhibitions", ("content.view",)),
    Op("POST", "/exhibitions", ("content.create",), {}),
    Op("GET", "/exhibitions/{exhibition}", ("content.view",)),
    Op("PATCH", "/exhibitions/{exhibition}", ("content.edit",), {"version": 1}),
    Op("DELETE", "/exhibitions/{exhibition}", ("content.delete",)),
    Op("GET", "/exhibitions/{exhibition}/exhibits", ("content.view",)),
    Op("PUT", "/exhibitions/{exhibition}/exhibits/order", ("content.edit",), {"ids": []}),
    Op("POST", "/exhibits", ("content.create",), {}),
    Op("GET", "/exhibits/{exhibit}", ("content.view",)),
    Op("PATCH", "/exhibits/{exhibit}", ("content.edit",), {"version": 1}),
    Op("DELETE", "/exhibits/{exhibit}", ("content.delete",)),
    Op("GET", "/translations", ("catalog.view",)),  # default object_type=document
    Op("GET", "/translations/document/{doc}", ("catalog.view",)),
    Op("POST", "/translations/text", ("settings.edit",), {"text": "Привет", "source_lang": "ru", "target_lang": "kk"}),
    Op("POST", "/translations/document/{doc}/machine", ("catalog.edit", "ai.use"), {"source_lang": "ru", "target_lang": "kk", "version": 1}),
    Op("POST", "/translations/document/{doc}/verify", ("catalog.edit",), {"lang": "kk", "version": 1}),
    # branches
    Op("GET", "/branches", ("branches.view",)),
    Op("POST", "/branches", ("branches.create",), {}),
    Op("GET", "/branches/{branch}", ("branches.view",)),
    Op("PATCH", "/branches/{branch}", ("branches.edit",), {"version": 1}),
    Op("DELETE", "/branches/{branch}", ("branches.delete",)),
    # people, roles, settings, journal
    Op("GET", "/users", ("users.view",)),
    Op("POST", "/users", ("users.manage",), {"email": "new-demo@test.demo", "password": "Demo-Test-Password-9", "roles": ["editor"]}),
    Op("GET", "/users/branch-options", ("users.view",)),
    Op("GET", "/users/{target}", ("users.view",)),
    Op("PATCH", "/users/{target}", ("users.manage",), {}),
    Op("POST", "/users/{target}/password", ("users.manage",), {"new_password": "Demo-Test-Password-9"}),
    Op("PUT", "/users/{target}/roles", ("users.manage",), {"roles": ["editor"]}),
    Op("GET", "/roles", ("roles.manage",)),
    Op("PUT", "/roles/editor/permissions", ("roles.manage",), {"permissions": []}),
    Op("GET", "/settings", ("settings.edit",)),
    Op("PUT", "/settings/socials", ("settings.edit",), {}),
    Op("GET", "/synonyms", ("settings.edit",)),
    Op("POST", "/synonyms", ("settings.edit",), {}),
    Op("PATCH", "/synonyms/{synonym}", ("settings.edit",), {}),
    Op("DELETE", "/synonyms/{synonym}", ("settings.edit",)),
    Op("GET", "/audit", ("audit.view",)),
    Op("GET", "/audit/export", ("audit.export",)),
    Op("GET", "/analytics", ("analytics.view",)),
    Op("POST", "/analytics/ai-summary", ("analytics.view",)),
    # staff AI tools
    Op("GET", "/ai-tools/status", ("ai.use",)),
    Op("POST", "/ai-tools/collections/draft", ("ai.use",), {"topic": "ДЕМО тема"}),
    Op("POST", "/ai-tools/documents/{doc}/analyze", ("catalog.edit", "ai.use"), {}),
    Op("POST", "/ai-tools/documents/{doc}/apply", ("catalog.edit",), {"version": 1}),
    Op("GET", "/ai-tools/documents/{doc}/annotations", ("catalog.view",)),
    Op("POST", "/ai-tools/documents/{doc}/annotations/generate", ("catalog.edit", "ai.use"), {"lang": "ru"}),
    Op("PUT", "/ai-tools/documents/{doc}/annotations/ru", ("catalog.edit",), {"text": "ДЕМО"}),
    Op("DELETE", "/ai-tools/documents/{doc}/annotations/ru", ("catalog.edit",)),
    Op("POST", "/ai-tools/documents/{doc}/annotations/ru/approve", ("catalog.edit", "workflow.publish")),
    Op("POST", "/ai-tools/files/{file}/ocr", ("files.upload",)),
    Op("POST", "/ai-tools/files/{file}/ocr/apply", ("files.upload",), {"text": "ДЕМО"}),
]
READS = [op for op in OPS if op.method == "GET" and op.needs]
MUTATIONS = [op for op in OPS if op.method != "GET" and op.needs]


@pytest.fixture
def world(factory: Factory) -> dict[str, Any]:
    """Real objects for every path placeholder (a missing object would answer 404 before the rights check)."""
    tag = uuid.uuid4().hex[:8]
    branch, other = factory.branch(), factory.branch()
    _, _, case = factory.catalog(branch)
    _, _, other_case = factory.catalog(other)
    # branch_id as the services keep it (save_with_version syncs it from the hierarchy).
    document = factory.document(case, branch_id=branch.id)
    other_document = factory.document(other_case, branch_id=other.id)

    def file_of(doc: Any) -> DigitalFile:
        return factory.add(
            DigitalFile(owner_type="document", owner_id=doc.id, master_path="x/m.jpg", mime="image/jpeg", size=1,
                        sha256=uuid.uuid4().hex + uuid.uuid4().hex, access=FileAccess.CLOSED, is_demo=True)
        )

    exhibition = factory.add(Exhibition(slug=f"ex-{tag}", title={"ru": "ДЕМО выставка"}, intro={}, is_demo=True))
    owner = factory.user(None)
    return {
        "branch": branch, "other_branch": other, "doc": document, "other_doc": other_document,
        "file": file_of(document), "other_file": file_of(other_document),
        "news": factory.add(News(slug=f"n-{tag}", title={"ru": "ДЕМО новость"}, is_demo=True)),
        "person": factory.add(Person(slug=f"p-{tag}", name={"ru": "ДЕМО персона"}, is_demo=True)),
        "collection": factory.add(Collection(slug=f"c-{tag}", title={"ru": "ДЕМО подборка"})),
        "exhibition": exhibition,
        "exhibit": factory.add(Exhibit(exhibition_id=exhibition.id, title={"ru": "ДЕМО экспонат"}, is_demo=True)),
        "synonym": factory.add(Synonym(terms=[f"демо-{tag}", f"demo-{tag}"])),
        "target": factory.user(RoleCode.EDITOR),
        "owner": owner,
        "notification": factory.add(Notification(user_id=owner.id, kind="workflow.submit", message={"ru": "ДЕМО"})),
    }


def url(op: Op, world: dict[str, Any], **override: Any) -> str:
    path = op.path
    for name, obj in {**world, **override}.items():
        path = path.replace("{" + name + "}", str(obj.id))
    assert "{" not in path, path
    return ADMIN + path


def call(client: TestClient, op: Op, world: dict[str, Any], **override: Any):
    target = url(op, world, **override)
    if op.raw is not None:
        return client.request(op.method, target, content=op.raw)
    return client.request(op.method, target, json=op.body)


def _template(op: Op, templates: list[str]) -> str:
    """The OpenAPI path an operation exercises; a literal segment beats a parameter
    (`/users/branch-options` is not `/users/{user_id}`)."""
    path = ADMIN + op.path.split("?")[0]
    matches = [t for t in templates if re.fullmatch(re.sub(r"\{[^}]+\}", "[^/]+", t), re.sub(r"\{[^}]+\}", "x", path))]
    assert matches, path
    return max(matches, key=lambda t: len(re.sub(r"\{[^}]+\}", "", t)))


def test_every_admin_operation_is_in_the_matrix():
    paths = app.openapi()["paths"]
    api_ops = {(method.upper(), path) for path, item in paths.items() if path.startswith(ADMIN) for method in item}
    templates = [path for path in paths if path.startswith(ADMIN)]
    listed = {(op.method, _template(op, templates)) for op in OPS}
    assert api_ops - {("POST", f"{ADMIN}/auth/login")} == listed


@pytest.mark.parametrize("op", OPS, ids=lambda op: f"{op.method} {op.path}")
def test_anonymous_is_401(api, world, op):
    assert call(api, op, world).status_code == 401


@pytest.mark.parametrize("op", MUTATIONS, ids=lambda op: f"{op.method} {op.path}")
def test_employee_without_permissions_is_refused(api, factory, world, op):
    login(api, factory.user(None).email)
    response = call(api, op, world)
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("op", [op for op in OPS if op.method != "GET"], ids=lambda op: f"{op.method} {op.path}")
def test_mutation_without_csrf_is_refused(api, factory, world, op):
    login(api, factory.user(RoleCode.SUPER_ADMIN).email)
    api.headers.pop(CSRF_HEADER)
    response = call(api, op, world)
    assert response.status_code == 403 and response.json() == {"detail": "csrf_failed"}


@pytest.mark.parametrize("role", list(RoleCode) + [None], ids=lambda role: str(role))
def test_reads_follow_the_role_matrix(api, factory, world, role):
    """Every read endpoint × every role: 200 exactly when the role has all the permissions."""
    user = factory.user(role, branch_id=world["branch"].id if role == RoleCode.BRANCH_ADMIN else None)
    login(api, user.email)
    granted = DEFAULT_ROLE_PERMISSIONS.get(role, frozenset()) if role else frozenset()
    mismatches = []
    for op in READS:
        allowed = role == RoleCode.SUPER_ADMIN or set(op.needs) <= granted
        status = call(api, op, world).status_code
        if status != (200 if allowed else 403):
            mismatches.append((op.path, status))
    assert mismatches == []


def _granted(role: RoleCode | None) -> frozenset[str]:
    return DEFAULT_ROLE_PERMISSIONS.get(role, frozenset()) if role else frozenset()


@pytest.mark.parametrize("role", [r for r in RoleCode if r != RoleCode.SUPER_ADMIN], ids=str)
def test_mutations_follow_the_role_matrix(api, factory, world, role):
    """Every mutating endpoint × every role lacking one of its permissions → 403 (and nothing changes).
    Allowed combinations are not run here: they would change the shared fixture objects."""
    login(api, factory.user(role, branch_id=world["branch"].id if role == RoleCode.BRANCH_ADMIN else None).email)
    mismatches = []
    for op in MUTATIONS:
        if set(op.needs) <= _granted(role):
            continue
        status = call(api, op, world).status_code
        if status != 403:
            mismatches.append((op.method, op.path, status))
    assert mismatches == []


BRANCH_MUTATIONS = [
    Op("PATCH", CATALOG_DOC, ("catalog.edit",), {"version": 1, "title": {"ru": "Чужой"}}),
    Op("DELETE", CATALOG_DOC, ("catalog.delete",)),
    Op("POST", "/workflow/document/{doc}/transitions", ("workflow.submit", "catalog.edit"), {"action": "submit", "version": 1}),
    Op("POST", "/uploads?owner_type=document&owner_id={doc}&filename=a.jpg", ("files.upload", "catalog.edit"), raw=b"x"),
    Op("PATCH", "/uploads/{file}", ("files.upload", "catalog.edit"), {"access": "open"}),
    Op("DELETE", "/uploads/{file}", ("files.delete", "catalog.edit")),
    Op("PATCH", "/branches/{branch}", ("branches.edit",), {"version": 1}),
    Op("POST", "/translations/document/{doc}/verify", ("catalog.edit",), {"lang": "kk", "version": 1}),
    Op("POST", "/ai-tools/documents/{doc}/apply", ("catalog.edit",), {"version": 1, "summary": "Чужой"}),
]
# Only roles that HAVE the permissions: the refusal must come from the branch, not the matrix.
BRANCH_CASES = [
    (role, op) for op in BRANCH_MUTATIONS for role in (RoleCode.BRANCH_ADMIN, RoleCode.ARCHIVIST)
    if set(op.needs) <= _granted(role)
]


@pytest.mark.parametrize(("role", "op"), BRANCH_CASES, ids=lambda x: str(x) if isinstance(x, RoleCode) else f"{x.method} {x.path}")
def test_branch_roles_cannot_touch_another_branch(api, factory, world, role, op):
    login(api, factory.user(role, branch_id=world["branch"].id).email)
    foreign = {"doc": world["other_doc"], "file": world["other_file"], "branch": world["other_branch"]}
    assert call(api, op, world, **foreign).status_code == 403
    assert call(api, Op("GET", CATALOG_DOC, ()), world, doc=world["other_doc"]).status_code == 403
    assert call(api, Op("GET", CATALOG_DOC, ()), world).status_code == 200


def test_branch_export_has_only_own_branch(api, factory, world):
    """The export has no pagination: every document a branch archivist can list is in it."""
    login(api, factory.user(RoleCode.ARCHIVIST, branch_id=world["branch"].id).email)
    response = api.get(f"{ADMIN}/export/documents")
    assert response.status_code == 200
    assert str(world["doc"].id) in response.text and str(world["other_doc"].id) not in response.text


def test_foreign_notification_cannot_be_read(api, factory, world):
    """IDOR: a notification id of another employee is unknown to the caller."""
    login(api, factory.user(RoleCode.SUPER_ADMIN).email)
    assert api.post(url(Op("POST", "/notifications/{notification}/read", SELF), world)).status_code == 404
    factory.session.refresh(world["notification"])
    assert world["notification"].is_read is False
