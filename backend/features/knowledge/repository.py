"""
features/knowledge/repository.py

Database access layer for KnowledgeChunk operations.

WHAT LIVES HERE:
- Raw SQL and ORM queries for KnowledgeChunk
- No business logic — just DB reads/writes
- All methods async

WHAT DOES NOT LIVE HERE:
- Chunking, embedding, PDF parsing — those are in the service / ai/ layers
- Ownership validation — the service layer owns that
- HTTP calls (Jina Reader) — service layer

KEY OPERATIONS:
1. get_sources_by_user  — GROUP BY for the sources list view
2. create_chunk         — INSERT one chunk (called in a loop during ingestion)
3. delete_by_source     — bulk DELETE for a source
4. similarity_search    — pgvector cosine similarity search (core of RAG)

WHY RAW SQL FOR SIMILARITY SEARCH:
The pgvector <=> operator works in SQLAlchemy via the Vector type's
.cosine_distance() method. However, extracting the computed similarity
score (1 - cosine_distance) as a named column alongside the row data is
cleaner with raw text(). Raw SQL here is explicit and well-understood —
it's the same query pattern used in src/lib/rag.ts.

VECTOR FORMAT:
pgvector expects the string '[0.1,0.2,...]' cast to ::vector.
We build this from a Python list[float] — safe because all values are floats,
no user-controlled strings are interpolated.
"""

from __future__ import annotations

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from features.knowledge.models import KnowledgeChunk
from features.knowledge.schemas import RetrievedChunk


class KnowledgeRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Sources (grouped view)
    # ------------------------------------------------------------------

    async def get_sources_by_user(self, user_id: str) -> list[dict]:
        """
        Return one aggregated row per distinct source for a user.

        SQL equivalent:
            SELECT source, "sourceType", COUNT(id) AS chunk_count
            FROM "KnowledgeChunk"
            WHERE "userId" = :user_id
            GROUP BY source, "sourceType"
            ORDER BY source
        """
        stmt = (
            select(
                KnowledgeChunk.source,
                KnowledgeChunk.source_type,
                func.count(KnowledgeChunk.id).label("chunk_count"),
            )
            .where(KnowledgeChunk.user_id == user_id)
            .group_by(KnowledgeChunk.source, KnowledgeChunk.source_type)
            .order_by(KnowledgeChunk.source)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return [
            {
                "source": r.source,
                "source_type": r.source_type,
                "chunk_count": r.chunk_count,
            }
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Chunk CRUD
    # ------------------------------------------------------------------

    async def create_chunk(
        self,
        *,
        user_id: str,
        source: str,
        source_url: str | None,
        source_type: str,
        chunk_index: int,
        content: str,
        embedding: list[float],
    ) -> KnowledgeChunk:
        """
        Insert one chunk with its pre-computed embedding vector.

        WHY ONE-BY-ONE INSERTS (not bulk):
        For typical document ingestion (10–200 chunks per document), individual
        flush+refresh calls are fast enough and give us back the generated id.
        For large-scale ingestion (thousands of chunks), switch to
        `session.execute(insert(KnowledgeChunk).values(...))` executemany.
        """
        chunk = KnowledgeChunk(
            user_id=user_id,
            source=source,
            source_url=source_url,
            source_type=source_type,
            chunk_index=chunk_index,
            content=content,
            embedding=embedding,
        )
        self.db.add(chunk)
        await self.db.flush()
        await self.db.refresh(chunk)
        return chunk

    async def delete_by_source(self, user_id: str, source: str) -> int:
        """
        Delete all chunks for a given (user_id, source) pair.

        Returns the number of rows deleted so the service can report it.
        Scoped to user_id to prevent cross-user deletions.
        """
        stmt = delete(KnowledgeChunk).where(
            KnowledgeChunk.user_id == user_id,
            KnowledgeChunk.source == source,
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Similarity search
    # ------------------------------------------------------------------

    async def similarity_search(
        self,
        user_id: str,
        query_vector: list[float],
        *,
        top_k: int = 5,
        min_similarity: float = 0.2,
    ) -> list[RetrievedChunk]:
        """
        Find the top-K chunks most relevant to query_vector using pgvector.

        COSINE SIMILARITY vs COSINE DISTANCE:
            pgvector's <=> operator = cosine DISTANCE (0 = identical, 2 = opposite)
            We want cosine SIMILARITY (1 = identical, -1 = opposite)
            Conversion: similarity = 1 - cosine_distance

        MIN_SIMILARITY:
            0.2 is a practical lower bound. Below 0.2 the chunk almost never
            adds useful context. Most strong matches score 0.4–0.9.

        NULL GUARD:
            The WHERE clause skips chunks where embedding IS NULL.
            These are orphaned rows from interrupted ingestion transactions.
            They should be rare in practice but we handle them defensively.

        VECTOR FORMAT:
            '[0.1,0.2,...]' CAST as ::vector — built from list[float].
            Safe to interpolate because all values are Python floats.
        """
        vec_str = "[" + ",".join(str(v) for v in query_vector) + "]"

        stmt = text("""
            SELECT
                id,
                content,
                source,
                "sourceType"  AS source_type,
                "chunkIndex"  AS chunk_index,
                1 - (embedding <=> CAST(:query_vec AS vector)) AS similarity
            FROM "KnowledgeChunk"
            WHERE "userId" = :user_id
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> CAST(:query_vec AS vector)) > :min_sim
            ORDER BY embedding <=> CAST(:query_vec AS vector)
            LIMIT :top_k
        """)

        result = await self.db.execute(
            stmt,
            {
                "query_vec": vec_str,
                "user_id": user_id,
                "min_sim": min_similarity,
                "top_k": top_k,
            },
        )
        rows = result.mappings().all()

        return [
            RetrievedChunk(
                id=row["id"],
                content=row["content"],
                source=row["source"],
                source_type=row["source_type"],
                chunk_index=row["chunk_index"],
                similarity=float(row["similarity"]),
            )
            for row in rows
        ]
