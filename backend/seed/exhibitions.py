"""T2.4: three demo online exhibitions. Exhibits are open demo catalog documents with digital copies,
so the file access of an exhibit follows its document (checked on the server, see services/authz)."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Exhibit, Exhibition, WorkflowStatus
from seed.common import Report, demo_document, demo_document_file, i18n, upsert

PUBLISHED = WorkflowStatus.PUBLISHED
SOURCE_PREFIX = "Вымышленный документ, архивный шифр "


@dataclass(frozen=True)
class ExhibitionSpec:
    slug: str
    theme: str
    period: str
    title: dict[str, str]
    intro: dict[str, str]
    documents: tuple[str, ...]  # keys of demo documents, in exhibit order


# Topics from ТЗ §5.7. The WWII topic is not here: the demo catalog has only three open WWII scans.
EXHIBITIONS = [
    ExhibitionSpec(
        slug="exhibition-ust-kamenogorsk",
        theme="ust-kamenogorsk",
        period="1950–1960-е",
        title=i18n(
            ru="Усть-Каменогорск: история города в архивных документах",
            kk="Өскемен: қала тарихы архив құжаттарында",
            en="Ust-Kamenogorsk: the city's history in archival documents",
        ),
        intro=i18n(
            ru="Выставка на вымышленных документах о городе 1950–1960-х годов.",
            kk="1950–1960 жылдардағы қала туралы ойдан шығарылған құжаттар көрмесі.",
            en="An exhibition of fictitious documents about the city in the 1950s and 1960s.",
        ),
        documents=("d2-1-1-1", "d2-1-1-2", "d2-1-2-1", "d2-1-2-2", "d2-1-3-1", "d4-1-1-1", "d4-1-1-2", "d1-2-1-2"),
    ),
    ExhibitionSpec(
        slug="exhibition-industry",
        theme="industry",
        period="1950–1960-е",
        title=i18n(
            ru="Промышленное развитие Восточного Казахстана",
            kk="Шығыс Қазақстанның өнеркәсіптік дамуы",
            en="Industrial development of East Kazakhstan",
        ),
        intro=i18n(
            ru="Выставка на вымышленных документах о строительстве и работе цехов комбината.",
            kk="Комбинат цехтарының құрылысы мен жұмысы туралы ойдан шығарылған құжаттар көрмесі.",
            en="An exhibition of fictitious documents on building and running the plant's workshops.",
        ),
        documents=("d1-1-1-1", "d1-1-1-2", "d1-1-2-1", "d1-1-2-2", "d1-1-3-2", "d1-2-1-1", "d1-2-1-3", "d1-2-2-1"),
    ),
    ExhibitionSpec(
        slug="exhibition-education",
        theme="education",
        period="1960–1970-е",
        title=i18n(
            ru="История образования в регионе",
            kk="Өңірдегі білім беру тарихы",
            en="History of education in the region",
        ),
        intro=i18n(
            ru="Выставка на вымышленных школьных документах и материалах об учителях.",
            kk="Ойдан шығарылған мектеп құжаттары мен мұғалімдер туралы материалдар көрмесі.",
            en="An exhibition of fictitious school documents and materials about teachers.",
        ),
        documents=("d6-1-1-1", "d6-1-1-2", "d6-1-1-3", "d6-1-2-1", "d6-1-2-2", "d6-1-2-3", "d2-1-3-2"),
    ),
]


def seed_exhibitions(session: Session, report: Report, refresh: bool) -> None:
    for spec in EXHIBITIONS:
        documents = [demo_document(session, key) for key in spec.documents]
        files = [demo_document_file(session, document) for document in documents]
        exhibition = upsert(
            session, report, Exhibition, {"slug": spec.slug},
            {
                "theme": spec.theme,
                "period": spec.period,
                "title": spec.title,
                "intro": spec.intro,
                "cover_file_id": files[0].id,
                "is_demo": True,
                "workflow_status": PUBLISHED,
                # ru is the original text of the demo; kk/en are machine translations to be proofread.
                "translation_status": {"ru": "verified", "kk": "machine", "en": "machine"},
            },
            refresh,
        )  # fmt: skip
        session.flush()
        for position, (document, file) in enumerate(zip(documents, files, strict=True), 1):
            upsert(
                session, report, Exhibit, {"slug": f"{spec.slug}-{position:02d}"},
                {
                    "exhibition_id": exhibition.id,
                    "position": position,
                    "title": i18n(ru=document.title["ru"]),
                    "caption": i18n(ru=document.summary["ru"]),
                    "source": i18n(ru=SOURCE_PREFIX + document.archive_code),
                    "archive_code": document.archive_code,
                    "document_id": document.id,
                    "media_file_id": file.id,
                    "is_demo": True,
                    "workflow_status": PUBLISHED,
                    "translation_status": {"ru": "verified", "kk": "missing", "en": "missing"},
                },
                refresh,
            )  # fmt: skip
