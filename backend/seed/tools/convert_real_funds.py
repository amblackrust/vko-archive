"""One-off converter: the archive's public fund lists (info/e-arhiv/) -> seed/data/*.json.

The result is committed and the seed reads only the JSON, so `pyxlsb` is needed only here
(it is not in requirements.txt): `uv pip install -p .venv/bin/python pyxlsb`, then
`.venv/bin/python -I seed/tools/convert_real_funds.py` from backend/. The sources are only parsed.

Access policy: a fund that is fully secret (mark «с», an unknown mark, or the name
«секретный фонд») is not written at all, only counted in `meta.skipped_restricted`.
A partially restricted fund («ч.с.», or a count of secret units in its volume) is written as a
description with `restricted = "partial"`; the count of secret units is never written.
"""

import json
import re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[3]
SOURCES = ROOT / "info" / "e-arhiv"
OUT = ROOT / "backend" / "seed" / "data"
BASE_URL = "http://e-arhiv.vko.gov.kz/akimsemey/other/"
FUNDS_FILE = "Фонды госархива ВКО на 2018г..xlsb"
PARTY_FILE = "парт фонды госархива ВКО на 2018г..xlsb"
NEWSPAPERS_FILE = "газеты за 1935-2017.docx"

# Column indexes of the «Фонды» sheet: row №, first receipt, fund number, category, ownership,
# dates of the name, name, units, first/last year of the documents, card date (or a note).
FUNDS_COLUMNS = (0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 12)
PARTY_COLUMNS = (0, 1, 4, 5, 6, 7, 8, 10, 13, 14, 15)
# Source typo: row № 1011 is numbered «Р-549» but stands between Р-458 and Р-460
# (Р-459 is otherwise missing; the real Р-549 is row № 1293).
FUNDS_FIXES = {1011: "Р-459"}

_NUMBER = re.compile(r"Р?[\s-]*(\d+)\s*(П?)(.*)", re.S)
_YEAR = re.compile(r"(?<!\d)(?:1[6-9]|20)\d\d(?!\d)")
_SECRET_UNITS = re.compile(r"/\s*\d+\s*[сc]", re.I)
_W = "[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+"
# «Фамилия Имя Отчество - кто»: a fund of personal origin (family funds and other spellings stay `organization`).
_PERSON = re.compile(rf"{_W}(-{_W})? {_W} {_W}\s*[-–—,(]")
_OWNERSHIP = {"государственная": "state", "частная": "private"}
_DITTO = "-/-"


def clean(value: object) -> str:
    """One line of text: hyphenated line breaks are joined, whitespace is collapsed."""
    text = re.sub(r"-\s*\n\s*(?=[а-яё])", "", str(value if value is not None else ""))
    return " ".join(text.split())


def split_number(raw: object) -> tuple[str, str | None]:
    """«Р -1 ч.с.» -> ("Р-1", "partial"); «1П/ч.с» -> ("1П", "partial"); «Р-65с» -> ("Р-65", "secret").
    A mark that is not understood counts as secret: unclear rights are not published."""
    match = _NUMBER.fullmatch(clean(raw))
    if match is None:
        raise ValueError(f"fund number not understood: {raw!r}")
    digits, party, rest = match.groups()
    mark = re.sub(r"[\s./]", "", rest).lower()
    restricted = None if not mark else "partial" if set(mark) == {"ч", "с"} else "secret"
    return (f"{digits}П" if party else f"Р-{digits}"), restricted


def years(raw: object) -> list[int]:
    """Plausible 4-digit years in a cell («1946,1988», 1982.2017, «20.02.1932-18.09.1939»)."""
    return [int(year) for year in _YEAR.findall(str(raw if raw is not None else ""))]


def units(raw: object) -> tuple[int | None, bool]:
    """(storage units, has secret units): «3618/34с» -> (3618, True), «17646/3с 5211 ОД» -> (17646, True)."""
    match = re.match(r"\d+", str(raw if raw is not None else ""))
    return (int(match.group()) if match else None), bool(_SECRET_UNITS.search(str(raw)))


def excel_date(raw: object) -> str | None:
    """Excel serial -> ISO date; text, bare years typed as numbers (1942.0) and other junk -> None."""
    if not isinstance(raw, float):
        return None
    day = date(1899, 12, 30) + timedelta(days=int(raw))
    return day.isoformat() if 1920 <= day.year <= 2030 else None


def category(raw: object) -> int | None:
    value = str(raw).split(".")[0] if raw is not None else ""
    return int(value) if value in ("1", "2", "3") else None


def _first(values: list) -> object:
    return next((value for value in values if value is not None), None)


