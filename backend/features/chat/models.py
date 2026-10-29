"""
features/chat/models.py

SQLAlchemy ORM models for Chat and Message tables.

DATA MODEL:
  User → (1:many) → Chat → (1:many) → Message

Chat:
  Represents a conversation session. Users can have many named chats.
  The `title` is optional — the frontend sets it on the first user message
  using a short summarisation prompt (not yet implemented on this backend).

Message:
  Individual turns in a conversation. `role` mirrors the OpenAI convention:
    "user"      — human message
    "assistant" — AI response
    "tool"      — tool execution result (internal, rarely surface in UI)
  Messages are ordered by createdAt ASC when loaded for display.

RELATIONSHIP TO STREAMING:
  The streaming endpoint does NOT auto-save messages — the frontend calls
  POST /chats/{id}/messages explicitly after saving each turn, just like
  the original Next.js API. This keeps the streaming path simple and fast.

TABLE NAMES:
  Both tables use Prisma's PascalCase convention ("Chat", "Message") —
  mapped via __tablename__ = "Chat" / "Message".
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.auth.models import User


class Chat(Base):
    __tablename__ = "Chat"

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
    # title is optional — set by the frontend after the first exchange
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # back_populates="chats" matches the relationship on User in auth/models.py
    user: Mapped["User"] = relationship(
        "User",
        back_populates="chats",
        lazy="selectin",
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="noload",   # Load explicitly — a chat can have hundreds of messages
    )

    def __repr__(self) -> str:
        return f"<Chat id={self.id!r} title={self.title!r} user_id={self.user_id!r}>"


class Message(Base):
    __tablename__ = "Message"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chat_id: Mapped[str] = mapped_column(
        "chatId",
        String,
        ForeignKey("Chat.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # role: "user" | "assistant" | "tool" — follows OpenAI message role convention
    role: Mapped[str] = mapped_column(String, nullable=False)
    # content: full message text — can be long for detailed AI responses
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="messages",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id!r} role={self.role!r} chat_id={self.chat_id!r}>"
