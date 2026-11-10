"""T2.3: demo catalog (fictitious, is_demo=True) with generated placeholder files."""

import io
import textwrap
import wave
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Branch,
    Case,
    DescriptionStatus,
    Document,
    FileAccess,
    Fund,
    FundType,
    Inventory,
    OcrStatus,
    Tag,
    WorkflowStatus,
)
from seed.common import Report, attach_file, i18n, translation_status, upsert
from seed.demo_data import FUNDS, TAGS, Doc

PUBLISHED = WorkflowStatus.PUBLISHED
FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansMono-Regular.ttf",
)
PROVENANCE = i18n(ru="ДЕМО: файл сгенерирован скриптом seed, реального архивного оригинала нет.")
RIGHTS = i18n(ru="ДЕМО: вымышленный материал, права не затрагиваются.")


def _font(size: int) -> ImageFont.ImageFont:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size)  # no Cyrillic guarantee, but the seed must not fail


def _watermark(image: Image.Image) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = _font(image.width // 4)
    draw.text((image.width // 2, image.height // 2), "ДЕМО", font=font, fill=(190, 40, 40, 60), anchor="mm")
    layer = layer.rotate(30, resample=Image.BICUBIC)
    image.paste(layer, (0, 0), layer)


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def _preview(image: Image.Image) -> bytes:
    thumb = image.convert("RGB")
    thumb.thumbnail((400, 400))
    buffer = io.BytesIO()
    thumb.save(buffer, "JPEG", quality=70)
    return buffer.getvalue()


def scan_page(text: str, page: int, total: int) -> Image.Image:
    """An 'archival scan': typewriter-like text on aged paper with a ДЕМО watermark."""
    image = Image.new("RGB", (794, 1123), (243, 236, 218))
    draw = ImageDraw.Draw(image)
    draw.rectangle((30, 30, 763, 1092), outline=(200, 190, 165), width=2)
    font = _font(20)
    y = 90
    for line in text.split("\n"):
        for chunk in textwrap.wrap(line, 52) or [""]:
            draw.text((70, y), chunk, font=font, fill=(40, 35, 30))
            y += 30
    draw.text((70, 1050), f"л. {page} из {total}  ·  ДЕМО, вымышленный документ", font=_font(16), fill=(110, 100, 90))
    _watermark(image)
    return image


def photo(title: str) -> Image.Image:
    image = Image.new("RGB", (1000, 700), (120, 120, 125))
    draw = ImageDraw.Draw(image)
    for row in range(700):  # vertical gradient so it does not look like a flat fill
        shade = 90 + row * 80 // 700
        draw.line((0, row, 1000, row), fill=(shade, shade, shade + 5))
    draw.rectangle((40, 40, 960, 660), outline=(235, 235, 235), width=6)
    draw.text((500, 300), "ДЕМО · ФОТО", font=_font(56), fill=(240, 240, 240), anchor="mm")
    draw.multiline_text((500, 400), "\n".join(textwrap.wrap(title, 60)), font=_font(24), fill=(230, 230, 230),
                        anchor="ma", align="center")  # fmt: skip
    _watermark(image)
    return image


def silent_wav() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(1)
        out.setframerate(8000)
        out.writeframes(b"\x80" * 8000)
    return buffer.getvalue()


def _store_files(session, report, storage_dir, doc: Doc, document: Document, base: str, refresh: bool) -> None:
    access = FileAccess(doc.access)
    common = {"owner_type": "document", "owner_id": document.id, "access": access, "is_demo": True,
              "refresh": refresh, "provenance": PROVENANCE, "rights_note": RIGHTS}  # fmt: skip
    if doc.kind == "audio":
        attach_file(session, report, storage_dir, position=0, name=f"demo/{base}.wav", data=silent_wav(),
                    mime="audio/wav", caption=i18n(ru=doc.title), **common)  # fmt: skip
    elif doc.kind in ("scan", "photo"):
        pages = doc.pages or (f"{doc.title}\n\n{doc.summary}\n\nДОКУМЕНТ ВЫМЫШЛЕННЫЙ. ДЕМО.",)
        for number, text in enumerate(pages, 1):
            image = photo(doc.title) if doc.kind == "photo" else scan_page(text, number, len(pages))
            preview_name = f"previews/seed/demo/{base}-{number}.jpg"
            preview = storage_dir / preview_name
            preview.parent.mkdir(parents=True, exist_ok=True)
            preview.write_bytes(_preview(image))
            attach_file(
                session, report, storage_dir, position=number - 1, name=f"demo/{base}-{number}.png",
                data=_png(image), mime="image/png", pages=1, preview_path=preview_name,
                caption=i18n(ru=f"{doc.title}, л. {number}"),
                # The OCR text is the page text itself: simulated OCR, labelled as such in the handoff.
                ocr_text=text if doc.pages else None,
                ocr_status=OcrStatus.DONE if doc.pages else OcrStatus.NONE,
                **common,
            )  # fmt: skip
            session.flush()


def seed_demo_catalog(session: Session, report: Report, storage_dir: Path, refresh: bool) -> None:
    head = session.scalar(select(Branch).where(Branch.slug == "branch-head"))
    assert head is not None, "seed the info content first (branch-head is missing)"

    tags = {}
    for slug, ru, kk, en in TAGS:
        tags[slug] = upsert(
            session, report, Tag, {"slug": f"tag-{slug}"},
            {"name": i18n(ru=ru, kk=kk, en=en), "workflow_status": PUBLISHED,
             "translation_status": {"ru": "verified", "kk": "machine", "en": "machine"}},
            refresh,
        )  # fmt: skip

    for fund_data in FUNDS:
        fund = upsert(
            session, report, Fund, {"branch_id": head.id, "number": fund_data.number},
            {"slug": f"demo-fund-{fund_data.number.lower()}", "type": FundType(fund_data.type),
             "title": i18n(ru=fund_data.title), "annotation": i18n(ru=fund_data.annotation),
             "dates_from": fund_data.year_from, "dates_to": fund_data.year_to, "is_demo": True,
             "workflow_status": PUBLISHED, "translation_status": translation_status(ru="x")},
            refresh,
        )  # fmt: skip
        session.flush()
        for inv_data in fund_data.inventories:
            all_docs = [d for c in inv_data.cases for d in c.docs]
            inventory = upsert(
                session, report, Inventory, {"fund_id": fund.id, "number": inv_data.number},
                {"title": i18n(ru=inv_data.title), "is_demo": True, "workflow_status": PUBLISHED,
                 "dates_from": min(int(d.date_from[:4]) for d in all_docs),
                 "dates_to": max(int((d.date_to or d.date_from)[:4]) for d in all_docs),
                 "translation_status": translation_status(ru="x")},
                refresh,
            )  # fmt: skip
            session.flush()
            for case_data in inv_data.cases:
                years = [int(d.date_from[:4]) for d in case_data.docs]
                case = upsert(
                    session, report, Case, {"inventory_id": inventory.id, "number": case_data.number},
                    {"title": i18n(ru=case_data.title), "is_demo": True, "workflow_status": PUBLISHED,
                     "dates_from": min(years), "dates_to": max(years),
                     "sheets_count": sum(d.sheets for d in case_data.docs),
                     "translation_status": translation_status(ru="x")},
                    refresh,
                )  # fmt: skip
                session.flush()
                for number, doc in enumerate(case_data.docs, 1):
                    code = f"ДЕМО Ф.{fund.number} Оп.{inventory.number} Д.{case.number} №{number}"
                    document = upsert(
                        session, report, Document, {"archive_code": code},
                        {
                            "slug": f"demo-{fund.number}-{inventory.number}-{case.number}-{number}".lower(),
                            "case_id": case.id, "branch_id": head.id, "title": i18n(ru=doc.title),
                            "date_text": doc.date_text, "date_from": date.fromisoformat(doc.date_from),
                            "date_to": date.fromisoformat(doc.date_to) if doc.date_to else None,
                            "period": f"{doc.date_from[:3]}0s", "doc_type": doc.doc_type, "language": "ru",
                            "authors": i18n(ru=doc.authors) if doc.authors else {},
                            "places": [i18n(ru=doc.place)],
                            "summary": i18n(ru=doc.summary), "sheets_count": doc.sheets,
                            "storage_location": f"ДЕМО, стеллаж {fund.number}" if doc.kind else None,
                            "description_status": DescriptionStatus(doc.desc),
                            "file_access": FileAccess(doc.access),
                            "access_conditions": i18n(ru=doc.conditions) if doc.conditions else {},
                            "has_digital_copy": doc.kind is not None, "is_demo": True,
                            "workflow_status": PUBLISHED, "translation_status": translation_status(ru="x"),
                        },
                        refresh,
                    )  # fmt: skip
                    if document in session.new or refresh:
                        document.tags = [tags[t] for t in doc.topics]
                    session.flush()
                    _store_files(session, report, storage_dir, doc, document, f"d{fund.number[2:]}-{inventory.number}-{case.number}-{number}", refresh)
