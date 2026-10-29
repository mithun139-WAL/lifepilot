"""
ai/embeddings.py

NVIDIA NIM embedding client for RAG and semantic search.

WHAT ARE EMBEDDINGS (the mental model):
An embedding is a list of floating-point numbers (a vector) that represents
the "meaning" of a piece of text in a high-dimensional space.

The key property: semantically similar texts produce similar vectors.
"I need help with Python" and "Can you assist me with Python code?" will
produce vectors that are close together (high cosine similarity).
"The weather is nice today" will produce a vector that is far from both.

This is what powers the RAG system:
1. When a user uploads a document, we split it into chunks
2. Each chunk is embedded → stored as a vector in pgvector
3. When the user sends a chat message, we embed the message
4. We find the K most similar vectors in the DB (vector search)
5. We inject those chunks as context into the LLM prompt

WHY nvidia/nv-embedqa-e5-v5:
- Outputs exactly 1024 dimensions → perfect match for your existing vector(1024) column
- No migration needed — drop-in replacement for whatever you used before
- NVIDIA's E5 variant is fine-tuned for question-answering retrieval tasks
- outperforms generic text-embedding models on QA benchmarks
- Available on NIM — same API key, same client

WHAT INPUT_TYPE MEANS:
NIM embedding models support typed input to improve retrieval quality:
- "query"    → for embedding search queries (user messages)
- "passage"  → for embedding documents being stored

This is asymmetric embedding: the model learns that a query vector should
be "attracted to" its relevant passage vectors even if the wording differs.
Without input_type, you'd use the same representation for both — lower recall.

DIMENSION NOTE:
If you ever switch to a different model with different dimensions, you'll need:
1. Drop and recreate the pgvector column with the new dimension
2. Re-embed all existing KnowledgeChunk records
3. Update EMBEDDING_DIMENSIONS in config

This is why we keep dimensions in config — it's a migration-critical value.
"""

from __future__ import annotations

import asyncio
from typing import Literal

from openai import AsyncOpenAI

from core.config import settings


# Module-level client — same singleton pattern as llm.py
_embedding_client = AsyncOpenAI(
    api_key=settings.nim_api_key_str,
    base_url=settings.NIM_BASE_URL,
)


async def embed_query(text: str) -> list[float]:
    """
    Embed a single search query (e.g., a user's chat message).
    
    Use input_type="query" for the asymmetric embedding benefit.
    
    Returns:
        List of 1024 floats representing the query in embedding space.
    
    Usage:
        # Before a RAG retrieval
        query_vector = await embed_query("How do I improve my Python skills?")
        chunks = await repo.similarity_search(query_vector, top_k=5)
    """
    text = text.strip()
    if not text:
        raise ValueError("Cannot embed empty text")

    response = await _embedding_client.embeddings.create(
        model=settings.NIM_EMBEDDING_MODEL,
        input=text,
        encoding_format="float",
        extra_body={"input_type": "query", "truncate": "END"},
    )
    return response.data[0].embedding


async def embed_passage(text: str) -> list[float]:
    """
    Embed a document passage for storage in the knowledge base.
    
    Use input_type="passage" when embedding chunks being stored in pgvector.
    The model optimises the vector for being retrieved by a query.
    
    Usage:
        # During knowledge ingestion
        for chunk in chunks:
            vector = await embed_passage(chunk.content)
            await repo.store_chunk(chunk, vector)
    """
    text = text.strip()
    if not text:
        raise ValueError("Cannot embed empty text")

    response = await _embedding_client.embeddings.create(
        model=settings.NIM_EMBEDDING_MODEL,
        input=text,
        encoding_format="float",
        extra_body={"input_type": "passage", "truncate": "END"},
    )
    return response.data[0].embedding


async def embed_passages_batch(
    texts: list[str],
    *,
    batch_size: int = 32,
) -> list[list[float]]:
    """
    Embed multiple passages in batches.
    
    WHY BATCHING:
    NIM accepts multiple inputs per API call (up to 96 for this model).
    Batching reduces:
    - Number of HTTP round-trips (major latency savings)
    - Number of API calls (cost savings)
    
    For ingesting a 50-page PDF (say, 200 chunks), batching at 32:
    - Without batching: 200 API calls, ~200 * 100ms = 20 seconds
    - With batching of 32: 7 API calls, ~7 * 150ms = ~1 second
    
    WHY NOT ONE GIANT BATCH:
    NIM has a max input limit per request. 32 is a safe default.
    If you hit errors on large documents, reduce batch_size.
    
    WHY batch_size=32 over asyncio.gather():
    Both approaches parallelise the work. The difference:
    - asyncio.gather() fires all requests simultaneously → can hit rate limits
    - Sequential batching respects NIM's rate limits and is more predictable
    
    For production-scale ingestion (thousands of documents), use a background
    worker queue (Celery/ARQ) instead of this inline function.
    
    Returns:
        List of embedding vectors, in the same order as input texts.
    """
    if not texts:
        return []

    # Filter out empty strings, track original indices for ordering
    indexed = [(i, t.strip()) for i, t in enumerate(texts) if t.strip()]
    if not indexed:
        return [[] for _ in texts]

    all_embeddings: dict[int, list[float]] = {}

    for batch_start in range(0, len(indexed), batch_size):
        batch = indexed[batch_start : batch_start + batch_size]
        indices, batch_texts = zip(*batch)

        response = await _embedding_client.embeddings.create(
            model=settings.NIM_EMBEDDING_MODEL,
            input=list(batch_texts),
            encoding_format="float",
            extra_body={"input_type": "passage", "truncate": "END"},
        )

        # Map results back to original indices
        for emb_obj, orig_idx in zip(response.data, indices):
            all_embeddings[orig_idx] = emb_obj.embedding

    # Return in original order; empty list for any empty-string inputs
    return [all_embeddings.get(i, []) for i in range(len(texts))]


async def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Compute cosine similarity between two vectors.
    
    Returns a value between -1 and 1:
    - 1.0 = identical direction (same meaning)
    - 0.0 = orthogonal (unrelated)
    - -1.0 = opposite direction (rare in practice for natural language)
    
    Used for: reranking retrieved chunks, deduplication, relevance scoring.
    
    In practice, pgvector's <=> operator (cosine distance) handles this
    at query time — this utility is for in-Python scoring when needed.
    """
    import math

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))

    if mag_a == 0 or mag_b == 0:
        return 0.0

    return dot / (mag_a * mag_b)
