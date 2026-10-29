"""
features/knowledge/models.py

SQLAlchemy ORM model for the KnowledgeChunk table.

TABLE ORIGIN:
The "KnowledgeChunk" table is defined in prisma/schema.prisma.
The `embedding vector(1024)` column is NOT in the Prisma schema — it was
added separately via prisma/add_pgvector.sql:
    ALTER TABLE "KnowledgeChunk" ADD COLUMN embedding vector(1024);

ALEMBIC + PGVECTOR NOTE:
By declaring `embedding` with `mapped_column(Vector(1024), nullable=True)`:
- SQLAlchemy knows the column exists and can read/write it
- Alembic compares the model against the live DB and sees the column exists →
  no migration is generated to add or drop it
- If Alembic still tries to recreate it, add it to the `exclude_tables`
  render_item hook in migrations/env.py

NULLABLE EMBEDDING:
The column is nullable because chunks are inserted and then the embedding is
set in the same transaction — if the transaction is interrupted, the chunk
row exists without an embedding. The similarity_search query filters out
NULL embeddings with `WHERE embedding IS NOT NULL`.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.auth.models import User


class KnowledgeChunk(Base):
    __tablename__ = "KnowledgeChunk"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String,
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # source: filename (e.g. "machine_learning.pdf") or URL hostname (e.g. "arxiv.org")
    # Used as the display name and grouping key in the sources list
    source: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # sourceUrl: original URL for "url" type chunks — null for files and pasted text
    source_url: Mapped[str | None] = mapped_column("sourceUrl", String, nullable=True)

    # sourceType: "pdf" | "text" | "url" — determines citation formatting
    source_type: Mapped[str] = mapped_column("sourceType", String, nullable=False)

    # chunkIndex: 0-based position in the original document
    # Used for citation display: "chunk 3 of machine_learning.pdf"
    chunk_index: Mapped[int] = mapped_column("chunkIndex", Integer, nullable=False)

    # content: the raw chunk text stored for display and LLM injection
    content: Mapped[str] = mapped_column(String, nullable=False)

    # embedding: 1024-dim pgvector column — set at ingest time, used for similarity search
    # nullable=True because we write the row first, then set embedding in the same tx
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1024), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # back_populates="knowledge_chunks" matches the relationship on User in auth/models.py
    user: Mapped["User"] = relationship(
        "User",
        back_populates="knowledge_chunks",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<KnowledgeChunk id={self.id!r} source={self.source!r} "
            f"chunk_index={self.chunk_index!r}>"
        )
