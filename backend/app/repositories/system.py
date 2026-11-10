from sqlalchemy import text
from sqlalchemy.orm import Session


def ping(session: Session) -> None:
    session.execute(text("SELECT 1"))


def installed_extensions(session: Session) -> set[str]:
    rows = session.execute(text("SELECT extname FROM pg_extension"))
    return {row[0] for row in rows}
