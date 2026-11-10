"""T2.1: content from the customer's info/ folder -> pages, settings, branches,
memorial dates, compliance, legal acts, fund categories."""

import html
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

import pypdf
from sqlalchemy.orm import Session

from app.models import (
    Branch,
    BranchType,
    Category,
    FileAccess,
    LegalAct,
    LegalActStatus,
    MemorialDate,
    OcrStatus,
    Page,
    SiteSetting,
    WorkflowStatus,
)
from seed import parsers
from seed.branch_coords import BRANCH_COORDS, HEAD_COORDS
from seed.common import INFO_DIR, Report, attach_file, i18n, translation_status, upsert

PUBLISHED = WorkflowStatus.PUBLISHED
ARCHIVE_RU = "КГУ «Государственный архив Восточно-Казахстанской области»"


def _p(lines: list[str]) -> str:
    return "".join(f"<p>{html.escape(line)}</p>" for line in lines)


def _page(session, report, refresh, key, section, position, title, body):
    return upsert(
        session, report, Page, {"key": key},
        {
            "slug": key, "section": section, "position": position, "title": title, "body": body,
            "workflow_status": PUBLISHED,
            "translation_status": translation_status(**{k: v for k, v in title.items()}),
        },
        refresh,
    )  # fmt: skip


def _setting(session, report, refresh, key, value):
    upsert(session, report, SiteSetting, {"key": key}, {"value": value}, refresh)


def seed_history(session, report, refresh):
    lines = parsers.docx_paragraphs(INFO_DIR / "История архива.docx")
    assert lines[0] == "История архива"
    _page(session, report, refresh, "history", "about", 10,
          i18n(ru="История архива"), i18n(ru=_p(lines[1:])))  # fmt: skip


def seed_structure(session, report, refresh):
    lines = parsers.docx_paragraphs(INFO_DIR / "Структура.docx")
    management, departments = parsers.structure_people(lines)

    def person_li(p):
        contacts = ", ".join(x for x in (p["phone"], p["email"]) if x)
        return f"<li>{html.escape(p['position'])}: {html.escape(p['name'])}" + (
            f" ({html.escape(contacts)})" if contacts else ""
        ) + "</li>"

    body = "<h2>Руководство</h2><ul>" + "".join(person_li(p) for p in management) + "</ul>"
    for dep in departments:
        body += f"<h2>{html.escape(dep['name'])}</h2><ul>" + "".join(person_li(p) for p in dep["people"]) + "</ul>"
    _page(session, report, refresh, "structure", "about", 20,
          i18n(ru="Руководство и структура"), i18n(ru=body))  # fmt: skip
    _setting(session, report, refresh, "structure",
             {"management": management, "departments": departments})  # fmt: skip


def seed_contacts(session, report, refresh):
    lines = parsers.docx_paragraphs(INFO_DIR / "Контакты.docx")
    text = "\n".join(lines)

    def field(label: str) -> str:
        return re.search(rf"^{label}\s*:\s*(.+)$", text, flags=re.M).group(1).strip()

    links = re.findall(r"https?://\S+", text)
    instagram = next(html.unescape(u) for u in links if "instagram" in u)
    facebook = next(u for u in links if "facebook" in u)
    contacts = {
        "address": field("Адрес"),
        "director": field("Директор"),
        "phones": [
            {"label": "Директор", "value": "8 (7232) 25-13-22"},
            {"label": "Заместитель директора", "value": "8 (7232) 57-00-15"},
            {"label": "Приёмная", "value": field("Приемная")},
            {"label": "Инспектор по кадрам", "value": field("Инспектор по кадрам")},
            {"label": "Бухгалтерия", "value": field("Бухгалтерия")},
        ],
        "email": field("e-mail"),
        "hours": field("Время работы"),
        "reading_room_hours": field("Время работы читального зала"),
    }
    _setting(session, report, refresh, "contacts", contacts)
    _setting(session, report, refresh, "social",
             {"instagram": {"handle": "@arhiv_vko", "url": instagram}, "facebook": {"url": facebook}})  # fmt: skip
    body = _p([f"Адрес: {contacts['address']}"]) + "<ul>" + "".join(
        f"<li>{html.escape(p['label'])}: {html.escape(p['value'])}</li>" for p in contacts["phones"]
    ) + "</ul>" + _p([
        f"E-mail: {contacts['email']}",
        f"Время работы: {contacts['hours']}",
        f"Время работы читального зала: {contacts['reading_room_hours']}",
    ])
    _page(session, report, refresh, "contacts", "about", 30, i18n(ru="Контакты"), i18n(ru=body))


