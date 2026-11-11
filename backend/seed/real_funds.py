"""Real fund lists of the archive (info/e-arhiv/, as of 2018) from seed/data/*.json.

The JSON is made once by `seed/tools/convert_real_funds.py`. Fully secret funds are left out
there, so they never reach the database; partially restricted ones come as a public description
with `restricted = "partial"`."""

import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Branch, Fund, FundType, Newspaper, WorkflowStatus
from seed.common import Report, bulk_upsert, i18n, translation_status

DATA_DIR = Path(__file__).parent / "data"


def _load(name: str) -> dict:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _fund_values(fund: dict, source: str) -> dict:
    return {
        "number": fund["number"], "slug": f"fund-{fund['number'].lower()}", "type": FundType(fund["type"]),
        "title": i18n(ru=fund["title"]), "former_names": fund["names"],
        # The only note of the source: where the fund was handed over to.
        "annotation": i18n(ru=fund["note"]),
        "dates_from": fund["dates_from"], "dates_to": fund["dates_to"], "units_count": fund["units_count"],
        "category": fund["category"], "ownership": fund["ownership"], "restricted": fund["restricted"],
        "first_received": date.fromisoformat(fund["first_received"]) if fund["first_received"] else None,
        "source": source, "is_demo": False, "workflow_status": WorkflowStatus.PUBLISHED,
        "translation_status": translation_status(ru="x"),
    }  # fmt: skip


def seed_real_funds(session: Session, report: Report, refresh: bool) -> None:
    head = session.scalar(select(Branch).where(Branch.slug == "branch-head"))
    assert head is not None, "seed the info content first (branch-head is missing)"
    funds = []
    for name in ("funds.json", "party_funds.json"):
        data = _load(name)
        source = f"e-arhiv.vko.gov.kz: {data['meta']['source']}"
        funds += [_fund_values(fund, source) for fund in data["funds"]]
    bulk_upsert(session, report, Fund, ("number",), funds, refresh, branch_id=head.id)
    bulk_upsert(session, report, Newspaper, ("title", "publisher"), _load("newspapers.json")["newspapers"], refresh)
