"""
features/insights/router.py

Read-only aggregation endpoints for the Insights page.

ROUTE MAP:
  GET /insights/task-stats?start=&end=      → completed vs pending counts
  GET /insights/mood-trends?start=&end=     → moods grouped by calendar day
  GET /insights/goals-progress              → avg planner progress per goal
  GET /insights/learning-hours              → committed hours per goal
  GET /insights/habit-completion?start=&end=→ completion % per habit
  GET /insights/sse                         → SSE push (tasks + habits, 30s interval)

ARCHITECTURE NOTES:
These are pure aggregation endpoints with no write paths, so there is no
need for a separate repository or service layer. All DB logic lives here.

AUTH FIX vs NEXT.JS:
The original Next.js routes for task-stats, mood-trends, habit-completion,
goals-progress, and learning-hours had NO authentication — any request could
read any user's data. That was a bug. Every endpoint here is auth-gated
and scoped to current_user.id.

SSE SESSION DESIGN:
The /insights/sse endpoint does NOT use the request-scoped `DB` dependency.
Instead, it creates a new AsyncSession per poll cycle using AsyncSessionLocal
directly. Reason: the request-scoped session (from Depends(get_db)) is held
open for the entire SSE connection lifetime, which can be hours. Holding one
DB connection that long risks pool exhaustion and connection timeouts.
Creating a fresh session per 30-second poll is the correct pattern.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from core.database import AsyncSessionLocal
from core.dependencies import DB, CurrentUser
from core.enums import TaskStatus
from features.goals.models import Goal
from features.habits.models import Habit, HabitProgress
from features.learning_plans.models import LearningPlan
from features.mood.models import Mood
from features.tasks.models import Task

router = APIRouter(tags=["Insights"])

# ---------------------------------------------------------------------------
# Date range helpers
# ---------------------------------------------------------------------------

_EPOCH = datetime(1970, 1, 1)


def _parse_dt(value: str | None, default: datetime) -> datetime:
    """Parse an ISO-8601 date string, returning `default` if None or invalid."""
    if not value:
        return default
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# 1. Task stats
# ---------------------------------------------------------------------------

@router.get(
    "/insights/task-stats",
    summary="Completed vs pending task counts in a date range",
)
async def task_stats(
    current_user: CurrentUser,
    db: DB,
    start: Optional[str] = Query(None, description="ISO-8601 start date"),
    end: Optional[str] = Query(None, description="ISO-8601 end date"),
) -> dict:
    """
    Returns { completed: int, pending: int } for tasks whose dueDate
    falls within the given range, scoped to the current user.
    """
    start_dt = _parse_dt(start, _EPOCH)
    end_dt = _parse_dt(end, datetime.utcnow())

    result = await db.execute(
        select(Task.status)
        .where(
            Task.user_id == current_user.id,
            Task.due_date >= start_dt,
            Task.due_date <= end_dt,
        )
    )
    statuses = result.scalars().all()
    completed = sum(1 for s in statuses if s == TaskStatus.COMPLETED)
    return {"completed": completed, "pending": len(statuses) - completed}


# ---------------------------------------------------------------------------
# 2. Mood trends
# ---------------------------------------------------------------------------

@router.get(
    "/insights/mood-trends",
    summary="Moods grouped by calendar day in a date range",
)
async def mood_trends(
    current_user: CurrentUser,
    db: DB,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
) -> dict:
    """
    Returns { "YYYY-MM-DDTHH:MM:SS": ["happy", "focused"], ... }

    Each key is the ISO-8601 string of the start-of-day timestamp.
    Values are all mood strings recorded that day.
    """
    start_dt = _parse_dt(start, _EPOCH)
    end_dt = _parse_dt(end, datetime.utcnow())

    result = await db.execute(
        select(Mood.mood, Mood.created_at)
        .where(
            Mood.user_id == current_user.id,
            Mood.created_at >= start_dt,
            Mood.created_at <= end_dt,
        )
        .order_by(Mood.created_at)
    )
    rows = result.all()

    # Group moods by calendar day (start-of-day key, matching the Next.js format)
    grouped: dict[str, list[str]] = {}
    for mood_str, created_at in rows:
        day_key = created_at.replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        grouped.setdefault(day_key, []).append(mood_str)

    return grouped


# ---------------------------------------------------------------------------
# 3. Goals progress
# ---------------------------------------------------------------------------

@router.get(
    "/insights/goals-progress",
    summary="Average planner progress per goal",
)
async def goals_progress(
    current_user: CurrentUser,
    db: DB,
) -> list[dict]:
    """
    Returns [{ goalId, title, averageProgress: 0-100 }, ...]

    averageProgress is the mean of Planner.progress across all planners
    linked to a goal. 0 if the goal has no planners yet.
    """
    goals = (
        await db.execute(
            select(Goal)
            .where(Goal.user_id == current_user.id)
            .options(
                selectinload(Goal.learning_plans).selectinload(LearningPlan.planners)
            )
        )
    ).scalars().all()

    result = []
    for goal in goals:
        planners = [p for lp in goal.learning_plans for p in lp.planners]
        avg_progress = (
            round(sum(p.progress for p in planners) / len(planners))
            if planners
            else 0
        )
        result.append(
            {
                "goalId": goal.id,
                "title": goal.title,
                "averageProgress": avg_progress,
            }
        )
    return result


# ---------------------------------------------------------------------------
# 4. Learning hours
# ---------------------------------------------------------------------------

@router.get(
    "/insights/learning-hours",
    summary="Committed learning hours per goal",
)
async def learning_hours(
    current_user: CurrentUser,
    db: DB,
) -> list[dict]:
    """
    Returns [{ goalId, title, totalHours: float }, ...]

    totalHours = hoursPerDay × number_of_planners.
    Matches the Next.js formula: each planner week multiplies hoursPerDay.
    hoursPerDay is a String — non-numeric values (e.g. "2-3") produce 0.
    """
    goals = (
        await db.execute(
            select(Goal)
            .where(Goal.user_id == current_user.id)
            .options(
                selectinload(Goal.learning_plans).selectinload(LearningPlan.planners)
            )
        )
    ).scalars().all()

    result = []
    for goal in goals:
        planners = [p for lp in goal.learning_plans for p in lp.planners]
        try:
            hours_per_day = float(goal.hours_per_day)
        except (ValueError, TypeError):
            hours_per_day = 0.0
        result.append(
            {
                "goalId": goal.id,
                "title": goal.title,
                "totalHours": hours_per_day * len(planners),
            }
        )
    return result


# ---------------------------------------------------------------------------
# 5. Habit completion
# ---------------------------------------------------------------------------

@router.get(
    "/insights/habit-completion",
    summary="Completion percentage per habit in a date range",
)
async def habit_completion(
    current_user: CurrentUser,
    db: DB,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
) -> list[dict]:
    """
    Returns [{
        habitId, name, frequency,
        completionPercentage: 0.0-100.0
    }, ...]

    completionPercentage = completed HabitProgress rows / total rows in range.
    0 if no progress records exist in the date range.
    """
    start_dt = _parse_dt(start, _EPOCH)
    end_dt = _parse_dt(end, datetime.utcnow())

    habits = (
        await db.execute(
            select(Habit).where(Habit.user_id == current_user.id)
        )
    ).scalars().all()

    if not habits:
        return []

    habit_ids = [h.id for h in habits]
    completions = (
        await db.execute(
            select(HabitProgress).where(
                HabitProgress.habit_id.in_(habit_ids),
                HabitProgress.date >= start_dt,
                HabitProgress.date <= end_dt,
            )
        )
    ).scalars().all()

    # Group completions by habit_id in Python — avoids complex SQL GROUP BY
    by_habit: dict[str, list[HabitProgress]] = defaultdict(list)
    for c in completions:
        by_habit[c.habit_id].append(c)

    result = []
    for h in habits:
        cs = by_habit[h.id]
        pct = (
            round(sum(1 for c in cs if c.completed) / len(cs) * 100, 1)
            if cs
            else 0.0
        )
        result.append(
            {
                "habitId": h.id,
                "name": h.name,
                "frequency": h.frequency.value,
                "completionPercentage": pct,
            }
        )
    return result


# ---------------------------------------------------------------------------
# 6. SSE stream — real-time tasks + habits push
# ---------------------------------------------------------------------------

@router.get(
    "/insights/sse",
    summary="Server-sent events: tasks + habits updated every 30 seconds",
)
async def insights_sse(
    request: Request,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    Streams `data: <json>\\n\\n` events every 30 seconds.
    Each event payload: { tasks: [...], habits: [...] }

    WHY NO DB DEPENDENCY INJECTION HERE:
    The request-scoped session (Depends(get_db)) is held open for the entire
    SSE connection. For a 30-second polling interval this means one DB
    connection occupied indefinitely per connected client — a pool exhaustion
    risk. Instead, we create a new short-lived session per poll cycle and
    close it immediately after fetching.

    DISCONNECT DETECTION:
    `await request.is_disconnected()` returns True when the client closes the
    connection (browser tab closed, page navigated away, etc.). We check it
    at the top of each loop iteration to avoid orphaned server-side generators.
    """
    user_id = current_user.id

    async def event_generator():
        while True:
            # Bail out if client disconnected
            if await request.is_disconnected():
                break

            try:
                async with AsyncSessionLocal() as session:
                    tasks_rows = (
                        await session.execute(
                            select(Task).where(Task.user_id == user_id)
                        )
                    ).scalars().all()

                    habits_rows = (
                        await session.execute(
                            select(Habit).where(Habit.user_id == user_id)
                        )
                    ).scalars().all()

                    # Load HabitProgress for the rolling 7-day window so we can
                    # compute completionPercentage without a separate REST call.
                    # WHY HERE and not in habits_rows query:
                    # Habit.completions relationship is set to noload; eagerly
                    # loading it in every SSE cycle with selectinload would keep
                    # the session busy. A targeted date-bounded query is cheaper.
                    today = date.today()
                    week_start = today - timedelta(days=6)

                    if habits_rows:
                        habit_ids = [h.id for h in habits_rows]
                        progress_rows = (
                            await session.execute(
                                select(HabitProgress).where(
                                    HabitProgress.habit_id.in_(habit_ids),
                                    HabitProgress.date >= week_start,
                                    HabitProgress.date <= today,
                                )
                            )
                        ).scalars().all()
                    else:
                        progress_rows = []

                # Build completion % map — keyed by habit_id
                by_habit: dict[str, list[HabitProgress]] = defaultdict(list)
                for p in progress_rows:
                    by_habit[p.habit_id].append(p)

                tasks_payload = [
                    {
                        "id": t.id,
                        "title": t.title,
                        "status": t.status.value,
                        "dueDate": t.due_date.isoformat() if t.due_date else None,
                    }
                    for t in tasks_rows
                ]
                habits_payload = []
                for h in habits_rows:
                    cs = by_habit[h.id]
                    pct = (
                        round(sum(1 for c in cs if c.completed) / len(cs) * 100, 1)
                        if cs
                        else 0.0
                    )
                    habits_payload.append(
                        {
                            "id": h.id,
                            "name": h.name,
                            "frequency": h.frequency.value,
                            "streak": h.streak,
                            "completionPercentage": pct,
                        }
                    )

                data = {"tasks": tasks_payload, "habits": habits_payload}
                yield f"data: {json.dumps(data)}\n\n"
            except Exception:
                # Never crash the SSE stream on a transient DB error
                pass

            await asyncio.sleep(30)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
