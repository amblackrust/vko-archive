"""One command: `cd backend && .venv/bin/python -m seed [--refresh] [--info-only|--demo-only]`.

Idempotent: a repeated run creates nothing new. Existing rows are not overwritten
(so admin edits survive) unless --refresh is given."""

import argparse
import sys

from app.config import get_settings
from app.db import get_sessionmaker
from seed.runner import run


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m seed")
    parser.add_argument("--refresh", action="store_true", help="overwrite existing seeded rows")
    parser.add_argument("--info-only", action="store_true", help="only content from info/")
    parser.add_argument("--demo-only", action="store_true", help="only the demo catalog")
    args = parser.parse_args()

    with get_sessionmaker()() as session:
        report = run(
            session,
            get_settings().storage_dir,
            refresh=args.refresh,
            info=not args.demo_only,
            demo=not args.info_only,
        )
        session.commit()

    for entity in sorted(set(report.created) | set(report.existing)):
        print(f"{entity}: +{report.created.get(entity, 0)} new, {report.existing.get(entity, 0)} existing")
    for warning in report.warnings:
        print(f"warning: {warning}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
