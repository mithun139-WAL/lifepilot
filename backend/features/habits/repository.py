"""
features/habits/repository.py

Database access for Habit and HabitProgress.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.enums import HabitFrequency
from features.habits.models import Habit, HabitProgress


class HabitRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Habit queries
    # ------------------------------------------------------------------

    async def get_habit_by_id(self, habit_id: str) -> Habit | None:
        result = await self.db.execute(
            select(Habit)
            .where(Habit.id == habit_id)
            .options(selectinload(Habit.completions))
        )
        return result.scalar_one_or_none()

    async def get_habit_by_id_and_plan(
        self, habit_id: str, learning_plan_id: str
    ) -> Habit | None:
        result = await self.db.execute(
            select(Habit)
            .where(Habit.id == habit_id, Habit.learning_plan_id == learning_plan_id)
            .options(selectinload(Habit.completions))
        )
        return result.scalar_one_or_none()

    async def get_streaks(self, user_id: str) -> list[Habit]:
        """Return DAILY habits with streak > 0, ordered by streak desc."""
        result = await self.db.execute(
            select(Habit)
            .where(
                Habit.user_id == user_id,
                Habit.frequency == HabitFrequency.DAILY,
                Habit.streak > 0,
            )
            .order_by(Habit.streak.desc())
        )
        return list(result.scalars().all())

    async def create_habit(
        self,
        *,
        user_id: str,
        learning_plan_id: str,
        name: str,
        description: str | None,
        frequency: HabitFrequency,
    ) -> Habit:
        habit = Habit(
            user_id=user_id,
            learning_plan_id=learning_plan_id,
            name=name,
            description=description,
            frequency=frequency,
        )
        self.db.add(habit)
        await self.db.flush()
        await self.db.refresh(habit)
        return habit

    async def update_habit(self, habit_id: str, **kwargs: object) -> Habit | None:
        stmt = (
            update(Habit).where(Habit.id == habit_id).values(**kwargs).returning(Habit)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def delete_habit(self, habit_id: str) -> None:
        await self.db.execute(delete(Habit).where(Habit.id == habit_id))
        await self.db.flush()

    # ------------------------------------------------------------------
    # HabitProgress queries
    # ------------------------------------------------------------------

    async def find_progress_in_period(
        self, *, habit_id: str, period_start: datetime, period_end: datetime
    ) -> HabitProgress | None:
        result = await self.db.execute(
            select(HabitProgress).where(
                HabitProgress.habit_id == habit_id,
                HabitProgress.date >= period_start,
                HabitProgress.date < period_end,
            )
        )
        return result.scalar_one_or_none()

    async def create_progress(
        self, *, habit_id: str, date: datetime, completed: bool
    ) -> HabitProgress:
        progress = HabitProgress(habit_id=habit_id, date=date, completed=completed)
        self.db.add(progress)
        await self.db.flush()
        await self.db.refresh(progress)
        return progress

    async def update_progress(
        self, progress_id: str, completed: bool
    ) -> HabitProgress | None:
        stmt = (
            update(HabitProgress)
            .where(HabitProgress.id == progress_id)
            .values(completed=completed)
            .returning(HabitProgress)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def count_completions(self, habit_id: str) -> int:
        result = await self.db.execute(
            select(func.count()).where(
                HabitProgress.habit_id == habit_id,
                HabitProgress.completed.is_(True),
            )
        )
        return result.scalar_one()

    async def update_habit_stats(
        self, habit_id: str, *, streak: int, progress: int
    ) -> None:
        await self.db.execute(
            update(Habit)
            .where(Habit.id == habit_id)
            .values(streak=streak, progress=progress)
        )
        await self.db.flush()