def seed_branches(session, report, refresh):
    head_contacts = parsers.docx_paragraphs(INFO_DIR / "Контакты.docx")
    head_address = next(x.split(":", 1)[1].strip() for x in head_contacts if x.startswith("Адрес"))
    head = upsert(
        session, report, Branch, {"slug": "branch-head"},
        {
            "name": i18n(ru="Государственный архив Восточно-Казахстанской области",
                         kk="Шығыс Қазақстан облысының мемлекеттік архиві"),
            "short_name": i18n(ru="Головной архив"),
            "type": BranchType.HEAD,
            "address": i18n(ru=head_address),
            "phone": "8 (7232) 25-59-76",
            "email": "arhiv-ukg@yandex.kz",
            "director": i18n(ru="Жапаров Аскар Кенжебаевич"),
            "hours": i18n(ru="Пн–Пт 8.00–17.00; читальный зал Пн–Пт 9.00–16.00"),
            "lat": HEAD_COORDS[0], "lng": HEAD_COORDS[1], "coords_verified": False,
            "show_on_map": True, "position": 0, "workflow_status": PUBLISHED,
            "translation_status": translation_status(ru="x", kk="x"),
        },
        refresh,
    )  # fmt: skip
    for row in parsers.branch_rows():
        slug, short, kind, lat, lng = BRANCH_COORDS[row["no"]]
        name = re.split(r"\s+КГУ\b", row["raw_name"])[0]
        upsert(
            session, report, Branch, {"slug": f"branch-{slug}"},
            {
                "name": i18n(ru=re.sub(r"\s+", " ", name).strip()),
                "short_name": i18n(ru=short),
                "type": BranchType(kind),
                "address": i18n(ru=re.sub(r",(?=\S)", ", ", row["address"])),
                "phone": row["phone"] or None,
                "email": row["email"] or None,
                "director": i18n(ru=row["director"]),
                "lat": Decimal(lat), "lng": Decimal(lng), "coords_verified": False,
                "show_on_map": True, "position": row["no"], "workflow_status": PUBLISHED,
                "translation_status": translation_status(ru="x"),
            },
            refresh,
        )  # fmt: skip
    return head


def seed_memorial_dates(session, report, refresh):
    year_only: list[dict] = []
    with parsers.extracted("Календарь памятных дат") as folder:
        for path in sorted(folder.rglob("календарь * год*.docx")):
            year = int(re.search(r"(20\d\d)", path.name).group(1))
            dated, undated = parsers.calendar_rows(path, report.warnings.append)
            year_only += [{"calendar_year": year, **row} for row in undated]
            for row in dated:
                upsert(
                    session, report, MemorialDate, {"slug": f"memorial-{year}-{row['number']:02d}"},
                    {
                        "year": year, "month": row["month"], "day": row["day"],
                        "event_year": row["event_year"], "date_text": row["date_text"],
                        "text": i18n(ru=row["ru"], kk=row["kk"]),
                        "workflow_status": PUBLISHED,
                        "translation_status": translation_status(ru=row["ru"], kk=row["kk"]),
                    },
                    refresh,
                )  # fmt: skip
    _setting(session, report, refresh, "memorial_dates_year_only", year_only)


