"""
features/tasks/models.py

SQLAlchemy models for Task and Checklist.

TASK → CHECKLIST RELATIONSHIP:
- Tasks have Checklists (sub-items to complete)
- When ALL checklists for a task are completed, the task auto-completes
- When any checklist is updated, the parent planner's progress recalculates

STATUS CASCADE (from original Next.js logic):
  checklist updated → are all checklists COMPLETED?
    yes → set task.status = COMPLETED, task.completedAt = now()
    no  → set task.status = IN_PROGRESS
  → recalculate planner.progress = (completed_tasks / total_tasks) * 100

PREFERRED_TIME DEFAULT:
The DB default is CURRENT_DATE + interval '10 hours' (today at 10am UTC).
This matches the Prisma @default(dbgenerated(...)) on both Task and Goal.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base
from core.enums import TaskStatus, task_status_pg_enum

if TYPE_CHECKING:
    from features.planners.models import Planner


class Task(Base):
    """
    A specific task to complete within a planner week.
    """

    __tablename__ = "Task"

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
    planner_id: Mapped[str] = mapped_column(
        "plannerId",
        String,
        ForeignKey("Planner.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        task_status_pg_enum,
        default=TaskStatus.PENDING,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(
        "dueDate", DateTime(timezone=True), nullable=True
    )
    preferred_time: Mapped[datetime] = mapped_column(
        "preferredTime",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_DATE + interval '10 hours'"),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        "completedAt", DateTime(timezone=True), nullable=True
    )
    google_calendar_event_id: Mapped[str | None] = mapped_column(
        "googleCalendarEventId", String, nullable=True
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
    planner: Mapped["Planner"] = relationship(
        "Planner",
        back_populates="tasks",
        lazy="selectin",
    )
    # Checklists auto-load with the task — they're always needed together
    checklists: Mapped[list["Checklist"]] = relationship(
        "Checklist",
        back_populates="task",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Checklist.id",
    )

    def __repr__(self) -> str:
        return f"<Task id={self.id!r} title={self.title!r} status={self.status}>"


class Checklist(Base):
    """
    A sub-item checklist entry belonging to a Task.

    expectedTime is stored as a string (e.g. "1 hour", "30 minutes").
    The original Prisma schema chose String over Int intentionally.
    """

    __tablename__ = "Checklist"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        "taskId",
        String,
        ForeignKey("Task.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        task_status_pg_enum,
        default=TaskStatus.PENDING,
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_time: Mapped[str | None] = mapped_column(
        "expectedTime", String, nullable=True
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

    task: Mapped["Task"] = relationship(
        "Task",
        back_populates="checklists",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Checklist id={self.id!r} title={self.title!r} status={self.status}>"
