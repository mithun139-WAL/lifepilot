"""
features/habits/models.py

SQLAlchemy models for Habit and HabitProgress.

HABIT STREAK LOGIC (ported from src/lib/utils.ts):
Streaks are calculated at query time in the service layer, not stored as a
running counter in the DB. The `streak` column on Habit is a denormalized cache
that can be updated periodically or on each completion event.

isHabitCompleted:
  DAILY → any HabitProgress with completed=True and date within today
  WEEKLY → any HabitProgress with completed=True and date within current week (Mon–Sun)

calculateStreak:
  Sort completions descending by date, walk backward counting consecutive
  days (DAILY) or weeks (WEEKLY) until there's a gap.

UNIQUE CONSTRAINT:
  (habitId, date) is unique — you can only have one progress record per habit per day.
  This matches Prisma's @@unique([habitId, date]).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base
from core.enums import HabitFrequency, habit_frequency_pg_enum

if TYPE_CHECKING:
    from features.auth.models import User
    from features.learning_plans.models import LearningPlan


class Habit(Base):
    """A recurring habit linked to a learning plan."""

    __tablename__ = "Habit"

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
    learning_plan_id: Mapped[str] = mapped_column(
        "learningPlanId",
        String,
        ForeignKey("LearningPlan.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # progress: number of total completions (not streak)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # streak: consecutive days/weeks — denormalized cache, recalculated on completion
    streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    frequency: Mapped[HabitFrequency] = mapped_column(
        habit_frequency_pg_enum,
        default=HabitFrequency.DAILY,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
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
    # back_populates="habits" matches the `habits` relationship on User in auth/models.py
    user: Mapped["User"] = relationship(
        "User",
        back_populates="habits",
        lazy="selectin",
    )
    learning_plan: Mapped["LearningPlan"] = relationship(
        "LearningPlan",
        back_populates="habits",
        lazy="selectin",
    )
    completions: Mapped[list["HabitProgress"]] = relationship(
        "HabitProgress",
        back_populates="habit",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<Habit id={self.id!r} name={self.name!r} frequency={self.frequency}>"


class HabitProgress(Base):
    """
    One completion record for a habit on a given date.

    The unique constraint (habitId, date) ensures idempotency:
    marking a habit complete twice on the same day is safe.
    """

    __tablename__ = "HabitProgress"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    habit_id: Mapped[str] = mapped_column(
        "habitId",
        String,
        ForeignKey("Habit.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    habit: Mapped["Habit"] = relationship(
        "Habit",
        back_populates="completions",
        lazy="selectin",
    )

    # DB-level unique constraint matching Prisma's @@unique([habitId, date])
    __table_args__ = (
        UniqueConstraint("habitId", "date", name="HabitProgress_habitId_date_key"),
    )

    def __repr__(self) -> str:
        return f"<HabitProgress habit_id={self.habit_id!r} date={self.date} completed={self.completed}>"
