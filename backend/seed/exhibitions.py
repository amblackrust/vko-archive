"""Online exhibitions built from the open historical materials (fund ОИ-1, seed/open_data.py).

Every exhibit is a catalogue document with an open copy: it links to its card and names its source
(Wikimedia Commons, author, licence) on the exhibit itself. The file access of an exhibit follows
its document (checked on the server, see services/authz)."""

from sqlalchemy.orm import Session

from app.models import Exhibit, Exhibition, WorkflowStatus
from seed.common import MACHINE_KK_EN, Report, i18n, upsert
from seed.open_data import EXHIBITIONS
from seed.open_materials import credit, first_file, manifest, open_document

PUBLISHED = WorkflowStatus.PUBLISHED


def seed_exhibitions(session: Session, report: Report, refresh: bool) -> None:
    entries = manifest()
    for spec in EXHIBITIONS:
        slug, exhibits = spec["slug"], spec["exhibits"]
        cover = first_file(session, open_document(session, spec.get("cover", exhibits[0][0])))
        exhibition = upsert(
            session, report, Exhibition, {"slug": slug},
            {
                "theme": spec["theme"],
                "period": spec["period"],
                "title": spec["title"],
                "intro": spec["intro"],
                "cover_file_id": cover.id,
                "is_demo": False,
                "workflow_status": PUBLISHED,
                "translation_status": dict(MACHINE_KK_EN),
            },
            refresh,
        )  # fmt: skip
        session.flush()
        for position, (file, caption) in enumerate(exhibits, 1):
            document = open_document(session, file)
            upsert(
                session, report, Exhibit, {"slug": f"{slug}-{position:02d}"},
                {
                    "exhibition_id": exhibition.id,
                    "position": position,
                    "title": dict(document.title),
                    "caption": i18n(ru=caption or document.summary["ru"]),
                    "source": i18n(ru=credit(entries[file])),
                    "archive_code": document.archive_code,
                    "document_id": document.id,
                    "media_file_id": first_file(session, document).id,
                    "is_demo": False,
                    "workflow_status": PUBLISHED,
                    # Titles come with the kk/en of the manifest (not proofread); caption and source are ru only.
                    "translation_status": dict(MACHINE_KK_EN),
                },
                refresh,
            )  # fmt: skip
