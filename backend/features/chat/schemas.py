"""
features/chat/schemas.py

Pydantic schemas for the Chat feature.

SCHEMA ROLES:
  ChatCreate      → POST /chats body
  ChatUpdate      → PUT /chats/{id} body
  ChatResponse    → response shape for chat objects
  MessageCreate   → POST /chats/{id}/messages body
  MessageResponse → response shape for message objects
  StreamRequest   → POST /chat/stream body

WHY StreamRequest HAS NO chat_id:
  The streaming endpoint is stateless — it streams a response and returns.
  Persisting messages is the frontend's responsibility (separate POST call).
  This keeps the hot streaming path free of any additional DB writes that
  could add latency between tokens.

MESSAGE DICT FORMAT:
  The `messages` field in StreamRequest mirrors the OpenAI message format:
    [{"role": "user",      "content": "..."},
     {"role": "assistant", "content": "..."},
     {"role": "user",      "content": "latest message"}]
  The service prepends the system prompt before sending to NIM.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator


class ChatCreate(BaseModel):
    title: str | None = None


class ChatUpdate(BaseModel):
    title: str


class ChatResponse(BaseModel):
    id: str
    title: str | None
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"user", "assistant", "system", "tool"}
        if v not in allowed:
            raise ValueError(f"role must be one of {allowed}")
        return v


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StreamRequest(BaseModel):
    """
    Request body for the streaming chat endpoint.

    `messages` is the full conversation history in OpenAI format:
        [{"role": "user", "content": "..."},
         {"role": "assistant", "content": "..."},
         ...]
    The service adds the system prompt at position 0 before sending to NIM.
    """

    messages: list[dict]

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v: list[dict]) -> list[dict]:
        if not v:
            raise ValueError("messages must not be empty")
        for msg in v:
            if "role" not in msg or "content" not in msg:
                raise ValueError("each message must have 'role' and 'content' keys")
        return v
