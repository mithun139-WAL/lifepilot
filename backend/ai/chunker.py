"""
ai/chunker.py

Text chunking utilities for RAG ingestion.
Strategy: Fixed-size word chunking with overlap, paragraph-boundary-aware.

WHY CHUNKING:
LLMs have context windows. You can't feed a 50-page PDF directly.
Chunking splits the document into overlapping segments so:
1. Each chunk fits within the embedding model's input limit (~512 tokens)
2. Overlap ensures sentences at chunk boundaries aren't lost

THE STRATEGY (matches src/lib/chunker.ts exactly):
- Chunk size:  ~400 words (~512 tokens for the E5 model's max)
- Overlap:     ~50 words  (~64 tokens) — preserves continuity between chunks
- Paragraph-aware: inserts ¶ markers to reconstruct natural paragraph breaks

WHY PARAGRAPH-AWARE:
Splitting mid-sentence hurts retrieval quality. By inserting ¶ markers at
paragraph boundaries and restoring them as double newlines in the output,
we keep related sentences together within chunks.

WHY DATACLASS INSTEAD OF PYDANTIC:
TextChunk is never serialised to JSON — it only lives inside the ingestion
pipeline. A dataclass has zero overhead vs Pydantic's validation.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

CHUNK_WORD_SIZE = 400
OVERLAP_WORDS = 50


@dataclass
class TextChunk:
    """A single chunk of text with its position in the source document."""

    content: str
    index: int


def chunk_text(text: str) -> list[TextChunk]:
    """
    Split text into overlapping chunks by word count.
    Preserves paragraph boundaries where possible.

    Port of src/lib/chunker.ts::chunkText() — logic is 1-to-1.

    Args:
        text: Raw document text (any encoding, any length).

    Returns:
        Ordered list of TextChunk objects, ready for embedding.

    Algorithm:
        1. Normalise CRLF to LF, collapse 3+ blank lines to 2.
        2. Split into paragraphs on double-newline boundaries.
        3. Flatten paragraphs into a word list, inserting ¶ markers
           between paragraphs to track where boundaries were.
        4. Slide a window of CHUNK_WORD_SIZE over the word list,
           advancing by (CHUNK_WORD_SIZE - OVERLAP_WORDS) each step.
        5. Inside each window, restore ¶ markers as \\n\\n.
    """
    # Step 1: Normalise whitespace
    normalized = text.replace("\r\n", "\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()

    # Step 2: Split on paragraph boundaries
    paragraphs = re.split(r"\n\n+", normalized)

    # Step 3: Flatten to word list with ¶ paragraph markers
    words: list[str] = []
    for para in paragraphs:
        para_words = [w for w in re.split(r"\s+", para) if w]
        words.extend(para_words)
        words.append("¶")  # paragraph boundary marker

    # Step 4 & 5: Sliding window with overlap
    chunks: list[TextChunk] = []
    start = 0
    chunk_index = 0

    while start < len(words):
        end = min(start + CHUNK_WORD_SIZE, len(words))
        chunk_words = words[start:end]

        # Restore paragraph markers as double newline, strip trailing marker
        content = " ".join(chunk_words)
        content = re.sub(r" ¶ ", "\n\n", content)
        content = content.replace("¶", "").strip()

        if content:
            chunks.append(TextChunk(content=content, index=chunk_index))
            chunk_index += 1

        # Advance with overlap
        start += CHUNK_WORD_SIZE - OVERLAP_WORDS

    return chunks


def estimate_tokens(text: str) -> int:
    """
    Estimate token count (rough: 1 token ≈ 0.75 words for English).

    This heuristic mirrors src/lib/chunker.ts::estimateTokens().
    Actual token count depends on the model's BPE vocabulary — use this
    only for rough capacity planning, not hard limits.

    Formula: tokens ≈ ceil(word_count / 0.75)
    Rationale: English words average ~4-5 chars; BPE tokens average ~3-4 chars.
    So 1 word ≈ 1.33 tokens → tokens = words × 1.33 ≈ words / 0.75.
    """
    word_count = len(text.split())
    return math.ceil(word_count / 0.75)
