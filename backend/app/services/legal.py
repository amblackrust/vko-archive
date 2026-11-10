"""Legal acts and the compliance page (T5.6, T5.7). Read-only, public, no authorization beyond
publication. Files are offered only as /api/files links and only when the file itself is open."""

from sqlalchemy.orm import Session

from app.models import DigitalFile, LegalAct
from app.models.enums import FileAccess
from app.repositories import legal as repo
from app.schemas.legal import ActFile, CompliancePage, LegalActItem, LegalActParams, LegalActsResponse
from app.services import files as files_service
from app.services.catalog import pick
from app.services.errors import NotFound

# Compliance materials are seeded as legal acts with this slug prefix (see seed/info_content.py).
COMPLIANCE_SLUG_PREFIX = "compliance-"


def _item(act: LegalAct, file: DigitalFile | None, lang: str) -> LegalActItem:
    title, title_lang = pick(act.title, lang)
    act_file = None
    if file is not None and file.access == FileAccess.OPEN:
        act_file = ActFile(url=files_service.file_url(file.id), mime=file.mime, pages=file.pages)
    # Only web links are rendered as href; anything else is dropped.
    adilet_url = act.adilet_url if act.adilet_url and act.adilet_url.startswith(("https://", "http://")) else None
    return LegalActItem(
        id=act.id,
        title=title,
        title_lang=title_lang,
        number=act.number,
        date=act.date,
        issuer=pick(act.issuer, lang)[0],
        status=act.status,
        actualized_at=act.actualized_at,
        adilet_url=adilet_url,
        file=act_file,
    )


def _search_text(act: LegalAct) -> str:
    parts = [*(act.title or {}).values(), *(act.issuer or {}).values(), act.number or ""]
    return " ".join(parts).casefold()


def list_acts(session: Session, params: LegalActParams) -> LegalActsResponse:
    needle = params.q.strip().casefold()
    items = []
    for act, file in repo.published_acts(session):
        if params.status is not None and act.status != params.status:
            continue
        if needle and needle not in _search_text(act):
            continue
        items.append(_item(act, file, params.lang))
    return LegalActsResponse(total=len(items), items=items)


def get_compliance(session: Session, lang: str) -> CompliancePage:
    page = repo.published_page(session, "compliance")
    if page is None:
        raise NotFound()
    title, title_lang = pick(page.title, lang)
    body, body_lang = pick(page.body, lang)
    setting = repo.site_setting(session, "compliance")
    officer = setting.get("officer") if isinstance(setting, dict) else None
    documents = [
        _item(act, file, lang) for act, file in repo.published_acts(session, slug_prefix=COMPLIANCE_SLUG_PREFIX)
    ]
    return CompliancePage(
        title=title,
        title_lang=title_lang,
        body=body,
        body_lang=body_lang,
        officer=officer if isinstance(officer, str) else None,
        documents=documents,
    )
