"""SearchLog (T3.8): what visitors looked for and whether anything was found.
No user id and no IP are stored. A logging failure never breaks the search itself."""

import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models import SearchLog

logger = logging.getLogger(__name__)

MAX_QUERY_CHARS = 500


def log_search(session: Session, *, query: str, lang: str, source: str, results_count: int) -> None:
    session.add(
        SearchLog(
            query=" ".join(query.split())[:MAX_QUERY_CHARS],
            lang=lang,
            source=source,
            results_count=results_count,
            zero_result=results_count == 0,
        )
    )
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        logger.warning("search log write failed", exc_info=True)
