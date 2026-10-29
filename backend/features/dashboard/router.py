"""
features/dashboard/router.py

Dashboard stats endpoint — the data that powers the main dashboard page.

ROUTE MAP:
  GET /dashboard/stats  → life score + today's habits/tasks + recent mood
  GET /suggestions      → AI-generated personalized nudges for the dashboard

LIFE SCORE FORMULA (ported exactly from Next.js):
  taskScore  = (completedToday / totalToday) × 40   (default: 40 if no tasks)
  habitScore = (completedHabits / totalHabits) × 40  (default: 40 if no habits)
  moodScore  = 10 (neutral/none) | 20 (positive) | 5 (negative)
  lifeScore  = taskScore + habitScore + moodScore   (0–100)

RESPONSE FORMAT:
  Wraps response in { success: true, data: { ... } } to match the existing
  Next.js format that the frontend reads as `response.data`.

HABIT "DONE TODAY" LOGIC:
  A habit is considered done today if it has at least one HabitProgress record
  with `date >= today_start`. This matches the Next.js `h.completions.length > 0`
  check (which also filters completions to today via the Prisma `where` clause).
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, time as time_obj

from fastapi import APIRouter
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select

from ai.llm import LLMUseCase, get_llm_for
from ai.prompts import suggestions_prompt
from core.dependencies import DB, CurrentUser
from core.enums import TaskStatus
from features.goals.models import Goal
from features.habits.models import Habit, HabitProgress
from features.mood.models import Mood
from features.tasks.models import Task

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Dashboard"])

# Positive / negative mood keywords (ported from Next.js)
_POSITIVE_MOODS = {"happy", "great", "motivate", "motivated", "excited", "good"}
_NEGATIVE_MOODS = {"stressed", "tired", "sad", "anxious", "overwhelmed", "bad"}

# Fallback suggestions shown when the LLM call fails or returns bad JSON.
_FALLBACK_SUGGESTIONS: list[dict] = [
    {"text": "Review your active goal and pick one task to finish today", "emoji": "🎯"},
    {"text": "Log your mood to keep your life score accurate", "emoji": "📊"},
    {"text": "Check off one habit before the day ends", "emoji": "✅"},
]


def _mood_score(mood_str: str) -> int:
    """
    Map a free-form mood string to a 0–20 score.

    The Next.js formula used `includes()` substring matching, so "motivated"
    matches "motivate". We replicate that with `in` on lowercased words.
    """
    m = mood_str.lower()
    for pos in _POSITIVE_MOODS:
        if pos in m:
            return 20
    for neg in _NEGATIVE_MOODS:
        if neg in m:
            return 5
    return 10  # neutral default


@router.get(
    "/dashboard/stats",
    summary="Dashboard stats: life score, habits, tasks, mood",
)
async def dashboard_stats(current_user: CurrentUser, db: DB) -> dict:
    """
    Returns the composite dashboard payload:

    {
      success: true,
      data: {
        lifeScore: 0-100,
        habits: [{ name, done }],
        recentMood: { mood, createdAt } | null,
        upcomingTasks: [{ title, dueDate }],
      }
    }

    Five DB queries run in sequence (safe on a single AsyncSession):
    1. All habits for user (with today's completions loaded)
    2. Most recent mood entry
    3. Next 3 upcoming PENDING tasks
    4. Count of all tasks due today
    5. Count of tasks COMPLETED today (by completedAt)

    WHY SEQUENTIAL INSTEAD OF asyncio.gather:
    SQLAlchemy's AsyncSession wraps a single underlying connection.
    Running concurrent coroutines on the same session can cause the connection
    to be used from multiple coroutines simultaneously, which is undefined
    behavior. Sequential queries are safe and add only ~1-2ms total for
    5 simple SELECT statements.
    """
    user_id = current_user.id

    today_start = datetime.combine(date.today(), time_obj.min)
    today_end = datetime.combine(date.today(), time_obj.max)

    # 1a. All habits for this user
    habits_result = await db.execute(
        select(Habit).where(Habit.user_id == user_id)
    )
    habits = habits_result.scalars().all()

    # 1b. Today's completions for those habits — a single IN query
    habit_ids = [h.id for h in habits]
    today_completions: set[str] = set()
    if habit_ids:
        comp_result = await db.execute(
            select(HabitProgress.habit_id)
            .where(
                HabitProgress.habit_id.in_(habit_ids),
                HabitProgress.date >= today_start,
            )
            .distinct()
        )
        today_completions = {row for (row,) in comp_result.all()}

    # 2. Most recent mood
    mood_result = await db.execute(
        select(Mood)
        .where(Mood.user_id == user_id)
        .order_by(Mood.created_at.desc())
        .limit(1)
    )
    recent_mood = mood_result.scalar_one_or_none()

    # 3. Next 3 upcoming PENDING tasks (due in the future, ordered by due_date)
    upcoming_result = await db.execute(
        select(Task.title, Task.due_date)
        .where(
            Task.user_id == user_id,
            Task.status == TaskStatus.PENDING,
            Task.due_date >= datetime.utcnow(),
        )
        .order_by(Task.due_date.asc())
        .limit(3)
    )
    upcoming_tasks = upcoming_result.all()

    # 4. Total tasks due today
    total_today_result = await db.execute(
        select(Task.id)
        .where(
            Task.user_id == user_id,
            Task.due_date >= today_start,
            Task.due_date <= today_end,
        )
    )
    total_today = len(total_today_result.all())

    # 5. Tasks completed today (completedAt within today)
    completed_today_result = await db.execute(
        select(Task.id)
        .where(
            Task.user_id == user_id,
            Task.status == TaskStatus.COMPLETED,
            Task.completed_at >= today_start,
        )
    )
    completed_today = len(completed_today_result.all())

    # ------------------------------------------------------------------
    # Life score calculation
    # ------------------------------------------------------------------
    # 40% task completion + 40% habit completion + 20% mood
    task_score = (completed_today / total_today * 40) if total_today > 0 else 40
    completed_habits = len(today_completions)
    habit_score = (completed_habits / len(habits) * 40) if habits else 40
    m_score = _mood_score(recent_mood.mood) if recent_mood else 10
    life_score = round(task_score + habit_score + m_score)

    return {
        "success": True,
        "data": {
            "lifeScore": life_score,
            "habits": [
                {"name": h.name, "done": h.id in today_completions}
                for h in habits
            ],
            "recentMood": (
                {
                    "mood": recent_mood.mood,
                    "createdAt": recent_mood.created_at.isoformat(),
                }
                if recent_mood
                else None
            ),
            "upcomingTasks": [
                {
                    "title": title,
                    "dueDate": due_date.isoformat() if due_date else None,
                }
                for title, due_date in upcoming_tasks
            ],
        },
    }


# ---------------------------------------------------------------------------
# Smart Suggestions
# ---------------------------------------------------------------------------

def _parse_suggestions(raw: str) -> list[dict]:
    """
    Extract the first JSON array from LLM output.

    Handles:
      - Markdown code fences (```json ... ```)
      - Preamble text before the array
      - Trailing explanation after the array

    Returns empty list on any parse failure — caller uses fallback suggestions.
    """
    # Strip markdown fences
    text = re.sub(r"```(?:json)?\s*", "", raw).strip()

    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end <= start:
        return []

    try:
        result = json.loads(text[start : end + 1])
        if isinstance(result, list):
            # Validate each item has text + emoji
            return [
                {"text": str(item["text"]), "emoji": str(item["emoji"])}
                for item in result
                if isinstance(item, dict) and "text" in item and "emoji" in item
            ]
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    return []


@router.get(
    "/suggestions",
    summary="AI-generated personalized suggestions for the dashboard",
)
async def get_suggestions(current_user: CurrentUser, db: DB) -> dict:
    """
    Returns 3–5 personalized, actionable suggestions powered by the fast 8B model.

    Context gathered for the LLM (all via lightweight DB queries):
      - User's active goal titles
      - Today's pending/completed task titles
      - Habit names + whether done today
      - Most recent mood entry

    RESPONSE FORMAT:
    {
      "success": true,
      "data": [
        { "text": "Finish your RAG pipeline task before 3 PM", "emoji": "🔗" },
        ...
      ]
    }

    FAILURE HANDLING:
    If the LLM call fails or returns unparseable output, falls back to a set
    of generic-but-useful fallback suggestions so the UI is never broken.

    WHY 8B MODEL:
    The input is ~200 tokens (task/habit titles, mood). Output is 3 bullet points.
    Using Nemotron-70B here would be 10× more expensive for no quality gain.
    """
    user_id = current_user.id
    today_start = datetime.combine(date.today(), time_obj.min)

    # 1. User's active goal titles
    goals_result = await db.execute(
        select(Goal.title).where(Goal.user_id == user_id)
    )
    goal_titles: list[str] = [row for (row,) in goals_result.all()]

    # 2. Today's tasks (title + status)
    today_tasks_result = await db.execute(
        select(Task.title, Task.status)
        .where(
            Task.user_id == user_id,
            Task.due_date >= today_start,
        )
        .limit(10)
    )
    today_tasks = [
        {"title": title, "status": status.value if hasattr(status, "value") else str(status)}
        for title, status in today_tasks_result.all()
    ]

    # 3. Habits + done-today status
    habits_result = await db.execute(
        select(Habit).where(Habit.user_id == user_id)
    )
    habits = habits_result.scalars().all()

    habit_ids = [h.id for h in habits]
    today_completions: set[str] = set()
    if habit_ids:
        comp_result = await db.execute(
            select(HabitProgress.habit_id)
            .where(
                HabitProgress.habit_id.in_(habit_ids),
                HabitProgress.date >= today_start,
            )
            .distinct()
        )
        today_completions = {row for (row,) in comp_result.all()}

    habits_ctx = [
        {"name": h.name, "done": h.id in today_completions}
        for h in habits
    ]

    # 4. Most recent mood
    mood_result = await db.execute(
        select(Mood.mood)
        .where(Mood.user_id == user_id)
        .order_by(Mood.created_at.desc())
        .limit(1)
    )
    mood_row = mood_result.scalar_one_or_none()
    recent_mood: str | None = mood_row if mood_row else None

    # ------------------------------------------------------------------
    # LLM call — fast 8B model, graceful fallback on any failure
    # ------------------------------------------------------------------
    try:
        prompt = suggestions_prompt(
            goals=goal_titles,
            today_tasks=today_tasks,
            habits=habits_ctx,
            recent_mood=recent_mood,
        )
        llm = get_llm_for(LLMUseCase.SUGGESTIONS)
        messages = [
            SystemMessage(content=prompt["system"]),
            HumanMessage(content=prompt["user"]),
        ]
        response = await llm.ainvoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)
        logger.debug("[Suggestions] raw LLM output: %s", raw[:500])

        suggestions = _parse_suggestions(raw)
        if not suggestions:
            logger.warning("[Suggestions] LLM returned unparseable output — using fallback")
            suggestions = _FALLBACK_SUGGESTIONS

    except Exception as exc:
        logger.error("[Suggestions] LLM call failed — using fallback: %s", exc)
        suggestions = _FALLBACK_SUGGESTIONS

    return {"success": True, "data": suggestions}
