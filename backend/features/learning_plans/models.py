"""
features/learning_plans/models.py

SQLAlchemy model for the LearningPlan table.

A LearningPlan is created by the AI planner feature. It stores:
- topic: the subject to learn (e.g. "Machine Learning with Python")
- planner: JSON array of weekly milestones (AI-generated, matches Planner rows)
- task_list: JSON array of tasks per week (AI-generated, matches Task rows)
- habits_list: JSON array of habits (AI-generated, matches Habit rows)

The JSON blobs (planner, task_list, habits_list) are the raw AI output.
After creation, the POST /learning-plans handler also creates the structured
Planner, Task, Habit, HabitProgress rows in the DB.

PRISMA NOTE:
- goalId is @unique — one goal → at most one learning plan
- updatedAt uses @updatedAt (unlike most other models that use @default(now()))
  This means Prisma auto-updates it on every change. We mirror with onupdate=func.now().
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.goals.models import Goal
    from features.planners.models import Planner
    from features.habits.models import Habit


class LearningPlan(Base):
    """AI-generated learning plan linked to a goal."""

    __tablename__ = "LearningPlan"

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
    # One-to-one with Goal (unique constraint from Prisma @unique on goalId)
    goal_id: Mapped[str] = mapped_column(
        "goalId",
        String,
        ForeignKey("Goal.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    topic: Mapped[str] = mapped_column(String, nullable=False)

    # Raw AI output — stored as JSONB for efficient storage and querying
    # planner: list of { week, milestone, summary, startDate, endDate }
    planner: Mapped[list | dict] = mapped_column(JSONB, nullable=False)
    # task_list: list of { week, tasks: [{ title, description, dueDate, ... }] }
    task_list: Mapped[list | dict] = mapped_column("task_list", JSONB, nullable=False)
    # habits_list: list of { title, frequency, description }
    habits_list: Mapped[list | dict] = mapped_column(
        "habits_list", JSONB, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # @updatedAt in Prisma → onupdate=func.now() in SQLAlchemy
    # default=func.now() ensures the value is included in the INSERT statement
    # even when the DB column has no server-side DEFAULT (as created by Prisma).
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    # back_populates="learning_plans" matches Goal.learning_plans in goals/models.py
    goal: Mapped["Goal"] = relationship(
        "Goal",
        back_populates="learning_plans",
        lazy="selectin",
    )
    # Planners ordered by week number for display
    planners: Mapped[list["Planner"]] = relationship(
        "Planner",
        back_populates="learning_plan",
        cascade="all, delete-orphan",
        lazy="noload",
        order_by="Planner.week",
    )
    habits: Mapped[list["Habit"]] = relationship(
        "Habit",
        back_populates="learning_plan",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<LearningPlan id={self.id!r} topic={self.topic!r}>"
