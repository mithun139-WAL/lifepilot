"""
features/knowledge/schemas.py

Pydantic schemas and plain dataclasses for the Knowledge feature.

SCHEMA DESIGN DECISIONS:

KnowledgeSourceResponse:
    The frontend shows a *sources list* (one row per document/URL), not individual
    chunks. We GROUP BY source in the repository and return aggregated rows.
    chunk_count lets the UI show "15 chunks" next to each source entry.

KnowledgeChunkResponse:
    Full chunk record — used when a specific chunk's content must be returned.
    Currently not exposed by any router endpoint but used by the chat feature
    internally (and available for future "view chunk" endpoints).

KnowledgeIngestResponse:
    Returned by POST /knowledge/ingest. Tells the frontend how many chunks
    were saved so the user sees progress ("Ingested 42 chunks from 'ml_book.pdf'").

RetrievedChunk (dataclass, NOT Pydantic):
    Passed between the repository's similarity_search() and the service layer.
    Also passed from KnowledgeService.search() to ChatService for RAG context.
    It's a dataclass because:
    - It's never serialised directly to JSON (the router doesn't return it raw)
    - It carries a `similarity` score that isn't a stored column
    - Zero validation overhead needed for an internal transfer object
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel


class KnowledgeSourceResponse(BaseModel):
    """Aggregated view of one knowledge source (document or URL)."""

    source: str
    source_type: str
    chunk_count: int

    model_config = {"from_attributes": True}


class KnowledgeChunkResponse(BaseModel):
    """Full chunk record. Used internally; available for future detail endpoints."""

    id: str
    source: str
    source_type: str
    source_url: str | None
    chunk_index: int
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeIngestResponse(BaseModel):
    """Returned by POST /knowledge/ingest on success."""

    source: str
    source_type: str
    chunks_saved: int
    message: str


@dataclass
class RetrievedChunk:
    """
    A chunk returned from similarity search, augmented with its relevance score.

    WHY DATACLASS:
    This object flows from repository → service → chat service.
    It is never returned as a JSON response directly — the chat service
    passes it to build_context_block() which inlines it into an LLM prompt.

    The `similarity` field (1 - cosine_distance) is a computed value from
    the pgvector query — it has no corresponding column in the ORM model.
    Storing it here avoids a second query or re-computation.
    """

    id: str
    content: str
    source: str
    source_type: str
    chunk_index: int
    similarity: float