COMPLIANCE_DOCS = [
    # slug, ru title, kk title, ru file, kk file
    ("regulation", "Положение об антикоррупционной комплаенс-службе",
     "Сыбайлас жемқорлыққа қарсы комплаенс қызметі туралы ереже",
     "Положение об антикор..pdf", "Сыбайлас жемқорлыққа қарсы комплаене қызметі туралы ереже.pdf"),
    ("action-plan", "План мероприятий по устранению причин и условий коррупционных правонарушений",
     "Сыбайлас жемқорлық тәуекелдерін жою жөніндегі іс-шаралар жоспары",
     "План мероприятий рус.pdf", "План мероприятий каз.pdf"),
    ("risky-positions", "Перечень должностей, подверженных коррупционным рискам",
     "Сыбайлас жемқорлық тәуекеліне бейім лауазымдардың тізбесі",
     "Перечень должностей.pdf", "Перечень должностей каз.pdf"),
    ("analytical-note", "Аналитическая справка по результатам внутреннего анализа коррупционных рисков (2026)",
     "Сыбайлас жемқорлық тәуекелдеріне ішкі талдау нәтижелері бойынша аналитикалық анықтама (2026)",
     "Аналитическая справка ВАКР 2026.pdf", "Аналитикалық анықтама СЖТІТ 2026.pdf"),
    ("information", "Информация об исполнении внутреннего анализа коррупционных рисков",
     "Сыбайлас жемқорлық тәуекеліне ішкі талдауды орындау туралы ақпарат",
     "Информация о работе комплаенс службы.docx", "Информация каз.docx"),
    ("announcement", "Объявление о проведении внутреннего анализа коррупционных рисков",
     "Сыбайлас жемқорлық тәуекелдеріне ішкі талдау жүргізу туралы",
     "О проведении внутреннего анализа коррупционных рисков.docx",
     "Сыбайлас жемқорлық тәуекелдеріне ішкі талдау жүргізу туралы.docx"),
]  # fmt: skip


def _pdf_pages(path: Path) -> int | None:
    return len(pypdf.PdfReader(path).pages) if path.suffix == ".pdf" else None


def seed_compliance(session, report, refresh, storage_dir):
    with parsers.extracted("Комплаенс служба") as folder:
        root = next(folder.iterdir())
        officer_line = (root / "Комплаенс-офицер.txt").read_text(encoding="utf-8").strip()
        officer = officer_line.split(" - ", 1)[1].strip().title()
        _setting(session, report, refresh, "compliance", {"officer": officer})

        ru_intro = parsers.docx_paragraphs(root / "О проведении внутреннего анализа коррупционных рисков.docx")
        ru_info = parsers.docx_paragraphs(root / "Информация о работе комплаенс службы.docx")
        kk_intro = parsers.docx_paragraphs(root / "Сыбайлас жемқорлық тәуекелдеріне ішкі талдау жүргізу туралы.docx")
        kk_info = parsers.docx_paragraphs(root / "Информация каз.docx")
        body = {
            "ru": f"<p>Комплаенс-офицер: {html.escape(officer)}</p>" + _p(ru_intro + ru_info[2:]),
            "kk": f"<p>Комплаенс-офицер: {html.escape(officer)}</p>" + _p(kk_intro + kk_info[2:]),
        }
        _page(session, report, refresh, "compliance", "compliance", 40,
              i18n(ru="Комплаенс-служба / Антикоррупция", kk="Комплаенс қызметі / Сыбайлас жемқорлыққа қарсы іс-қимыл"),
              body)  # fmt: skip

        for position, (slug, ru_title, kk_title, ru_file, kk_file) in enumerate(COMPLIANCE_DOCS):
            act = upsert(
                session, report, LegalAct, {"slug": f"compliance-{slug}"},
                {
                    "title": i18n(ru=ru_title, kk=kk_title),
                    "issuer": i18n(ru=ARCHIVE_RU),
                    "status": LegalActStatus.ACTIVE,
                    "workflow_status": PUBLISHED,
                    "translation_status": translation_status(ru="x", kk="x"),
                },
                refresh,
            )  # fmt: skip
            session.flush()
            for lang, file_name in (("ru", ru_file), ("kk", kk_file)):
                source = root / file_name
                stored = attach_file(
                    session, report, storage_dir, owner_type="legal_act", owner_id=act.id,
                    position=0 if lang == "ru" else 1, name=f"compliance/{slug}-{lang}{source.suffix}",
                    source=source, access=FileAccess.OPEN, is_demo=False, refresh=refresh,
                    pages=_pdf_pages(source), ocr_status=OcrStatus.NONE,
                    caption=i18n(**{lang: ru_title if lang == "ru" else kk_title}),
                )  # fmt: skip
                session.flush()
                if lang == "ru" and act.file_id is None:
                    act.file_id = stored.id


