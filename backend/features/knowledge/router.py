"""
features/knowledge/router.py

Knowledge Base API endpoints.

ROUTES:
  GET    /knowledge                      → list all sources for the current user
  DELETE /knowledge?source=<name>        → delete all chunks for a source
  POST   /knowledge/ingest               → ingest a URL, text, or file upload

ROUTE ORDER NOTE:
DELETE /knowledge must be declared before any path-param routes to avoid
FastAPI interpreting /knowledge?source=foo as a path parameter collision.
With query params this isn't strictly required, but keeping ordered is good style.

MULTIPART INGEST:
POST /knowledge/ingest accepts multipart/form-data:
  - url:         str (optional) — fetch and ingest a URL via Jina Reader
  - text:        str (optional) — ingest raw text directly
  - source_name: str (optional) — display name override for the source
  - file:        UploadFile (optional) — upload a PDF or .txt file

At least one of url, text, or file must be provided. If multiple are provided,
priority is: file > url > text (matches src/lib/knowledge.ts).

WHY FORM INSTEAD OF JSON FOR INGEST:
File uploads require multipart/form-data — you can't embed binary file content
in a JSON body. By accepting all ingest fields as Form() fields, the endpoint
handles files and text/URL ingestion with a single unified endpoint.
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status

from core.dependencies import DB, CurrentUser
from features.knowledge.schemas import KnowledgeIngestResponse, KnowledgeSourceResponse
from features.knowledge.service import KnowledgeService

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


@router.get(
    "",
    response_model=list[KnowledgeSourceResponse],
    summary="List knowledge base sources",
)
async def list_sources(
    current_user: CurrentUser,
    db: DB,
) -> list[KnowledgeSourceResponse]:
    """
    Return all knowledge sources for the current user (one row per document/URL).

    Each source shows: name, type (pdf/text/url), and how many chunks it has.
    Used by the Knowledge Base page to display the list of ingested documents.
    """
    service = KnowledgeService(db)
    return await service.get_sources(user_id=current_user.id)


@router.delete(
    "",
    status_code=status.HTTP_200_OK,
    summary="Delete all chunks for a knowledge source",
)
async def delete_source(
    current_user: CurrentUser,
    db: DB,
    source: str = Query(..., description="Exact source name to delete"),
) -> dict:
    """
    Delete all knowledge chunks associated with the given source name.

    The `source` value must exactly match the stored source field
    (e.g. "machine_learning.pdf", "arxiv.org", "Pasted text").

    This is a hard delete — there is no soft-delete or recovery.
    The user must re-ingest the document if they want it back.
    """
    service = KnowledgeService(db)
    deleted = await service.delete_source(user_id=current_user.id, source=source)
    return {"deleted": deleted, "source": source}


@router.post(
    "/ingest",
    response_model=KnowledgeIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a document into the knowledge base",
)
async def ingest_document(
    current_user: CurrentUser,
    db: DB,
    url: str | None = Form(None, description="URL to fetch and ingest via Jina Reader"),
    text: str | None = Form(None, description="Raw text to ingest directly"),
    source_name: str | None = Form(None, description="Display name override for the source"),
    file: UploadFile | None = File(None, description="PDF or .txt file to upload"),
) -> KnowledgeIngestResponse:
    """
    Ingest a document into the user's knowledge base.

    Accepts one of:
    - **file**: a PDF or plain-text file upload
    - **url**: a URL (fetched as markdown via Jina Reader)
    - **text**: raw text pasted directly

    If multiple inputs are provided, priority is: file > url > text.

    The document is:
    1. Parsed/fetched to extract plain text
    2. Split into ~400-word overlapping chunks
    3. Embedded via NVIDIA NIM (batch)
    4. Stored in the KnowledgeChunk table with pgvector embeddings

    Returns a summary of the ingestion result including chunk count.
    """
    if not url and not text and not file:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one of: url, text, or file.",
        )

    file_bytes: bytes | None = None
    filename: str | None = None
    if file:
        file_bytes = await file.read()
        filename = file.filename

    service = KnowledgeService(db)
    try:
        return await service.ingest_document(
            user_id=current_user.id,
            url=url,
            text=text,
            file_bytes=file_bytes,
            filename=filename,
            source_name=source_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
