"""Shared helpers for the seed: i18n values, idempotent upserts, file storage."""

import hashlib
import io
import mimetypes
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image
from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.models import DigitalFile, FileAccess, OcrStatus

ROOT_DIR = Path(__file__).resolve().parents[2]
INFO_DIR = ROOT_DIR / "info"
LANGS = ("kk", "ru", "en")
# ru is the original text; kk/en were translated for the prototype and are not proofread.
MACHINE_KK_EN = {"ru": "verified", "kk": "machine", "en": "machine"}


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

    def count(self, entity: str, created: bool, n: int = 1) -> None:
        if n:
            target = self.created if created else self.existing
            target[entity] = target.get(entity, 0) + n

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


def bulk_upsert(
    session: Session, report: Report, model: type, key: tuple[str, ...], rows: list[dict], refresh: bool, **scope
) -> None:
    """`upsert` for thousands of rows: one SELECT of the keys (within `scope`), one INSERT of the
    missing rows and, with `refresh`, one UPDATE of the existing ones."""
    columns = [getattr(model, name) for name in key]
    found = {tuple(row[1:]): row[0] for row in session.execute(select(model.id, *columns).filter_by(**scope))}
    new = [{**scope, **row} for row in rows if tuple(row[name] for name in key) not in found]
    old = [{"id": found[ident], **row} for row in rows if (ident := tuple(row[name] for name in key)) in found]
    if new:
        session.execute(insert(model), new)
    if old and refresh:
        session.execute(update(model), old)
    report.count(model.__tablename__, True, len(new))
    report.count(model.__tablename__, False, len(old))


def jpeg_preview(image: Image.Image, size: int = 400) -> bytes:
    """A lightweight JPEG copy for lists and cards."""
    thumb = image.convert("RGB")
    thumb.thumbnail((size, size))
    buffer = io.BytesIO()
    thumb.save(buffer, "JPEG", quality=75)
    return buffer.getvalue()


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