def seed_resolution_142(session, report, refresh, storage_dir):
    act = upsert(
        session, report, LegalAct, {"slug": "resolution-142-2026"},
        {
            "title": i18n(ru="О некоторых вопросах архивных учреждений Восточно-Казахстанской области",
                          kk="Шығыс Қазақстан облысының архив мекемелерінің кейбір мәселелері туралы"),
            "number": "142",
            "date": date(2026, 6, 2),
            "issuer": i18n(ru="Акимат Восточно-Казахстанской области", kk="Шығыс Қазақстан облысының әкімдігі"),
            "status": LegalActStatus.ACTIVE,
            "workflow_status": PUBLISHED,
            "translation_status": translation_status(ru="x", kk="x"),
        },
        refresh,
    )  # fmt: skip
    session.flush()
    source = INFO_DIR / "Постановление обл акимата 142.pdf"
    stored = attach_file(
        session, report, storage_dir, owner_type="legal_act", owner_id=act.id, position=0,
        name="legal/resolution-142-2026.pdf", source=source, access=FileAccess.OPEN,
        is_demo=False, refresh=refresh, pages=_pdf_pages(source),
        caption=i18n(ru="Постановление акимата ВКО №142 от 2 июня 2026 г. (скан)"),
    )  # fmt: skip
    session.flush()
    if act.file_id is None:
        act.file_id = stored.id


# Order of the four headings in Фонды.docx.
FUND_CATEGORY_TYPES = ["newspaper", "organization", "party", "personal"]


def seed_fund_categories(session, report, refresh):
    with parsers.extracted("Фонды") as folder:
        titles = parsers.docx_paragraphs(next(folder.rglob("Фонды.docx")))
    assert len(titles) == len(FUND_CATEGORY_TYPES), "Фонды.docx structure changed"
    for position, (fund_type, title) in enumerate(zip(FUND_CATEGORY_TYPES, titles, strict=True)):
        # The text ends with «по состоянию на 01.01.2026г.»: keep it as the description.
        upsert(
            session, report, Category, {"slug": f"fund-category-{fund_type}"},
            {
                "scope": "fund_type", "position": position, "workflow_status": PUBLISHED,
                "name": i18n(ru=title.split(" по состоянию")[0]),
                "description": i18n(ru=title),
                "translation_status": translation_status(ru="x"),
            },
            refresh,
        )  # fmt: skip


def seed_info(session: Session, report: Report, storage_dir: Path, refresh: bool) -> None:
    seed_history(session, report, refresh)
    seed_structure(session, report, refresh)
    seed_contacts(session, report, refresh)
    seed_branches(session, report, refresh)
    seed_memorial_dates(session, report, refresh)
    seed_compliance(session, report, refresh, storage_dir)
    seed_resolution_142(session, report, refresh, storage_dir)
    seed_fund_categories(session, report, refresh)
