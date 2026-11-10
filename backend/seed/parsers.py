"""Readers for the customer's source files in info/ (docx, xls, 7z). info/ is never modified."""

import re
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import docx
import py7zr
import xlrd

from seed.common import INFO_DIR

KAZAKH_LETTERS = set("әғқңөұүһі")
RU_MONTHS = {
    "янв": 1, "фев": 2, "март": 3, "апр": 4, "мая": 5, "май": 5, "июн": 6,
    "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12,
}  # fmt: skip
KK_MONTHS = {
    "қаң": 1, "ақп": 2, "нау": 3, "сәу": 4, "мам": 5, "мау": 6,
    "шіл": 7, "там": 8, "қыр": 9, "қаз": 10, "қар": 11, "жел": 12,
}  # fmt: skip


@contextmanager
def extracted(archive_name: str) -> Iterator[Path]:
    """Unpack info/<archive_name>.7z into a temporary directory that is removed afterwards."""
    with tempfile.TemporaryDirectory(prefix="vko-seed-") as tmp:
        with py7zr.SevenZipFile(INFO_DIR / f"{archive_name}.7z") as archive:
            archive.extractall(tmp)
        yield Path(tmp)


def docx_paragraphs(path: Path) -> list[str]:
    return [p.text.strip() for p in docx.Document(path).paragraphs if p.text.strip()]


def branch_rows() -> list[dict[str, str]]:
    """Rows of the first sheet of 'Адреса и контакты филиалов.xls' (the branch list)."""
    sheet = xlrd.open_workbook(INFO_DIR / "Адреса и контакты филиалов.xls").sheet_by_index(0)
    header_row = next(r for r in range(sheet.nrows) if "Директор" in sheet.row_values(r))
    rows = []
    for r in range(header_row + 1, sheet.nrows):
        cells = [str(c).strip() for c in sheet.row_values(r)]
        if not cells[1]:
            continue
        rows.append(
            {
                "no": int(float(cells[0])),
                "raw_name": cells[1],
                "director": cells[2],
                "address": cells[3],
                "phone": cells[4],
                "email": cells[5],
            }
        )
    return rows


def parse_month_day(text: str) -> tuple[int, int | None] | None:
    """'20 февраля' -> (2, 20); 'апрель' -> (4, None); unknown -> None."""
    lowered = text.lower().strip()
    for stem, month in {**RU_MONTHS, **KK_MONTHS}.items():
        if re.search(rf"(?<![а-яәғқңөұүһі]){stem}", lowered):
            day = re.match(r"\s*(\d{1,2})\b", lowered)
            return month, int(day.group(1)) if day else None
    return None


def _is_kazakh(table) -> bool:
    text = " ".join(cell.text for row in table.rows for cell in row.cells).lower()
    return sum(ch in KAZAKH_LETTERS for ch in text) > len(text) * 0.03


def calendar_rows(path: Path, report_warning) -> tuple[list[dict], list[dict]]:
    """Memorial dates of one yearly calendar: two tables (kk, ru) paired row by row.

    Returns (dated rows, year-only rows). The calendars end with a block of anniversaries
    known only by year ('1747 год'); MemorialDate.month is NOT NULL, so they are returned apart."""
    tables = docx.Document(path).tables
    kk_table, ru_table = (
        (tables[0], tables[1]) if _is_kazakh(tables[0]) else (tables[1], tables[0])
    )
    rows, year_only = [], []
    # Row 0 of both tables is the header.
    for number, (kk_row, ru_row) in enumerate(zip(kk_table.rows[1:], ru_table.rows[1:], strict=False), 1):
        kk_date, kk_text = (c.text.strip() for c in kk_row.cells[:2])
        ru_date, ru_text = (c.text.strip() for c in ru_row.cells[:2])
        if not (ru_text or kk_text):
            continue
        parsed = parse_month_day(ru_date) or parse_month_day(kk_date)
        event_year = re.search(r"\((\d{4})", ru_text) or re.search(r"\((\d{4})", kk_text)
        if parsed is None and not re.match(r"\d{4}", ru_date):
            report_warning(f"{path.name} row {number}: unparsable date {ru_date!r}/{kk_date!r}")
            continue
        (year_only if parsed is None else rows).append(
            {
                "number": number,
                "month": parsed[0] if parsed else None,
                "day": parsed[1] if parsed else None,
                "date_text": re.sub(r"\s+", " ", ru_date or kk_date),
                "event_year": int(event_year.group(1)) if event_year else None,
                "ru": re.sub(r"\s+", " ", ru_text),
                "kk": re.sub(r"\s+", " ", kk_text),
            }
        )
    return rows, year_only


def structure_people(lines: list[str]) -> tuple[list[dict], list[dict]]:
    """Parse 'Структура.docx' into (management, departments).

    Lines look like 'Директор - Name, телефон: ..., mail@...' or 'Отдел ...:' headers
    followed by 'Position – Name, телефон: ...'. An empty 'Заместитель директора:' is skipped."""
    start = next(i for i, line in enumerate(lines) if line.startswith("Директор - "))
    management: list[dict] = []
    departments: list[dict] = []
    for line in lines[start:]:
        if line.endswith(":") and line.startswith("Отдел"):
            departments.append({"name": line.rstrip(":"), "people": []})
            continue
        sep = re.search(r"\s[–-]\s|:\s", line)
        if not sep:
            continue
        position, rest = line[: sep.start()].strip(), line[sep.end() :]
        parts = [p.strip() for p in rest.split(",")]
        person = {
            "position": position,
            "name": parts[0],
            "phone": next((p.split(":", 1)[1].strip() for p in parts if p.startswith("телефон")), None),
            "email": next((p for p in parts if "@" in p), None),
        }
        is_department_head = departments and position != "Главный хранитель фондов"
        (departments[-1]["people"] if is_department_head else management).append(person)
    return management, departments