def build_funds(rows: list[list], columns: tuple[int, ...], fund_type: str, fixes: dict[int, str] | None = None) -> tuple[list[dict], dict]:
    """Rows of a «Фонды» sheet (one per historical name) -> (funds, meta counters)."""
    c_row, c_received, c_number, c_category, c_ownership, c_dates, c_name, c_units, c_from, c_to, c_card = columns
    groups: dict[str, list[list]] = {}
    marks: dict[str, set[str | None]] = {}
    warnings: list[str] = []
    number = None
    for row in rows:
        if not clean(row[c_name]):
            continue  # empty and total rows
        raw = (fixes or {}).get(row[c_row], row[c_number])
        previous = number
        if clean(raw):  # a row without a number continues the previous fund
            number, mark = split_number(raw)
            marks.setdefault(number, set()).add(mark)
        if number != previous and number in groups:
            warnings.append(f"{number}: repeated in row {row[c_row]}")
        groups.setdefault(number, []).append(row)

    funds, skipped, partial = [], 0, 0
    for number, group in groups.items():
        # «не установлено» and other dates without a digit are unknown.
        names = [{"dates": clean(r[c_dates]) if re.search(r"\d", clean(r[c_dates])) else None, "name": clean(r[c_name])} for r in group]
        if "secret" in marks[number] or any(n["name"].lower() == "секретный фонд" for n in names):
            skipped += 1
            continue
        count, secret_units = units(_first([r[c_units] for r in group]))
        restricted = "partial" if "partial" in marks[number] or secret_units else None
        partial += restricted is not None
        name_years = [y for n in names for y in years(n["dates"])]
        start = [y for r in group for y in years(r[c_from])] or name_years
        end = [y for r in group for y in years(r[c_to])]
        if not end and not re.search(r"-\W*$", names[-1]["dates"] or ""):  # «2004-» is open-ended
            end = name_years
        if start and end and min(start) > max(end):  # the source has the two years the wrong way round
            warnings.append(f"{number}: years {min(start)} > {max(end)}, swapped")
            start, end = end, start
        notes = [clean(r[c_card]) for r in group if isinstance(r[c_card], str) and re.search("[А-Яа-я]{3}", r[c_card])]
        funds.append({
            "number": number,
            "type": "personal" if fund_type == "organization" and _PERSON.match(names[-1]["name"]) else fund_type,
            "title": names[-1]["name"],
            "names": names,
            "dates_from": min(start, default=None),
            "dates_to": max(end, default=None),
            "units_count": count,
            "category": _first([category(r[c_category]) for r in group]),
            "ownership": _first([_OWNERSHIP.get(clean(r[c_ownership]).lower()) for r in reversed(group)]),
            "first_received": _first([excel_date(r[c_received]) for r in group]),
            "restricted": restricted,
            "note": notes[0] if notes else None,
        })  # fmt: skip
    meta = {"funds": len(funds), "names": sum(len(f["names"]) for f in funds), "partial": partial,
            "skipped_restricted": skipped, "warnings": warnings}  # fmt: skip
    return funds, meta


def covered_years(text: str) -> list[int]:
    """«1942, 1944-1945, 1950» -> [1942, 1944, 1945, 1950]; «07.05-23.05 1958» -> [1958]."""
    covered: set[int] = set()
    for first, last in re.findall(rf"({_YEAR.pattern})(?:\s*-\s*({_YEAR.pattern}))?", text):
        covered.update(range(int(first), int(last or first) + 1))
    return sorted(covered)


def build_newspapers(rows: list[list[str]]) -> list[dict]:
    """Table rows (№, title, publisher, volumes, years, note), one per bound volume -> holdings.
    «-/-» repeats the publisher above; another publisher under the same title is another newspaper."""
    holdings: list[dict] = []
    for _, title, publisher, volumes, years_text, note in rows:
        title, publisher, years_text = clean(title), clean(publisher), clean(years_text)
        covered = covered_years(years_text)
        if not covered:
            continue  # header rows
        current = holdings[-1] if holdings else None
        if current is None or current["title"] != title or publisher not in ("", _DITTO, current["publisher"]):
            current = {"title": title, "publisher": publisher if publisher not in ("", _DITTO) else None,
                       "year_from": covered[0], "year_to": covered[-1], "volumes_total": 0, "years_covered": [], "years": []}  # fmt: skip
            holdings.append(current)
        # A volume that is not exactly one year keeps the source text of its period in the note.
        period = years_text if years_text != str(covered[0]) else ""
        current["years"].append({"year": covered[0], "volumes": int(volumes), "note": "; ".join(filter(None, [period, clean(note)])) or None})
        current["volumes_total"] += int(volumes)
        current["years_covered"] = sorted({*current["years_covered"], *covered})
        current["year_from"], current["year_to"] = current["years_covered"][0], current["years_covered"][-1]
    return holdings


def _sheet(path: Path, skip: int) -> list[list]:
    from pyxlsb import open_workbook

    with open_workbook(str(path)) as workbook, workbook.get_sheet("Фонды") as sheet:
        return [[cell.v for cell in row] for row in sheet.rows()][skip:]


def _write(name: str, key: str, items: list[dict], source: str, meta: dict) -> None:
    meta = {"source": source, "url": BASE_URL + quote(source), "fetched": "2026-11-11", "as_of": 2018, **meta}
    OUT.mkdir(parents=True, exist_ok=True)
    lines = ",\n".join(json.dumps(item, ensure_ascii=False) for item in items)  # one item per line: readable diffs
    (OUT / name).write_text(f'{{"meta": {json.dumps(meta, ensure_ascii=False)},\n"{key}": [\n{lines}\n]}}\n', encoding="utf-8")
    print(name, meta)


def main() -> None:
    import docx

    funds, meta = build_funds(_sheet(SOURCES / FUNDS_FILE, 1), FUNDS_COLUMNS, "organization", FUNDS_FIXES)
    _write("funds.json", "funds", funds, FUNDS_FILE, {**meta, "corrections": {f"row {k}": v for k, v in FUNDS_FIXES.items()}})
    funds, meta = build_funds(_sheet(SOURCES / PARTY_FILE, 2), PARTY_COLUMNS, "party")
    _write("party_funds.json", "funds", funds, PARTY_FILE, meta)
    table = docx.Document(str(SOURCES / NEWSPAPERS_FILE)).tables[0]
    newspapers = build_newspapers([[cell.text for cell in row.cells] for row in table.rows])
    _write("newspapers.json", "newspapers", newspapers, NEWSPAPERS_FILE,
           {"newspapers": len(newspapers), "titles": len({n["title"] for n in newspapers}),
            "volumes": sum(n["volumes_total"] for n in newspapers)})  # fmt: skip


if __name__ == "__main__":
    main()
