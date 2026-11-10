"""Public branches (T5.9): published only; links are built here."""

from sqlalchemy.orm import Session

from app.models import Branch
from app.repositories import branches as repo
from app.schemas.branches import BranchesResponse, BranchItem
from app.services.catalog import pick
from app.services.errors import NotFound


def _item(branch: Branch, lang: str) -> BranchItem:
    name, name_lang = pick(branch.name, lang)
    on_map = branch.show_on_map and branch.lat is not None and branch.lng is not None
    return BranchItem(
        slug=branch.slug,
        href=f"/branches/{branch.slug}",
        name=name,
        name_lang=name_lang,
        type=branch.type.value,
        address=pick(branch.address, lang)[0],
        phone=branch.phone,
        email=branch.email,
        director=pick(branch.director, lang)[0],
        hours=pick(branch.hours, lang)[0],
        description=pick(branch.description, lang)[0],
        funds_summary=pick(branch.funds_summary, lang)[0],
        lat=float(branch.lat) if on_map else None,
        lng=float(branch.lng) if on_map else None,
        coords_verified=branch.coords_verified,
        show_on_map=on_map,
    )


def list_branches(session: Session, lang: str) -> BranchesResponse:
    return BranchesResponse(items=[_item(b, lang) for b in repo.list_published(session)])


def get_branch(session: Session, slug: str, lang: str) -> BranchItem:
    branch = repo.get_published(session, slug)
    if branch is None:
        raise NotFound("branch")
    return _item(branch, lang)
