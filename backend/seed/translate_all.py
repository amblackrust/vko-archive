"""Demo helper: fills kk/en for every workflow object from the Russian text with the local model.

Machine output is written straight into the rows (no workflow) and marked translation_status="machine":
it needs a human check before being treated as final. Run: python -m seed.translate_all [--langs kk,en]
Resumable: a language that already has text is skipped.
"""

import argparse
import logging
import sys

from sqlalchemy.orm.attributes import flag_modified

from app.config import get_settings
from app.db import get_sessionmaker
from app.services import translations as tr
from app.services import workflow
from app.services.translations import TranslationUnavailable

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("translate_all")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--langs", default="en,kk")
    langs = parser.parse_args().langs.split(",")
    settings = get_settings()
    session = get_sessionmaker()()
    done = failed = 0
    for object_type, (model, _module) in workflow.WORKFLOW_OBJECTS.items():
        fields = tr.translatable_fields(model)
        ids = [row.id for row in session.query(model).all()]
        for object_id in ids:
            for target in langs:
                obj = session.get(model, object_id)
                status = dict(obj.translation_status or {})
                texts = {
                    name: value["ru"]
                    for name in fields
                    if isinstance(value := getattr(obj, name) or {}, dict)
                    and isinstance(value.get("ru"), str) and value["ru"].strip()
                    and not (isinstance(value.get(target), str) and value[target].strip())
                }
                if not texts or sum(len(t) for t in texts.values()) > tr.MAX_SOURCE_CHARS:
                    continue
                try:
                    translated = tr._translate(texts, "ru", target, settings)
                except TranslationUnavailable as exc:
                    failed += 1
                    log.warning("%s %s %s failed: %s", object_type, object_id, target, exc.reason)
                    session.rollback()
                    continue
                for name, text in translated.items():
                    setattr(obj, name, {**(getattr(obj, name) or {}), target: text})
                    flag_modified(obj, name)
                status[target] = "machine"
                obj.translation_status = status
                flag_modified(obj, "translation_status")
                session.commit()
                done += 1
                log.info("%s %s → %s ok (%d fields)", object_type, object_id, target, len(translated))
    log.info("finished: %d translated, %d failed", done, failed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
