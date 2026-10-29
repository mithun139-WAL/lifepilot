"""
features/planners/models.py

SQLAlchemy model for the Planner table.

A Planner represents one week's milestone in a learning plan.
Each Planner belongs to a LearningPlan and contains Tasks.

RELATIONSHIP NOTES:
- user_id FK is present but no Python User relationship is declared here.
  User model (auth/models.py) does not declare a reverse `planners` relationship,
  so we keep it as a plain FK column for DB integrity only.
- learning_plan relationship uses back_populates="planners" matching LearningPlan.planners
- tasks cascade delete-orphan: deleting a Planner removes all its Tasks (and their Checklists)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.learning_plans.models import LearningPlan
    from features.tasks.models import Task


class Planner(Base):
    """Weekly milestone in a learning plan."""

    __tablename__ = "Planner"

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
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[datetime | None] = mapped_column(
        "startDate", DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[datetime | None] = mapped_column(
        "endDate", DateTime(timezone=True), nullable=True
    )
    # progress: 0–100 percentage of tasks completed in this week
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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
    learning_plan: Mapped["LearningPlan"] = relationship(
        "LearningPlan",
        back_populates="planners",
        lazy="selectin",
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="planner",
        cascade="all, delete-orphan",
        lazy="noload",  # Load explicitly when needed — tasks can be numerous
    )

    def __repr__(self) -> str:
        return f"<Planner id={self.id!r} week={self.week} title={self.title!r}>"
