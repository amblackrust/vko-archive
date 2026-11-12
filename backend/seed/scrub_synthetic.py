"""Removes «fictional / demo» wording from the public text of the seeded data.

The site must not say the data is synthetic (customer decision, DECISIONS.md п.108); the fact is recorded only in the
project docs. The Russian text is cleaned with regexes; kk/en of every changed field are dropped so that
`python -m seed.translate_all` re-translates them from the clean Russian. Then the search index is rebuilt.
Run: python -m seed.scrub_synthetic && python -m seed.translate_all
"""

import re
import sys

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.db import get_sessionmaker
from app.models import Collection, DigitalFile, Document, Exhibit, Exhibition, Fund, HistoricalEvent, News
from app.services import indexing

FICTION = r"вымышленн\w+|вымышл\w+"
# Order matters: whole phrases first, loose words last.
RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"Заглушка аудиозаписи \(тишина, 1 с\)\.\s*Содержание вымышленное\.?", re.I), "Аудиозапись из архивной коллекции."),
    (re.compile(rf"\s*\((?:{FICTION})[^)]*\)", re.I), ""),
    (re.compile(r"\s*Документ вымышлен\.?", re.I), ""),
    (re.compile(r"^\s*Вымышленное место\.?\s*$", re.I), ""),
    (re.compile(r"^\s*Вымышленный (?:объект|материал)\s*[:,—-]\s*", re.I), ""),
    (re.compile(r"\b(?:вымышленн\w+)\s+", re.I), ""),
]


def clean(value: str) -> str:
    out = value
    for pattern, repl in RULES:
        out = pattern.sub(repl, out)
    out = out.strip()
    return out[:1].upper() + out[1:] if out and out != value else out


def scrub_i18n(obj: object, name: str) -> bool:
    value = getattr(obj, name)
    if not isinstance(value, dict) or not isinstance(value.get("ru"), str):
        return False
    new = clean(value["ru"])
    if new == value["ru"]:
        return False
    updated = {"ru": new} if new else {}
    setattr(obj, name, updated)
    flag_modified(obj, name)
    return True


FIELDS = {
    HistoricalEvent: ["title", "description", "place"],
    Collection: ["description", "title"],
    Exhibition: ["intro", "title"],
    Fund: ["annotation", "title"],
    News: ["summary", "title", "body"],
    Exhibit: ["caption", "source", "title"],
    Document: ["authors", "summary", "historical_note", "title"],
    DigitalFile: ["rights_note"],
}


def scrub(session) -> int:
    """Cleans the public text in place; returns the number of changed objects (the caller commits)."""
    changed = 0
    for model, names in FIELDS.items():
        for obj in session.scalars(select(model)):
            hit = [n for n in names if scrub_i18n(obj, n)]
            if model is DigitalFile and obj.ocr_text and re.search(FICTION, obj.ocr_text, re.I):
                obj.ocr_text = clean(obj.ocr_text)
                hit.append("ocr_text")
            if model is HistoricalEvent and isinstance(obj.sources, list):
                kept = [s for s in obj.sources if not re.search(FICTION, str(s.get("title", "")), re.I)]
                if kept != obj.sources:
                    obj.sources = kept
                    flag_modified(obj, "sources")
                    hit.append("sources")
            if hit:
                if hasattr(obj, "translation_status") and obj.translation_status:
                    obj.translation_status = {k: v for k, v in obj.translation_status.items() if k == "ru"}
                    flag_modified(obj, "translation_status")
                changed += 1
    session.flush()
    return changed


def main() -> int:
    with get_sessionmaker()() as session:
        print(f"cleaned {scrub(session)} objects")
        print(indexing.reindex_all(session))
        session.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
