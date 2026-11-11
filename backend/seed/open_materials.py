"""Open historical materials: real, freely licensed images from Wikimedia Commons
(seed/media/commons/manifest.json) as catalogue documents of the fund ОИ-1.

They are neither holdings of the archive nor fictitious, so they carry no `is_demo` flag and no
branch. What they are is said by the fund, by `storage_location` and `access_conditions` of every
document and by the provenance and rights of every file; the two state symbols of the manifest
are site decoration and are not catalogued."""

import json
from datetime import date
from pathlib import Path
from urllib.parse import unquote

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Case,
    DescriptionStatus,
    DigitalFile,
    Document,
    FileAccess,
    Fund,
    FundType,
    Inventory,
    Tag,
    WorkflowStatus,
)
from seed import open_data as data
from seed.common import MACHINE_KK_EN, Report, attach_file, i18n, jpeg_preview, translation_status, upsert

MEDIA_DIR = Path(__file__).parent / "media" / "commons"
PUBLISHED = WorkflowStatus.PUBLISHED
PREVIEW_SIZE = 800
NOT_HELD = "В Государственном архиве ВКО не хранится."
UNCERTAIN = ", датировка не подтверждена"
# Manifest topic -> tag; the two towns that have a tag are recognised by the place.
TOPIC_TAGS = {"wwii": "wwii", "culture": "culture", "industry": "industry", "nature": "nature", "people": "people"}
PLACE_TAGS = {"Усть-Каменогорск": "ust-kamenogorsk", "Риддер": "ridder-leninogorsk"}


def manifest() -> dict[str, dict]:
    """Manifest entries by file name, without the state symbols."""
    entries = json.loads((MEDIA_DIR / "manifest.json").read_text(encoding="utf-8"))
    return {entry["file"]: entry for entry in entries if "symbols" not in entry["use"]}


def credit(entry: dict) -> str:
    """The source line shown next to an image: «Wikimedia Commons, автор: …, лицензия: …»."""
    author = entry["author"]
    # «Автор неизвестен», «Автор рисунка не указан (…)» already say who: no second «автор:».
    who = author[0].lower() + author[1:] if author.startswith("Автор ") else f"автор: {author}"
    return f"Wikimedia Commons, {who}, лицензия: {entry['license']}"


def open_document(session: Session, file: str) -> Document:
    document = session.scalar(select(Document).where(Document.slug == f"open-{Path(file).stem}"))
    assert document is not None, f"open document {file} is missing: seed the open materials first"
    return document


def first_file(session: Session, document: Document) -> DigitalFile:
    file = session.scalar(
        select(DigitalFile)
        .where(DigitalFile.owner_type == "document", DigitalFile.owner_id == document.id, DigitalFile.position == 0)
    )
    assert file is not None, f"document {document.archive_code} has no digital copy"
    return file


def _years(entry: dict) -> tuple[int | None, int]:
    return data.EXTRA.get(entry["file"], {}).get("year_from", entry["year_from"]), entry["year_to"]


def _document_values(entry: dict, case: Case, code: str, doc_type: str, language: str | None) -> dict:
    extra = data.EXTRA.get(entry["file"], {})
    year_from, year_to = _years(entry)
    place = extra.get("place", entry["place_ru"])
    url = unquote(entry["source_url"])
    conditions = (
        f"Свободное использование. Лицензия: {entry['license']} ({entry['license_url']}). Автор: {entry['author']}. "
        f"Источник: Wikimedia Commons, {url}"
    )
    if entry["license"].startswith("CC BY"):
        conditions += ". При повторном использовании укажите автора и лицензию (для CC BY-SA — на тех же условиях)"
    holder = extra.get("holder")
    return {
        "archive_code": code, "case_id": case.id, "branch_id": None,
        "title": i18n(ru=entry["title_ru"], kk=entry["title_kk"], en=entry["title_en"]),
        "date_text": entry["date_text"] + (UNCERTAIN if entry["date_uncertain"] else ""),
        "date_from": date(year_from, 1, 1) if year_from else None, "date_to": date(year_to, 12, 31),
        "period": f"{(year_from or year_to) // 10 * 10}s",
        "doc_type": extra.get("doc_type", doc_type), "language": extra.get("lang", language),
        "authors": i18n(ru=entry["author"]), "places": [i18n(ru=place)] if place else [],
        "summary": i18n(ru=entry["description_ru"]), "historical_note": i18n(ru=extra.get("note", "")),
        "sheets_count": 1,
        "storage_location": f"Источник: {holder}; получено через Wikimedia Commons. {NOT_HELD}" if holder
        else f"{NOT_HELD} Цифровая копия: Wikimedia Commons.",
        "description_status": DescriptionStatus.PUBLIC, "file_access": FileAccess.OPEN,
        "access_conditions": i18n(ru=conditions + "."), "has_digital_copy": True, "is_demo": False,
        "workflow_status": PUBLISHED, "translation_status": dict(MACHINE_KK_EN),
    }  # fmt: skip


