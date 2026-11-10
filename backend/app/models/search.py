import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import EMBEDDING_DIM, Base, TimestampMixin, UUIDPkMixin


class Synonym(UUIDPkMixin, TimestampMixin, Base):
    """A group of equivalent terms/toponyms (Усть-Каменогорск = Өскемен = Ust-Kamenogorsk)."""

    __tablename__ = "synonyms"
    __table_args__ = (Index("ix_synonyms_terms", "terms", postgresql_using="gin"),)

    terms: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class SearchLog(Base):
    """Search queries without personal data (no user id, no IP)."""

    __tablename__ = "search_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    lang: Mapped[str | None] = mapped_column(String(8))
    source: Mapped[str | None] = mapped_column(String(32))  # search / catalog / ai
    results_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    zero_result: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false", index=True)
    clicked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")


class SearchEntry(UUIDPkMixin, Base):
    """Unified hybrid-search index row (FTS + trigram + vector) for any public object.

    Only allowed content is written here (documents with description_status=public,
    published pages/news/...); closed files' text/OCR is never indexed. Long texts
    (e.g. OCR of open files for RAG) are split into chunks by `chunk_no`.
    """

    __tablename__ = "search_entries"
    __table_args__ = (
        UniqueConstraint("object_type", "object_id", "lang", "chunk_no"),
        Index("ix_search_entries_tsv", "tsv", postgresql_using="gin"),
        Index(
            "ix_search_entries_title_trgm",
            "title",
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        ),
        Index(
            "ix_search_entries_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    object_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    object_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    lang: Mapped[str] = mapped_column(String(8), nullable=False)
    chunk_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    title: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    # Filled by the indexer with to_tsvector('simple', ...): Postgres has no Kazakh stemmer.
    tsv: Mapped[str | None] = mapped_column(TSVECTOR)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    embedding_model: Mapped[str | None] = mapped_column(String(64))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
