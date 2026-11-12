"""Real images for the demo catalog (Wikimedia Commons, Public domain / CC BY / CC BY-SA).

`seed/assets/documents/<archive code>.jpg` replaces the generated scan or photo of that document;
`seed/assets/covers/<table>__<slug>.jpg` is the cover of an exhibition, a collection or a news item.
Authors and licences are listed in `seed/assets/credits.json`. The generated pages' OCR text is kept
(joined by a form feed) so that «ask about this document» keeps working. Idempotent.
"""

import io
import json
from pathlib import Path

from PIL import Image
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models import Collection, DigitalFile, Document, Exhibit, Exhibition, FileAccess, News
from seed.common import DEMO_DOCS_BY_CODE, Report, attach_file, i18n
from seed.demo_catalog import _preview

ASSETS = Path(__file__).parent / "assets"


COVER_MODELS = {"exhibitions": Exhibition, "collections": Collection, "news": News}


def archive_code(stem: str) -> str:
    """Reverse of `asset_stem`: `FD-1_Op2_D3_N1` is the archive code «Ф.Д-1 Оп.2 Д.3 №1»."""
    return stem.replace("FD-", "Ф.Д-").replace("_Op", " Оп.").replace("_D", " Д.").replace("_N", " №")


def _credits() -> dict[str, dict[str, str]]:
    path = ASSETS / "credits.json"
    return {c["file"]: c for c in json.loads(path.read_text(encoding="utf-8"))} if path.exists() else {}


def _rights(credit: dict[str, str] | None) -> dict[str, str]:
    if not credit:
        return i18n(ru="Изображение с Wikimedia Commons.")
    return i18n(ru=f"{credit['author']}, {credit['license']}, Wikimedia Commons: {credit['source']}")


def _store(session: Session, report: Report, storage_dir: Path, *, owner_type: str, owner, source: Path, position: int, access, credit, ocr_text: str | None = None) -> DigitalFile:
    image = Image.open(source).convert("RGB")
    preview_name = f"previews/seed/assets/{owner_type}-{source.stem}.jpg".replace(" ", "_")
    preview = storage_dir / preview_name
    preview.parent.mkdir(parents=True, exist_ok=True)
    preview.write_bytes(_preview(image))
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=88)
    stored = attach_file(
        session, report, storage_dir, owner_type=owner_type, owner_id=owner.id, position=position,
        name=f"assets/{owner_type}-{source.stem}.jpg".replace(" ", "_"), data=buffer.getvalue(), mime="image/jpeg",
        pages=1, preview_path=preview_name, access=access, is_demo=True, refresh=True,
        provenance=i18n(ru=(credit or {}).get("source", "Wikimedia Commons")), rights_note=_rights(credit),
        ocr_text=ocr_text,
    )
    session.flush()
    return stored


def apply_document_images(session: Session, report: Report, storage_dir: Path) -> None:
    credits = _credits()
    for source in sorted((ASSETS / "documents").glob("*.jpg")):
        code = archive_code(source.stem.partition("__")[0])
        document = session.scalar(select(Document).where(Document.archive_code == code))
        if document is None:
            report.warnings.append(f"asset {source.name}: no document with this archive code")
            continue
        old = session.scalars(select(DigitalFile).where(DigitalFile.owner_type == "document", DigitalFile.owner_id == document.id)).all()
        target = 1 if source.stem.endswith("__2") else 0
        if any(f.position == target and f.master_path.startswith("masters/seed/assets/") for f in old):
            report.count("digital_files", False)
            continue  # already replaced by a previous run
        extra = source.stem.endswith("__2")
        if not extra:
            demo = DEMO_DOCS_BY_CODE.get(code)
            # The pages' text of the former generated scan doubles as OCR (one page per form feed).
            ocr = "\f".join(demo.pages) if demo and demo.pages else ("\f".join(f.ocr_text for f in sorted(old, key=lambda f: f.position) if f.ocr_text) or None)
            gone = [f.id for f in old if f.mime.startswith("image/")]
            session.execute(update(Exhibit).where(Exhibit.media_file_id.in_(gone)).values(media_file_id=None))
            session.execute(update(Exhibition).where(Exhibition.cover_file_id.in_(gone)).values(cover_file_id=None))
            session.execute(delete(DigitalFile).where(DigitalFile.id.in_(gone)))
            session.flush()
        else:
            ocr = None
        _store(session, report, storage_dir, owner_type="document", owner=document, source=source,
               position=1 if extra else 0, access=document.file_access, credit=credits.get(source.name), ocr_text=ocr)
        document.has_digital_copy = True
    session.flush()


def apply_covers(session: Session, report: Report, storage_dir: Path) -> None:
    credits = _credits()
    # Exhibits and exhibition covers follow the (new) first file of their document.
    for exhibit in session.scalars(select(Exhibit).where(Exhibit.document_id.is_not(None))):
        first = session.scalar(
            select(DigitalFile).where(DigitalFile.owner_type == "document", DigitalFile.owner_id == exhibit.document_id, DigitalFile.position == 0)
        )
        if first is not None:
            exhibit.media_file_id = first.id
    for exhibition in session.scalars(select(Exhibition)):
        cover = session.get(DigitalFile, exhibition.cover_file_id) if exhibition.cover_file_id else None
        if cover is not None and cover.owner_type == "exhibition" and cover.master_path.startswith("masters/seed/assets/"):
            continue  # an asset cover was set by a previous run
        first_exhibit = session.scalar(select(Exhibit).where(Exhibit.exhibition_id == exhibition.id).order_by(Exhibit.position))
        if first_exhibit is not None and first_exhibit.media_file_id:
            exhibition.cover_file_id = first_exhibit.media_file_id

    for source in sorted((ASSETS / "covers").glob("*.jpg")):
        table, _, slug = source.stem.partition("__")
        model = COVER_MODELS.get(table)
        owner = session.scalar(select(model).where(model.slug == slug)) if model else None
        current = session.get(DigitalFile, owner.cover_file_id) if owner is not None and owner.cover_file_id else None
        if current is not None and current.owner_type != "document" and current.master_path.startswith("masters/seed/assets/"):
            report.count("digital_files", False)
            continue
        if owner is None:
            report.warnings.append(f"asset {source.name}: no such owner")
            continue
        stored = _store(session, report, storage_dir, owner_type={"exhibitions": "exhibition", "collections": "collection", "news": "news"}[table],
                        owner=owner, source=source, position=0, access=FileAccess.OPEN, credit=credits.get(source.name))
        owner.cover_file_id = stored.id
    session.flush()


def apply_media(session: Session, report: Report, storage_dir: Path) -> None:
    apply_document_images(session, report, storage_dir)
    apply_covers(session, report, storage_dir)
