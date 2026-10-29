"""
features/chat/repository.py

Database access layer for Chat and Message operations.

WHAT LIVES HERE:
- All SELECT / INSERT / UPDATE / DELETE for Chat and Message tables
- No business logic, no ownership checks
- All methods are async

OWNERSHIP POLICY:
- get_chat_by_id() does NOT enforce user_id ownership — the service
  layer checks that the chat.user_id == current_user.id
- delete_by_id() and update() include user_id in the WHERE clause as
  a security measure (double-check at the DB level)
"""

from __future__ import annotations

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from features.chat.models import Chat, Message


class ChatRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Chat CRUD
    # ------------------------------------------------------------------

    async def get_chats_by_user(self, user_id: str) -> list[Chat]:
        """Return all chats for a user, newest-first."""
        result = await self.db.execute(
            select(Chat)
            .where(Chat.user_id == user_id)
            .order_by(Chat.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_chat_by_id(self, chat_id: str) -> Chat | None:
        """Fetch one chat by primary key (no user_id filter — caller checks ownership)."""
        result = await self.db.execute(select(Chat).where(Chat.id == chat_id))
        return result.scalar_one_or_none()

    async def create_chat(self, *, user_id: str, title: str | None = None) -> Chat:
        """Create a new chat session."""
        chat = Chat(user_id=user_id, title=title)
        self.db.add(chat)
        await self.db.flush()
        await self.db.refresh(chat)
        return chat

    async def update_chat_title(
        self, *, chat_id: str, user_id: str, title: str
    ) -> Chat | None:
        """
        Update the title of a chat.

        Includes user_id in the WHERE clause so a user can never rename
        another user's chat even if they somehow know the ID.
        """
        stmt = (
            update(Chat)
            .where(Chat.id == chat_id, Chat.user_id == user_id)
            .values(title=title)
            .returning(Chat)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def delete_chat(self, *, chat_id: str, user_id: str) -> None:
        """
        Delete a chat and its messages (via CASCADE).

        Includes user_id in the WHERE clause as a safety guard.
        """
        await self.db.execute(
            delete(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        await self.db.flush()

    # ------------------------------------------------------------------
    # Message CRUD
    # ------------------------------------------------------------------

    async def get_messages(self, chat_id: str) -> list[Message]:
        """Return all messages for a chat, ordered oldest-first (natural reading order)."""
        result = await self.db.execute(
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(Message.created_at.asc())
        )
        return list(result.scalars().all())

    async def create_message(
        self, *, chat_id: str, role: str, content: str
    ) -> Message:
        """Append one message to a chat."""
        msg = Message(chat_id=chat_id, role=role, content=content)
        self.db.add(msg)
        await self.db.flush()
        await self.db.refresh(msg)
        return msg

    async def delete_message(self, *, message_id: str) -> None:
        """Delete a single message by ID."""
        await self.db.execute(delete(Message).where(Message.id == message_id))
        await self.db.flush()
