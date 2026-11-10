from pathlib import Path

from sqlalchemy.orm import Session

from seed.common import Report
from seed.demo_catalog import seed_demo_catalog
from seed.exhibitions import seed_exhibitions
from seed.history_map import seed_history_map
from seed.info_content import seed_info
from seed.memory import seed_chronology, seed_collections, seed_persons
from seed.news_faq import seed_faq, seed_news


def run(session: Session, storage_dir: Path, *, refresh: bool = False, info: bool = True, demo: bool = True) -> Report:
    """Seed everything inside the caller's transaction (the caller commits)."""
    report = Report()
    if info:
        seed_info(session, report, storage_dir, refresh)
        # Persons and chronology are taken from the calendar that seed_info has just seeded.
        seed_persons(session, report, refresh)
        seed_chronology(session, report, refresh)
    if demo:
        seed_demo_catalog(session, report, storage_dir, refresh)
        seed_collections(session, report, refresh)
        seed_exhibitions(session, report, refresh)
        seed_news(session, report, refresh)
        seed_faq(session, report, refresh)
    seed_history_map(session, report, refresh, demo=demo)
    session.flush()
    return report
