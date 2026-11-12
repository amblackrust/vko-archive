from pathlib import Path

from sqlalchemy.orm import Session

from seed.common import Report
from seed.demo_catalog import seed_demo_catalog
from seed.exhibitions import seed_exhibitions
from seed.history_map import seed_history_map
from seed.info_content import seed_info
from seed.media import apply_covers, apply_document_images
from seed.memory import seed_chronology, seed_collections, seed_persons
from seed.news_faq import seed_faq, seed_news
from seed.scrub_synthetic import scrub
from seed.translations_data import load as load_translations


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
        apply_document_images(session, report, storage_dir)
        seed_collections(session, report, refresh)
        seed_exhibitions(session, report, refresh)
        seed_news(session, report, refresh)
        seed_faq(session, report, refresh)
    seed_history_map(session, report, refresh, demo=demo)
    session.flush()
    if demo:
        apply_covers(session, report, storage_dir)
    # The public site never calls the content fictional (docs/DECISIONS.md); the machine translations
    # shipped with the repo are keyed by the cleaned Russian text, so they are loaded after the scrub.
    scrub(session)
    load_translations(session)
    session.flush()
    return report
