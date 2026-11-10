"""Public branches contracts (T5.9). Only published branches; texts are picked per language."""

from typing import Literal

from pydantic import BaseModel

Lang = Literal["kk", "ru", "en"]


class BranchItem(BaseModel):
    slug: str
    href: str  # site path without the locale prefix, built by the server
    name: str
    name_lang: str  # language of the texts actually returned (fallback when `lang` is missing)
    type: str
    address: str
    phone: str | None
    email: str | None
    director: str
    hours: str
    description: str
    funds_summary: str
    # Null when the branch is hidden from the map (show_on_map=false) or has no coordinates.
    lat: float | None
    lng: float | None
    coords_verified: bool
    show_on_map: bool


class BranchesResponse(BaseModel):
    items: list[BranchItem]
