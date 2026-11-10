"""Shared helpers for the seed: i18n values, idempotent upserts, file storage."""

import hashlib
import mimetypes
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DigitalFile, Document, FileAccess, OcrStatus
from seed.demo_data import FUNDS

ROOT_DIR = Path(__file__).resolve().parents[2]
INFO_DIR = ROOT_DIR / "info"
LANGS = ("kk", "ru", "en")

# Demo document key 'd<fund>-<inventory>-<case>-<n>' (as in demo_catalog) -> its archive code.
DEMO_DOC_CODES = {
    f"d{fund.number[2:]}-{inv.number}-{case.number}-{n}": f"ДЕМО Ф.{fund.number} Оп.{inv.number} Д.{case.number} №{n}"
    for fund in FUNDS
    for inv in fund.inventories
    for case in inv.cases
    for n in range(1, len(case.docs) + 1)
}


def i18n(**values: str) -> dict[str, str]:
    """Translatable value; languages that were not given are simply absent."""
    return {lang: text for lang, text in values.items() if text}


def translation_status(**values: str) -> dict[str, str]:
    """Texts that come from customer documents are `verified`; absent languages are `missing`."""
    return {lang: ("verified" if values.get(lang) else "missing") for lang in LANGS}


@dataclass
class Report:
    """Counts of created / already existing rows per entity, plus parser warnings."""

    created: dict[str, int] = field(default_factory=dict)
    existing: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def count(self, entity: str, created: bool) -> None:
        target = self.created if created else self.existing
        target[entity] = target.get(entity, 0) + 1

    def total(self, entity: str) -> int:
        return self.created.get(entity, 0) + self.existing.get(entity, 0)


def upsert(
    session: Session, report: Report, model: type, lookup: dict, values: dict, refresh: bool
):
    """Find a row by `lookup`; create it with `values` if missing.
    Existing rows are left untouched (admin edits survive) unless `refresh` is set."""
    obj = session.scalar(select(model).filter_by(**lookup))
    created = obj is None
    if created:
        obj = model(**lookup, **values)
        session.add(obj)
    elif refresh:
        for key, value in values.items():
            setattr(obj, key, value)
    report.count(model.__tablename__, created)
    return obj


def demo_document(session: Session, key: str) -> Document:
    """A demo catalog document by its key; the demo catalog must be seeded first."""
    document = session.scalar(select(Document).where(Document.archive_code == DEMO_DOC_CODES[key]))
    assert document is not None, f"demo document {key} is missing: seed the demo catalog first"
    return document


def demo_document_file(session: Session, document: Document) -> DigitalFile:
    """The first digital copy of a demo document (its access follows the document)."""
    file = session.scalar(
        select(DigitalFile)
        .where(DigitalFile.owner_type == "document", DigitalFile.owner_id == document.id, DigitalFile.position == 0)
    )
    assert file is not None, f"document {document.archive_code} has no digital copy"
    return file


def attach_file(
    session: Session,
    report: Report,
    storage_dir: Path,
    *,
    owner_type: str,
    owner_id,
    position: int,
    name: str,
    data: bytes | None = None,
    source: Path | None = None,
    mime: str | None = None,
    access: FileAccess,
    is_demo: bool,
    refresh: bool,
    **extra,
) -> DigitalFile:
    """Store a file under storage/masters/seed/ and register it. Identified by (owner, position)."""
    target = storage_dir / "masters" / "seed" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if source is not None:
        shutil.copyfile(source, target)
        data = target.read_bytes()
    else:
        assert data is not None
        target.write_bytes(data)
    values = {
        "original_name": name.rsplit("/", 1)[-1],
        "master_path": f"masters/seed/{name}",
        "mime": mime or mimetypes.guess_type(name)[0] or "application/octet-stream",
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "access": access,
        "is_demo": is_demo,
        "ocr_status": extra.pop("ocr_status", OcrStatus.NONE),
        **extra,
    }
    return upsert(
        session,
        report,
        DigitalFile,
        {"owner_type": owner_type, "owner_id": owner_id, "position": position},
        values,
        refresh,
    )
