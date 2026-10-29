"""
features/knowledge/service.py

Business logic for the Knowledge Base feature.

RESPONSIBILITIES:
1. ingest_document  — full pipeline: fetch text → chunk → embed → store
2. search           — embed a query → call repository similarity search
3. get_sources      — list all sources for a user (delegates to repo)
4. delete_source    — delete all chunks for a source
5. build_context_block  — static utility: format chunks for LLM injection
6. parse_citations  — static utility: extract [[CITATIONS]] blocks from AI output

WHY build_context_block AND parse_citations LIVE HERE:
In src/lib/rag.ts these are standalone exported functions. In Python we place
them as static methods on KnowledgeService because:
- They are logically part of the RAG pipeline
- The Chat service imports KnowledgeService and calls them directly
- Static methods don't need a DB session — they're pure functions
- Keeping them here avoids creating a separate rag.py utilities module

PDF PARSING — pypdf vs pdf2json:
The Next.js version uses pdf2json (Node.js). Python's equivalent is pypdf:
- Pure Python, zero native dependencies
- Handles text-layer PDFs (the majority of technical/educational PDFs)
- Available in pyproject.toml
LIMITATION: pypdf does NOT OCR scanned images.
For scanned PDFs in production, swap _parse_pdf() with pdfminer.six or
Google Cloud Document AI.

URL FETCHING — Jina Reader:
Jina Reader (r.jina.ai/{url}) is a free service that converts any URL into
clean markdown, stripping navigation, ads, and boilerplate. No API key needed.
We cap the response at 50,000 characters (matches the TS version) to prevent
very large pages from creating hundreds of low-quality chunks.
"""

from __future__ import annotations

import json
import re
from io import BytesIO

import httpx

from ai.chunker import chunk_text
from ai.embeddings import embed_passages_batch, embed_query
from features.knowledge.repository import KnowledgeRepository
from features.knowledge.schemas import (
    KnowledgeIngestResponse,
    KnowledgeSourceResponse,
    RetrievedChunk,
)
from sqlalchemy.ext.asyncio import AsyncSession

# Jina Reader: free URL-to-markdown service, no API key needed
_JINA_READER_BASE = "https://r.jina.ai/"

# Cap URL content at 50k chars to avoid runaway ingestion (matches TS version)
_MAX_URL_CHARS = 50_000

# Minimum text length — reject empty/near-empty documents early
_MIN_TEXT_LENGTH = 50

# Batch size for embedding API calls (conservative, matches TS version BATCH_SIZE=20)
_EMBED_BATCH_SIZE = 20


