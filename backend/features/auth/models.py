"""
features/auth/models.py

SQLAlchemy ORM models for authentication-related tables.

THE MENTAL MODEL (MERN comparison):
Mongoose schema:    const userSchema = new Schema({ email: String, ... })
SQLAlchemy model:   class User(Base): email: Mapped[str] = mapped_column(String)

Key differences:
- SQLAlchemy models map directly to database tables
- Relationships are declared explicitly with Relationship()
- Types are Python types wrapped in Mapped[] for full IDE support
- No schema is implied — you define exactly what the DB looks like

WHY WE MIRROR THE EXISTING SCHEMA EXACTLY:
Your current PostgreSQL database has existing data.
The models here must match the column names and types exactly.
Alembic will compare these models against the live DB to generate
migration diffs — if they don't match, migrations will be wrong.

NAMING CONVENTION NOTE:
Prisma uses camelCase (passwordHash, isVerified)
PostgreSQL conventionally uses snake_case (password_hash, is_verified)
We use snake_case here (Python/SQLAlchemy convention) and map to the
actual column names explicitly where they differ from Prisma's output.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.goals.models import Goal
    from features.chat.models import Chat
    from features.habits.models import Habit
    from features.mood.models import Mood
    from features.knowledge.models import KnowledgeChunk


class User(Base):
    """
    Primary user model.
    
    Maps to the 'User' table created by Prisma.
    Note: Prisma uses PascalCase table names by default.
    SQLAlchemy needs __tablename__ to match exactly.
    """

    __tablename__ = "User"

    # Primary key — Prisma uses cuid() by default, which produces string IDs.
    # We store as String to match exactly. Using UUID type here would cause
    # a type mismatch with the existing data.
    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Core identity
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    
    # passwordHash is nullable because OAuth users (Google, GitHub) have no password
    password_hash: Mapped[str | None] = mapped_column(
        "passwordHash",   # Maps to the Prisma-generated column name
        String,
        nullable=True,
    )
    image: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # Email verification
    email_verified: Mapped[datetime | None] = mapped_column(
        "emailVerified",
        DateTime(timezone=True),
        nullable=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        "isVerified",
        Boolean,
        default=False,
        nullable=False,
    )

    # Onboarding state
    onboarding_complete: Mapped[bool] = mapped_column(
        "onboardingComplete",
        Boolean,
        default=False,
        nullable=False,
    )

    # User preferences (set during onboarding)
    skill_level: Mapped[str | None] = mapped_column("skillLevel", String, nullable=True)
    weekly_hours: Mapped[int | None] = mapped_column("weeklyHours", Integer, nullable=True)
    pace: Mapped[str | None] = mapped_column("pace", String, nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(
        "deadline",
        DateTime(timezone=True),
        nullable=True,
    )
    preferred_formats: Mapped[dict | list | None] = mapped_column(
        "preferredFormats",
        JSONB,           # JSONB for efficient JSON storage and querying in Postgres
        nullable=True,
    )

    # Timestamps
    # server_default=func.now() tells Postgres to set this automatically.
    # This is more reliable than Python-side defaults for concurrent inserts.
    created_at: Mapped[datetime] = mapped_column(
        "createdAt",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    # lazy="selectin" means when you load a User, SQLAlchemy automatically
    # runs a second SELECT to load these relationships using the IN operator.
    # This is the correct async default — "lazy" loading is not available
    # in async sessions because it requires implicit I/O.
    # 
    # For large collections (messages, knowledge_chunks), consider
    # lazy="noload" and loading them explicitly when needed.
    goals: Mapped[list["Goal"]] = relationship(
        "Goal",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    chats: Mapped[list["Chat"]] = relationship(
        "Chat",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",  # Load explicitly — users may have many chats
    )
    habits: Mapped[list["Habit"]] = relationship(
        "Habit",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    moods: Mapped[list["Mood"]] = relationship(
        "Mood",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    knowledge_chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        "KnowledgeChunk",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!r} email={self.email!r}>"


class VerificationToken(Base):
    """
    Email verification tokens.
    Maps to Prisma's VerificationToken model.
    """

    __tablename__ = "VerificationToken"

    identifier: Mapped[str] = mapped_column(String, primary_key=True)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<VerificationToken identifier={self.identifier!r}>"


class Account(Base):
    """
    OAuth provider accounts linked to a user.
    Maps to Prisma's Account model (NextAuth OAuth accounts).
    
    For FastAPI, we store OAuth tokens here when users connect
    Google/GitHub. This lets us access Google Calendar on their behalf.
    """

    __tablename__ = "Account"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        "userId",
        String,
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    provider_account_id: Mapped[str] = mapped_column(
        "providerAccountId", String, nullable=False
    )

    # OAuth tokens
    refresh_token: Mapped[str | None] = mapped_column("refresh_token", Text, nullable=True)
    access_token: Mapped[str | None] = mapped_column("access_token", Text, nullable=True)
    expires_at: Mapped[int | None] = mapped_column("expires_at", Integer, nullable=True)
    token_type: Mapped[str | None] = mapped_column("token_type", String, nullable=True)
    scope: Mapped[str | None] = mapped_column("scope", String, nullable=True)
    id_token: Mapped[str | None] = mapped_column("id_token", Text, nullable=True)
    session_state: Mapped[str | None] = mapped_column("session_state", String, nullable=True)
    refresh_token_expires_in: Mapped[int | None] = mapped_column(
        "refresh_token_expires_in", Integer, nullable=True
    )

    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Account provider={self.provider!r} user_id={self.user_id!r}>"
