"""Machine translations of the seeded demo content, shipped as data (`seed/translations.json`).

The demo has to open in kk and en without running a language model. Objects are matched by a fingerprint of
their Russian text (every translatable field), so the file needs no ids and survives re-seeding.
All loaded texts are marked `machine`: they need a native speaker's review before real use.

    python -m seed.translations_data export   # write seed/translations.json from the current database
    python -m seed.translations_data load     # fill missing kk/en from it (also done by `python -m seed`)
"""

import hashlib
import json
import sys
from pathlib import Path

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.db import get_sessionmaker
from app.services import translations as tr
from app.services import workflow

FILE = Path(__file__).parent / "translations.json"
TARGETS = ("kk", "en")


def _ru_fields(obj, fields: list[str]) -> dict[str, str]:
    out = {}
    for name in fields:
        value = getattr(obj, name, None)
        if isinstance(value, dict) and isinstance(value.get("ru"), str) and value["ru"].strip():
            out[name] = value["ru"]
    return out


def fingerprint(table: str, ru: dict[str, str]) -> str:
    return f"{table}|{hashlib.sha1(json.dumps(ru, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]}"


def export(session: Session) -> dict[str, dict[str, dict[str, str]]]:
    data: dict[str, dict[str, dict[str, str]]] = {}
    for object_type, (model, _module) in workflow.WORKFLOW_OBJECTS.items():
        fields = tr.translatable_fields(model)
        for obj in session.query(model).all():
            ru = _ru_fields(obj, fields)
            if not ru:
                continue
            found = {f: {t: getattr(obj, f)[t] for t in TARGETS if isinstance(getattr(obj, f).get(t), str) and getattr(obj, f)[t].strip()} for f in ru}
            found = {f: v for f, v in found.items() if v}
            if found:
                data[fingerprint(object_type, ru)] = found
    return data


def load(session: Session) -> int:
    if not FILE.exists():
        return 0
    data = json.loads(FILE.read_text(encoding="utf-8"))
    filled = 0
    for object_type, (model, _module) in workflow.WORKFLOW_OBJECTS.items():
        fields = tr.translatable_fields(model)
        for obj in session.query(model).all():
            ru = _ru_fields(obj, fields)
            known = data.get(fingerprint(object_type, ru)) if ru else None
            if not known:
                continue
            status = dict(obj.translation_status or {})
            for name, langs in known.items():
                current = dict(getattr(obj, name) or {})
                for lang, text in langs.items():
                    if not (isinstance(current.get(lang), str) and current[lang].strip()):
                        current[lang] = text
                        status[lang] = "machine"
                        filled += 1
                setattr(obj, name, current)
                flag_modified(obj, name)
            obj.translation_status = status
            flag_modified(obj, "translation_status")
    session.flush()
    return filled


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    with get_sessionmaker()() as session:
        if command == "export":
            data = export(session)
            FILE.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
            print(f"{len(data)} objects written to {FILE}")
        elif command == "load":
            print(f"{load(session)} texts filled")
            session.commit()
        else:
            print(__doc__)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
