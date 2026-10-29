"""
features/habits/service.py

Business logic for habits and habit-progress (toggle) operations.

KEY FUNCTIONS:
    toggle_habit()     — marks a habit complete/incomplete for a given date,
                         then recalculates streak and progress. Ported from the
                         original PATCH /learning-plans/{id}/habits/{id}/toggle.

    _calculate_streak() — ported from calculateStreak() in src/lib/utils.ts.
                          Walks completions backwards counting consecutive
                          days (DAILY) or weeks (WEEKLY).

    _calculate_progress() — (total completions / periods since creation) * 100,
                             capped at 100. Matches original handler logic.

SECURITY FIX:
    Original GET /habits/streaks had NO auth check.
    Our get_streaks() requires user_id from JWT.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import HabitFrequency
from core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from features.habits.models import Habit, HabitProgress
from features.habits.repository import HabitRepository
from features.habits.schemas import HabitCreate, HabitUpdate
from features.learning_plans.repository import LearningPlanRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _period_start(frequency: HabitFrequency, date: datetime) -> datetime:
    """
    Return the start of the period (day or week) for the given date.
    WEEKLY uses Monday as week start (same as date-fns weekStartsOn: 1).
    """
    if frequency == HabitFrequency.DAILY:
        return date.replace(hour=0, minute=0, second=0, microsecond=0)
    else:  # WEEKLY
        # Monday = weekday() 0
        monday = date - timedelta(days=date.weekday())
        return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _period_end(frequency: HabitFrequency, period_start: datetime) -> datetime:
    """Return the exclusive end of the period (1 day or 7 days after start)."""
    if frequency == HabitFrequency.DAILY:
        return period_start + timedelta(days=1)
    else:
        return period_start + timedelta(days=7)


def _calculate_streak(
    frequency: HabitFrequency,
    completions: list[HabitProgress],
    current_progress_completed: bool,
    current_period_start: datetime,
) -> int:
    """
    Count consecutive completed periods walking backward from now.

    Ported directly from calculateStreak() in src/lib/utils.ts.

    Algorithm:
    1. Start cursor at current period
    2. If current period is completed, streak = 1, move cursor back one period
    3. Loop: check if previous period is completed
       - yes → streak++, move cursor back
       - no  → break
    """
    if not current_progress_completed:
        return 0

    streak = 1
    cursor = current_period_start

    while True:
        if frequency == HabitFrequency.DAILY:
            prev_start = cursor - timedelta(days=1)
        else:
            prev_start = cursor - timedelta(weeks=1)

        prev_end = _period_end(frequency, prev_start)

        found = any(
            c.completed and prev_start <= c.date.replace(tzinfo=None) < prev_end
            for c in completions
            if hasattr(c.date, "replace")
        )
        if found:
            streak += 1
            cursor = prev_start
        else:
            break

    return streak


def _calculate_progress(
    frequency: HabitFrequency,
    created_at: datetime,
    total_completions: int,
) -> int:
    """
    progress = min(100, round((total_completions / periods_since_creation) * 100))

    periods_since_creation is number of days (DAILY) or weeks (WEEKLY)
    since the habit was created, +1 to include today.
    """
    now = datetime.now()
    if frequency == HabitFrequency.DAILY:
        periods = max(
            1, (now - created_at.replace(tzinfo=None)).days + 1
        )
    else:
        periods = max(
            1,
            ((now - created_at.replace(tzinfo=None)).days // 7) + 1,
        )
    return min(100, round((total_completions / periods) * 100))


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class HabitService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = HabitRepository(db)

    # ------------------------------------------------------------------
    # Habit CRUD
    # ------------------------------------------------------------------

    async def create_habit(
        self, *, user_id: str, learning_plan_id: str, data: HabitCreate
    ) -> Habit:
        # Verify learning plan ownership
        lp_repo = LearningPlanRepository(self.db)
        plan = await lp_repo.get_plan_by_id(learning_plan_id)
        if plan is None or plan.user_id != user_id:
            raise NotFoundError("LearningPlan", learning_plan_id)

        return await self.repo.create_habit(
            user_id=user_id,
            learning_plan_id=learning_plan_id,
            name=data.name,
            description=data.description,
            frequency=data.frequency,
        )

    async def update_habit(
        self,
        *,
        habit_id: str,
        learning_plan_id: str,
        user_id: str,
        data: HabitUpdate,
    ) -> Habit:
        # Verify learning plan ownership
        lp_repo = LearningPlanRepository(self.db)
        plan = await lp_repo.get_plan_by_id(learning_plan_id)
        if plan is None or plan.user_id != user_id:
            raise NotFoundError("LearningPlan", learning_plan_id)

        habit = await self.repo.get_habit_by_id_and_plan(habit_id, learning_plan_id)
        if habit is None:
            raise NotFoundError("Habit", habit_id)

        updated = await self.repo.update_habit(
            habit_id,
            name=data.name,
            description=data.description,
            frequency=data.frequency,
        )
        if updated is None:
            raise NotFoundError("Habit", habit_id)
        return updated

    async def delete_habit(
        self, *, habit_id: str, learning_plan_id: str
    ) -> None:
        """
        Delete a habit by (habitId, learningPlanId) pair.
        Original handler had NO auth check — we keep that contract here.
        """
        habit = await self.repo.get_habit_by_id_and_plan(habit_id, learning_plan_id)
        if habit is None:
            raise NotFoundError("Habit", habit_id)
        await self.repo.delete_habit(habit_id)

    # ------------------------------------------------------------------
    # Toggle completion
    # ------------------------------------------------------------------

    async def toggle_habit(
        self, *, habit_id: str, date_str: str | None
    ) -> tuple[Habit, HabitProgress]:
        """
        Toggle a habit's completion for the given date (defaults to today).

        Returns (updated_habit, upserted_habit_progress).

        Ported from PATCH /api/learning-plans/{id}/habits/{id}/toggle
        """
        habit = await self.repo.get_habit_by_id(habit_id)
        if habit is None:
            raise NotFoundError("Habit", habit_id)

        target_date = datetime.fromisoformat(date_str) if date_str else datetime.now()
        period_start = _period_start(habit.frequency, target_date)
        period_end = _period_end(habit.frequency, period_start)

        existing = await self.repo.find_progress_in_period(
            habit_id=habit_id,
            period_start=period_start,
            period_end=period_end,
        )

        if existing:
            # Toggle: flip the completed flag
            new_completed = not existing.completed
            progress_record = await self.repo.update_progress(
                existing.id, new_completed
            )
        else:
            # First toggle for this period → create as completed
            progress_record = await self.repo.create_progress(
                habit_id=habit_id, date=period_start, completed=True
            )

        # Re-fetch habit with fresh completions for streak/progress calc
        # (we just created/updated a progress row; flush already called)
        fresh_habit = await self.repo.get_habit_by_id(habit_id)
        if fresh_habit is None:
            raise NotFoundError("Habit", habit_id)

        streak = _calculate_streak(
            frequency=fresh_habit.frequency,
            completions=fresh_habit.completions,
            current_progress_completed=progress_record.completed,
            current_period_start=period_start,
        )

        total_completions = await self.repo.count_completions(habit_id)
        progress_pct = _calculate_progress(
            frequency=fresh_habit.frequency,
            created_at=fresh_habit.created_at,
            total_completions=total_completions,
        )

        await self.repo.update_habit_stats(
            habit_id, streak=streak, progress=progress_pct
        )

        # Final re-fetch to return up-to-date data
        final_habit = await self.repo.get_habit_by_id(habit_id)
        return final_habit, progress_record

    # ------------------------------------------------------------------
    # Streaks
    # ------------------------------------------------------------------

    async def get_streaks(self, *, user_id: str) -> list[Habit]:
        """
        Return DAILY habits with streak > 0, ordered by streak desc.
        Adds auth check (original had none — security fix).
        """
        return await self.repo.get_streaks(user_id)
