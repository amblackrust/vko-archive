from pathlib import Path

from sqlalchemy.orm import Session

from seed.common import Report
from seed.demo_catalog import seed_demo_catalog
from seed.info_content import seed_info


def run(session: Session, storage_dir: Path, *, refresh: bool = False, info: bool = True, demo: bool = True) -> Report:
    """Seed everything inside the caller's transaction (the caller commits)."""
    report = Report()
    if info:
        seed_info(session, report, storage_dir, refresh)
    if demo:
        seed_demo_catalog(session, report, storage_dir, refresh)
    session.flush()
    return report
