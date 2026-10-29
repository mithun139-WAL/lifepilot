"""
features/goals/models.py

SQLAlchemy ORM model for the Goal table.

PRISMA SCHEMA NOTES:
- hoursPerDay is a String (not Int) in Prisma — the user may store "2-3" or "1.5"
- preferredTime has a DB-level default: CURRENT_DATE + interval '10 hours' (today at 10am)
- updatedAt uses @default(now()) WITHOUT @updatedAt — no auto-update in Prisma.
  We add onupdate=func.now() here for correct behaviour; it's application-level only
  (no DB trigger) so it won't create a schema diff in Alembic.

RELATIONSHIP WIRING:
- User → Goal is already declared in auth/models.py (goals relationship)
- Goal → LearningPlan is declared here with TYPE_CHECKING to avoid circular imports
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base

if TYPE_CHECKING:
    from features.auth.models import User
    from features.learning_plans.models import LearningPlan


class Goal(Base):
    """
    User learning goal.

    Maps to the 'Goal' table created by Prisma.
    Each goal can have one LearningPlan (the AI-generated study plan).
    The cascade on delete removes LearningPlan → Planner → Task rows automatically.
    """

    __tablename__ = "Goal"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        "userId",
        String,
        ForeignKey("User.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)

    # String — not Int. Intentional in the original schema.
    hours_per_day: Mapped[str] = mapped_column("hoursPerDay", String, nullable=False)

    target_weeks: Mapped[int] = mapped_column("targetWeeks", Integer, nullable=False)

    # DB default: CURRENT_DATE + interval '10 hours' (today at 10am UTC)
    preferred_time: Mapped[datetime] = mapped_column(
        "preferredTime",
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_DATE + interval '10 hours'"),
    )

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
        # onupdate is application-level only — SQLAlchemy adds updated_at=now()
        # to every UPDATE statement. Does not create a DB trigger.
        onupdate=func.now(),
        nullable=False,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    # back_populates="goals" must match the attribute name on User
    user: Mapped["User"] = relationship(
        "User",
        back_populates="goals",
        lazy="selectin",
    )

    # A Goal has one LearningPlan in practice (goalId is @unique in Prisma),
    # but Prisma models it as LearningPlan[] so we mirror that.
    # lazy="noload" — learning plans are large JSON blobs; load explicitly.
    learning_plans: Mapped[list["LearningPlan"]] = relationship(
        "LearningPlan",
        back_populates="goal",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<Goal id={self.id!r} title={self.title!r} user_id={self.user_id!r}>"
