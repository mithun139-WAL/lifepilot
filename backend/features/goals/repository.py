"""
features/goals/repository.py

Database access layer for Goal operations.

WHAT LIVES HERE:
- Raw SELECT / INSERT / UPDATE / DELETE for the Goal table
- No business logic (no ownership checks, no error translation)
- All methods are async (awaits DB I/O)

WHAT DOES NOT LIVE HERE:
- "Does this user own this goal?" — that's the service's job
- "What do I do if the goal doesn't exist?" — service handles that
- Importing other services or sending emails

MERN COMPARISON:
    Goal.find({ userId })      →  repo.get_goals_by_user(user_id)
    Goal.create({ ... })       →  repo.create_goal(...)
    Goal.findByIdAndUpdate()   →  repo.update_goal(goal_id, **kwargs)
    Goal.findByIdAndDelete()   →  repo.delete_goal(goal_id)
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from features.goals.models import Goal


class GoalRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_goals_by_user(self, user_id: str) -> list[Goal]:
        """Return all goals for a user, ordered newest-first."""
        result = await self.db.execute(
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_goal_by_id(self, goal_id: str) -> Goal | None:
        """Fetch a single goal by its primary key."""
        result = await self.db.execute(select(Goal).where(Goal.id == goal_id))
        return result.scalar_one_or_none()

    async def create_goal(
        self,
        *,
        user_id: str,
        title: str,
        hours_per_day: str,
        target_weeks: int,
        preferred_time: datetime,   # service always resolves the default before calling here
    ) -> Goal:
        """Insert a new goal row and return it with DB-generated defaults populated."""
        goal = Goal(
            user_id=user_id,
            title=title,
            hours_per_day=hours_per_day,
            target_weeks=target_weeks,
            preferred_time=preferred_time,
        )
        self.db.add(goal)
        # flush() sends the INSERT to the DB within the current transaction
        # so we get the generated id and server_default timestamps back.
        # The transaction is NOT committed yet — the router's DB session
        # commits after the entire request handler returns without error.
        await self.db.flush()
        await self.db.refresh(goal)
        return goal

    async def update_goal(self, goal_id: str, **kwargs: object) -> Goal | None:
        """
        Apply arbitrary field updates to a goal row.

        Uses SQLAlchemy's ORM-level UPDATE with RETURNING so we get back
        the updated row in a single round-trip (no separate SELECT needed).

        kwargs must use Python attribute names (snake_case), not DB column names.
        SQLAlchemy maps them via the mapped_column() definitions.
        """
        stmt = (
            update(Goal)
            .where(Goal.id == goal_id)
            .values(**kwargs)
            .returning(Goal)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def delete_goal(self, goal_id: str) -> None:
        """
        Delete a goal row by ID.

        The DB-level CASCADE (defined in Prisma schema) automatically removes:
        LearningPlan → Planner → Task rows linked to this goal.

        NOTE: Google Calendar event cleanup is NOT handled here.
        It must be done BEFORE calling this method (in the service layer)
        because once the Task rows are deleted, we lose the googleCalendarEventId.
        This is implemented in the tasks feature phase.
        """
        await self.db.execute(delete(Goal).where(Goal.id == goal_id))
        await self.db.flush()
