"""
features/mood/models.py

SQLAlchemy model for the Mood table.

Simple model: a user records a mood string at a point in time.
Used for the mood insights chart on the dashboard.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.auth.models import User


class Mood(Base):
    __tablename__ = "Mood"

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
    # mood is a free-form string (e.g., "happy", "focused", "tired")
    mood: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # back_populates="moods" matches the `moods` relationship on User in auth/models.py
    user: Mapped["User"] = relationship(
        "User",
        back_populates="moods",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Mood id={self.id!r} mood={self.mood!r} user_id={self.user_id!r}>"
