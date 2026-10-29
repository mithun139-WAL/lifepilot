"""
features/chat/router.py

Chat API endpoints — streaming AI coach + conversation CRUD.

ROUTE MAP:
  POST   /chat/stream                           → streaming AI response
  GET    /chats                                 → list user's chats
  POST   /chats                                 → create a chat
  GET    /chats/{chat_id}                       → get one chat
  PUT    /chats/{chat_id}                       → rename a chat
  DELETE /chats/{chat_id}                       → delete a chat + messages
  GET    /chats/{chat_id}/messages              → get all messages in a chat
  POST   /chats/{chat_id}/messages              → save a message to a chat
  DELETE /chats/{chat_id}/messages/{message_id} → delete one message

STREAMING ENDPOINT (/chat/stream):
  Returns a StreamingResponse with media_type="text/plain".

  WHY text/plain (not text/event-stream):
  The Next.js API streams raw text. The frontend reads it with a streaming
  fetch reader — no SSE parsing. To be a drop-in replacement when the
  frontend switches to the FastAPI URL, we use the same format.

  IMPORTANT for deployment:
  When running behind Nginx, add `X-Accel-Buffering: no` to prevent
  Nginx from buffering the entire response before forwarding it.
  This is already set in the response headers.

MESSAGE PERSISTENCE (important UX note):
  The streaming endpoint does NOT auto-save messages to the DB.
  The frontend is responsible for:
    1. Call POST /chats/{id}/messages with the user's message
    2. Call POST /chat/stream to get the AI response
    3. Call POST /chats/{id}/messages again with the complete AI response
  This is identical to how the Next.js backend works and keeps the
  streaming path free of extra DB writes that could add latency.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from core.dependencies import DB, CurrentUser
from features.chat.schemas import (
    ChatCreate,
    ChatResponse,
    ChatUpdate,
    MessageCreate,
    MessageResponse,
    StreamRequest,
)
from features.chat.service import ChatService

router = APIRouter(tags=["Chat"])


# ---------------------------------------------------------------------------
# Streaming endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/chat/stream",
    summary="Stream an AI Coach response",
    response_class=StreamingResponse,
)
async def stream_chat(
    body: StreamRequest,
    current_user: CurrentUser,
    db: DB,
) -> StreamingResponse:
    """
    Stream an AI Coach response for the given conversation history.

    The response is a plain-text stream of tokens as they arrive from NIM.
    The client should read the body incrementally (streaming fetch reader).

    The service:
    1. Fetches user context (plan, tasks, habits, mood) from the DB
    2. Runs RAG on the last user message
    3. Streams the NIM response token by token
    4. If the model calls tools (complete_task / log_mood): executes them
       silently and streams the follow-up response

    The client is responsible for saving the final accumulated text to the
    DB via POST /chats/{id}/messages.
    """
    service = ChatService(db)
    return StreamingResponse(
        service.stream_response(
            current_user=current_user,
            messages=body.messages,
        ),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",   # Nginx: disable response buffering
            "Transfer-Encoding": "chunked",
        },
    )


# ---------------------------------------------------------------------------
# Chat CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/chats",
    response_model=list[ChatResponse],
    summary="List all chats for the current user",
)
async def list_chats(current_user: CurrentUser, db: DB) -> list[ChatResponse]:
    service = ChatService(db)
    return await service.list_chats(user_id=current_user.id)


@router.post(
    "/chats",
    response_model=ChatResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new chat",
)
async def create_chat(
    body: ChatCreate,
    current_user: CurrentUser,
    db: DB,
) -> ChatResponse:
    service = ChatService(db)
    return await service.create_chat(user_id=current_user.id, data=body)


@router.get(
    "/chats/{chat_id}",
    response_model=ChatResponse,
    summary="Get a single chat",
)
async def get_chat(
    chat_id: str,
    current_user: CurrentUser,
    db: DB,
) -> ChatResponse:
    service = ChatService(db)
    chat = await service.get_chat(user_id=current_user.id, chat_id=chat_id)
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return ChatResponse.model_validate(chat)


@router.put(
    "/chats/{chat_id}",
    response_model=ChatResponse,
    summary="Rename a chat",
)
async def update_chat(
    chat_id: str,
    body: ChatUpdate,
    current_user: CurrentUser,
    db: DB,
) -> ChatResponse:
    service = ChatService(db)
    chat = await service.update_chat_title(
        user_id=current_user.id, chat_id=chat_id, title=body.title
    )
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return ChatResponse.model_validate(chat)


@router.delete(
    "/chats/{chat_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a chat and all its messages",
)
async def delete_chat(
    chat_id: str,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    service = ChatService(db)
    await service.delete_chat(user_id=current_user.id, chat_id=chat_id)
    return {"deleted": True, "id": chat_id}


# ---------------------------------------------------------------------------
# Message CRUD (nested under /chats/{chat_id})
# ---------------------------------------------------------------------------

@router.get(
    "/chats/{chat_id}/messages",
    response_model=list[MessageResponse],
    summary="Get all messages in a chat (oldest first)",
)
async def get_messages(
    chat_id: str,
    current_user: CurrentUser,
    db: DB,
) -> list[MessageResponse]:
    service = ChatService(db)
    msgs = await service.get_messages(user_id=current_user.id, chat_id=chat_id)
    if msgs is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return msgs


@router.post(
    "/chats/{chat_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Append a message to a chat",
)
async def create_message(
    chat_id: str,
    body: MessageCreate,
    current_user: CurrentUser,
    db: DB,
) -> MessageResponse:
    service = ChatService(db)
    msg = await service.create_message(
        user_id=current_user.id,
        chat_id=chat_id,
        role=body.role,
        content=body.content,
    )
    if msg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return msg


@router.delete(
    "/chats/{chat_id}/messages/{message_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a single message",
)
async def delete_message(
    chat_id: str,
    message_id: str,
    current_user: CurrentUser,
    db: DB,
) -> dict:
    service = ChatService(db)
    ok = await service.delete_message(
        user_id=current_user.id, chat_id=chat_id, message_id=message_id
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return {"deleted": True, "id": message_id}