def _attach(session: Session, report: Report, storage_dir: Path, entry: dict, document: Document, refresh: bool) -> None:
    """The image as the master copy plus a lightweight JPEG preview, with provenance and rights."""
    source = MEDIA_DIR / entry["file"]
    url = unquote(entry["source_url"])
    kinds = [Path(name).suffix[1:].upper().replace("JPEG", "JPG") for name in (url, entry["file"])]
    converted = f", формат {kinds[0]} → {kinds[1]}" if kinds[0] != kinds[1] else ""
    preview_name = f"previews/seed/commons/{source.stem}.jpg"
    preview = storage_dir / preview_name
    if refresh or not preview.exists():
        preview.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            image.draft("RGB", (PREVIEW_SIZE, PREVIEW_SIZE))  # JPEG only: decode at a reduced size
            preview.write_bytes(jpeg_preview(image, PREVIEW_SIZE))
    attach_file(
        session, report, storage_dir, owner_type="document", owner_id=document.id, position=0,
        name=f"commons/{entry['file']}", source=source, access=FileAccess.OPEN, is_demo=False, refresh=refresh,
        pages=1, preview_path=preview_name, caption=dict(document.title),
        provenance=i18n(ru=f"Файл с Викисклада (Wikimedia Commons): {url}. Копия для сайта: ширина не более 1920 px"
                           f"{converted}; оригинал в архиве не хранится."),
        rights_note=i18n(ru=f"Автор: {entry['author']}. Лицензия: {entry['license']} ({entry['license_url']})."),
    )  # fmt: skip


def seed_open_materials(session: Session, report: Report, storage_dir: Path, refresh: bool) -> None:
    entries = manifest()
    placed = [file for _, _, cases in data.STRUCTURE for *_, files in cases for file in files]
    assert sorted(placed) == sorted(entries), "seed/open_data.py STRUCTURE must list every manifest image exactly once"
    tags = {tag.slug: tag for tag in session.scalars(select(Tag))}

    def span(files: list[str]) -> dict:
        years = [year for file in files for year in _years(entries[file]) if year]
        return {"dates_from": min(years), "dates_to": max(years), "is_demo": False, "workflow_status": PUBLISHED,
                "translation_status": translation_status(ru="x")}  # fmt: skip

    fund = upsert(
        session, report, Fund, {"branch_id": None, "number": data.FUND_NUMBER},
        {"slug": "fund-open-materials", "type": FundType.ORGANIZATION, "title": i18n(ru=data.FUND_TITLE),
         "annotation": i18n(ru=data.FUND_ANNOTATION), "source": data.FUND_SOURCE, **span(placed)},
        refresh,
    )  # fmt: skip
    session.flush()
    for inv_number, inv_title, cases in data.STRUCTURE:
        inventory = upsert(
            session, report, Inventory, {"fund_id": fund.id, "number": inv_number},
            {"title": i18n(ru=inv_title), **span([file for *_, files in cases for file in files])}, refresh,
        )  # fmt: skip
        session.flush()
        for case_number, case_title, doc_type, language, files in cases:
            case = upsert(
                session, report, Case, {"inventory_id": inventory.id, "number": case_number},
                {"title": i18n(ru=case_title), "sheets_count": len(files), **span(files)}, refresh,
            )  # fmt: skip
            session.flush()
            for number, file in enumerate(files, 1):
                entry = entries[file]
                code = f"Ф.{fund.number} Оп.{inv_number} Д.{case_number} №{number}"
                document = upsert(
                    session, report, Document, {"slug": f"open-{Path(file).stem}"},
                    _document_values(entry, case, code, doc_type, language), refresh,
                )  # fmt: skip
                if document in session.new or refresh:
                    place = entry["place_ru"]
                    slugs = [TOPIC_TAGS[t] for t in entry["topics"] if t in TOPIC_TAGS]
                    slugs += [slug for word, slug in PLACE_TAGS.items() if word in place]
                    document.tags = [tags[f"tag-{slug}"] for slug in slugs]
                session.flush()
                _attach(session, report, storage_dir, entry, document, refresh)