class KnowledgeService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._repo = KnowledgeRepository(db)

    # ------------------------------------------------------------------
    # Sources
    # ------------------------------------------------------------------

    async def get_sources(self, user_id: str) -> list[KnowledgeSourceResponse]:
        """Return all knowledge sources for a user (one row per source)."""
        rows = await self._repo.get_sources_by_user(user_id)
        return [KnowledgeSourceResponse(**r) for r in rows]

    async def delete_source(self, user_id: str, source: str) -> int:
        """
        Delete all chunks for a named source.

        The `source` value is the display name stored in the DB:
        - For files: the filename  (e.g. "machine_learning.pdf")
        - For URLs:  the hostname  (e.g. "arxiv.org") or source_name override
        - For text:  "Pasted text" or the source_name override

        Returns the number of rows deleted.
        """
        return await self._repo.delete_by_source(user_id, source)

    # ------------------------------------------------------------------
    # Ingestion pipeline
    # ------------------------------------------------------------------

    async def ingest_document(
        self,
        *,
        user_id: str,
        url: str | None = None,
        text: str | None = None,
        file_bytes: bytes | None = None,
        filename: str | None = None,
        source_name: str | None = None,
    ) -> KnowledgeIngestResponse:
        """
        Run the full ingestion pipeline for one document.

        INPUT PRIORITY: file > url > text
        (Mirrors the Next.js ingestDocument() priority order.)

        PIPELINE STEPS:
        1. Determine source metadata (source, source_url, source_type)
        2. Extract raw text from the input
        3. Chunk the text (400-word chunks with 50-word overlap)
        4. Embed all chunks in batches via NIM
        5. Persist each chunk + embedding to the DB

        Raises ValueError if the document is empty or too short.
        """
        raw_text = ""
        source = source_name or ""
        source_url: str | None = None
        source_type = "text"

        # Step 1 + 2: Determine source metadata and extract text
        if file_bytes and filename:
            source = source_name or filename
            lower_name = filename.lower()
            if lower_name.endswith(".pdf"):
                source_type = "pdf"
                raw_text = await self._parse_pdf(file_bytes)
            else:
                source_type = "text"
                raw_text = file_bytes.decode("utf-8", errors="replace")

        elif url:
            source_type = "url"
            source_url = url
            source = source_name or _extract_hostname(url)
            raw_text = await self._fetch_url(url)

        elif text:
            source_type = "text"
            source = source_name or "Pasted text"
            raw_text = text

        # Guard: reject empty or near-empty documents
        if not raw_text or len(raw_text.strip()) < _MIN_TEXT_LENGTH:
            raise ValueError("Document is empty or too short to process.")

        # Step 3: Chunk
        chunks = chunk_text(raw_text)
        if not chunks:
            raise ValueError("No content extracted from document.")

        # Step 4: Embed in batches
        # embed_passages_batch uses input_type="passage" for asymmetric retrieval
        contents = [c.content for c in chunks]
        embeddings = await embed_passages_batch(contents, batch_size=_EMBED_BATCH_SIZE)

        # Step 5: Persist
        # zip() is safe here: embed_passages_batch preserves order and length
        saved = 0
        for chunk, embedding in zip(chunks, embeddings):
            if not embedding:
                # Skip chunks where embedding failed (shouldn't happen in practice)
                continue
            await self._repo.create_chunk(
                user_id=user_id,
                source=source,
                source_url=source_url,
                source_type=source_type,
                chunk_index=chunk.index,
                content=chunk.content,
                embedding=embedding,
            )
            saved += 1

        return KnowledgeIngestResponse(
            source=source,
            source_type=source_type,
            chunks_saved=saved,
            message=f"Ingested {saved} chunks from '{source}'.",
        )

    # ------------------------------------------------------------------
    # RAG search
    # ------------------------------------------------------------------

    async def search(
        self,
        user_id: str,
        query: str,
        *,
        top_k: int = 5,
        min_similarity: float = 0.2,
    ) -> list[RetrievedChunk]:
        """
        Embed a query and retrieve the most relevant chunks from the user's KB.

        Called by:
        - ChatService: to build context for each AI coach message
        - PlannerService: to auto-seed relevant resources during plan generation

        WHY embed_query() NOT embed_passage():
        The query and stored passages use different embedding inputs
        (asymmetric retrieval). embed_query() uses input_type="query" which
        is optimised to retrieve relevant passages, not to match passages exactly.
        """
        query_vector = await embed_query(query)
        return await self._repo.similarity_search(
            user_id,
            query_vector,
            top_k=top_k,
            min_similarity=min_similarity,
        )

    # ------------------------------------------------------------------
    # RAG utilities (static — no DB needed)
    # ------------------------------------------------------------------

    @staticmethod
    def build_context_block(chunks: list[RetrievedChunk]) -> str:
        """
        Format retrieved chunks into a context block for LLM injection.

        Port of src/lib/rag.ts::buildContextBlock() — logic is 1-to-1.

        The output is injected into the LLM's system or user prompt so the
        model can cite the user's own uploaded documents in its response.

        For PDF chunks, we include the chunk number in the label because the
        same PDF source can have many chunks — the chunk number helps the model
        and user locate the reference in the original document.

        Returns empty string if no chunks — callers must check before injecting.
        """
        if not chunks:
            return ""

        parts: list[str] = []
        for i, chunk in enumerate(chunks):
            suffix = (
                f" (chunk {chunk.chunk_index + 1})"
                if chunk.source_type == "pdf"
                else ""
            )
            label = f"[Source {i + 1}: {chunk.source}{suffix}]"
            parts.append(f"{label}\n{chunk.content}")

        joined = "\n\n---\n\n".join(parts)
        return (
            "\n\n## Retrieved Knowledge Base Context\n"
            "The following excerpts from the user's uploaded documents are relevant "
            "to this query. Use them to ground your answer. Always cite the source.\n\n"
            + joined
        )

    @staticmethod
    def parse_citations(content: str) -> dict:
        """
        Extract and parse a [[CITATIONS]]...[[/CITATIONS]] block from AI output.

        Port of src/lib/rag.ts::parseCitations() — logic is 1-to-1.

        THE CITATION CONTRACT:
        When RAG context is injected into the prompt, the AI coach system prompt
        instructs the model to append a JSON citation block in this format:

            [[CITATIONS]]
            {
              "sources": [{"source": "arxiv.org", "snippet": "..."}],
              "is_grounded": true,
              "confidence": "high"
            }
            [[/CITATIONS]]

        This method strips that block from the visible response and returns it
        as structured data for the frontend to render citation badges.

        Returns:
            dict with keys:
              - clean_content: str   (response text without the citation block)
              - citations: list      (list of {source, snippet} dicts)
              - is_grounded: bool    (did the model use the KB context?)
              - confidence: str      ("high" | "medium" | "low" | "none")
        """
        match = re.search(
            r"\[\[CITATIONS\]\]([\s\S]*?)\[\[\/CITATIONS\]\]", content
        )
        if not match:
            return {
                "clean_content": content,
                "citations": [],
                "is_grounded": False,
                "confidence": "none",
            }

        try:
            parsed = json.loads(match.group(1).strip())
            clean_content = re.sub(
                r"\[\[CITATIONS\]\][\s\S]*?\[\[\/CITATIONS\]\]", "", content
            ).strip()
            return {
                "clean_content": clean_content,
                "citations": parsed.get("sources", []),
                "is_grounded": parsed.get("is_grounded", False),
                "confidence": parsed.get("confidence", "low"),
            }
        except (json.JSONDecodeError, AttributeError):
            return {
                "clean_content": content,
                "citations": [],
                "is_grounded": False,
                "confidence": "none",
            }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _fetch_url(url: str) -> str:
        """
        Fetch a URL as clean markdown via Jina Reader (r.jina.ai).

        Jina Reader strips ads, nav, and boilerplate — the same technique
        used in src/lib/rag.ts::fetchUrlAsMarkdown().
        No API key needed; free service.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{_JINA_READER_BASE}{url}",
                headers={
                    "Accept": "text/markdown",
                    "X-Return-Format": "markdown",
                },
            )
            response.raise_for_status()
            # Cap at 50k chars — matches TS version's text.slice(0, 50000)
            return response.text[:_MAX_URL_CHARS]

    @staticmethod
    async def _parse_pdf(file_bytes: bytes) -> str:
        """
        Extract text from a PDF using pypdf.

        pypdf is the Python equivalent of pdf2json used in the Next.js version.
        It extracts the text layer — does NOT OCR scanned image PDFs.

        Page texts are joined with double newlines so the chunker sees them as
        paragraph breaks, keeping cross-page context within a single chunk where
        the content is continuous.
        """
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(file_bytes))
        pages: list[str] = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                pages.append(page_text)

        return "\n\n".join(pages)


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _extract_hostname(url: str) -> str:
    """Extract the hostname from a URL; fall back to the full URL on failure."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).hostname or url
    except Exception:
        return url
