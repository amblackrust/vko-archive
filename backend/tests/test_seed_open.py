"""Open historical materials (seed/open_materials.py): real, freely licensed images from the
Wikimedia Commons manifest as catalogue documents. They are not the archive's holdings and not
fictitious, and every stored file says where it comes from and under which licence."""

import hashlib
import json
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Case, DescriptionStatus, DigitalFile, Document, FileAccess, Fund, Inventory, WorkflowStatus
from app.schemas.catalog import CatalogFilters
from app.services import catalog as catalog_service
from app.services import files as files_service
from seed.common import Report
from seed.open_materials import MEDIA_DIR, manifest, seed_open_materials
from seed.runner import run


@pytest.fixture(scope="module")
def storage(tmp_path_factory) -> Path:
    return tmp_path_factory.mktemp("storage_open")


def _open_documents(session: Session) -> dict[str, Document]:
    return {d.slug.removeprefix("open-"): d for d in session.scalars(select(Document).where(Document.slug.like("open-%")))}


def test_every_manifest_image_is_one_public_document(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    entries = manifest()
    documents = _open_documents(db_session)
    all_files = json.loads((MEDIA_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert len(entries) == len(all_files) - 2 == len(documents)  # the two state symbols are not catalogued
    assert set(documents) == {Path(file).stem for file in entries}

    fund = db_session.scalar(select(Fund).where(Fund.number == "ОИ-1"))
    # Real materials, but not the archive's: no demo flag, no branch, and the texts say so.
    assert not fund.is_demo and fund.branch_id is None and "Wikimedia Commons" in fund.title["ru"]
    assert "не входят в фонды" in fund.annotation["ru"] and fund.source.startswith("commons.wikimedia.org")
    assert not db_session.scalars(select(Inventory).where(Inventory.fund_id == fund.id, Inventory.is_demo)).all()
    for file, entry in entries.items():
        document = documents[Path(file).stem]
        assert not document.is_demo and document.branch_id is None
        assert document.workflow_status == WorkflowStatus.PUBLISHED
        # Nothing of the manifest is restricted: every licence there allows publication.
        assert document.description_status == DescriptionStatus.PUBLIC and document.file_access == FileAccess.OPEN
        assert document.archive_code.startswith("Ф.ОИ-1 Оп.") and document.has_digital_copy
        assert document.title == {"ru": entry["title_ru"], "kk": entry["title_kk"], "en": entry["title_en"]}
        assert document.translation_status == {"ru": "verified", "kk": "machine", "en": "machine"}
        assert document.summary["ru"] == entry["description_ru"] and document.authors["ru"] == entry["author"]
        assert document.doc_type in ("photo", "map", "drawing")
        assert "В Государственном архиве ВКО не хранится" in document.storage_location
        conditions = document.access_conditions["ru"]
        assert entry["license"] in conditions and entry["license_url"] in conditions
        assert "https://commons.wikimedia.org/wiki/File:" in conditions
        assert document.date_text.startswith(entry["date_text"]) and document.date_to.year == entry["year_to"]
        assert document.date_text.endswith("датировка не подтверждена") is entry["date_uncertain"]
        case = db_session.get(Case, document.case_id)
        assert not case.is_demo and case.dates_from <= document.date_to.year <= case.dates_to


def test_every_file_has_provenance_rights_checksum_and_preview(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    entries = manifest()
    for stem, document in _open_documents(db_session).items():
        files = db_session.scalars(select(DigitalFile).where(DigitalFile.owner_id == document.id)).all()
        assert len(files) == 1
        file = files[0]
        entry = entries[file.original_name]
        assert file.owner_type == "document" and file.access == FileAccess.OPEN and not file.is_demo
        assert "Wikimedia Commons" in file.provenance["ru"] and "https://commons.wikimedia.org/" in file.provenance["ru"]
        assert entry["author"] in file.rights_note["ru"] and entry["license"] in file.rights_note["ru"]
        assert entry["license_url"] in file.rights_note["ru"]
        master = (storage / file.master_path).read_bytes()
        assert master == (MEDIA_DIR / file.original_name).read_bytes()  # the image itself is not altered
        assert file.sha256 == hashlib.sha256(master).hexdigest() and file.size == len(master)
        assert file.mime in ("image/jpeg", "image/png")
        preview = (storage / file.preview_path).read_bytes()
        assert preview[:2] == b"\xff\xd8" and len(preview) < 400_000  # a lightweight JPEG
        assert "demo" not in file.master_path and stem in file.preview_path
        # The server-side rule opens exactly these files to an anonymous visitor.
        assert [ref.id for ref in files_service.visible_files(db_session, None, document)] == [file.id]


def test_open_materials_seed_alone_is_idempotent(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    again = Report()
    seed_open_materials(db_session, again, storage, False)
    assert not again.created
    assert again.existing == {"funds": 1, "inventories": 4, "cases": 12, "documents": 57, "digital_files": 57}


def test_catalog_lists_the_open_documents_with_thumbnails(db_session: Session, storage: Path) -> None:
    run(db_session, storage)
    found = catalog_service.search_documents(db_session, CatalogFilters(fund_number="ОИ-1", per_page=100))
    assert found.total == 57
    assert all(item.preview_url == f"{item.preview_url.split('?')[0]}?variant=preview" for item in found.items)
    assert all(item.fund.number == "ОИ-1" and item.branch_id is None and not item.is_demo for item in found.items)
    assert {v.value for v in found.facets.doc_type} == {"photo", "map", "drawing"}
    # The fictitious demo documents keep demonstrating restricted and closed access.
    demo = catalog_service.search_documents(db_session, CatalogFilters(fund_number="Д-1", per_page=100))
    assert demo.items and all(item.is_demo for item in demo.items)
    assert {item.file_access for item in demo.items} >= {"open", "restricted"}
    assert all(item.preview_url is None for item in demo.items if item.file_access != "open")
