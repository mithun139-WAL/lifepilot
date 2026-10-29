"""
features/habits/schemas.py

Pydantic schemas for habit and habit-progress endpoints.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from core.enums import HabitFrequency


# ---------------------------------------------------------------------------
# Habit CRUD schemas
# ---------------------------------------------------------------------------

class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    frequency: HabitFrequency


class HabitUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    frequency: HabitFrequency


# ---------------------------------------------------------------------------
# Habit progress / toggle
# ---------------------------------------------------------------------------

class HabitProgressResponse(BaseModel):
    id: str
    habit_id: str
    date: datetime
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class HabitResponse(BaseModel):
    id: str
    user_id: str
    learning_plan_id: str
    name: str
    description: str | None
    progress: int
    streak: int
    frequency: str
    completed: bool = False          # computed — not stored
    completions: list[HabitProgressResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ToggleHabitRequest(BaseModel):
    date: str | None = None          # ISO date string; defaults to today


class ToggleHabitResponse(BaseModel):
    habit: HabitResponse
    habit_progress: HabitProgressResponse

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Streaks endpoint
# ---------------------------------------------------------------------------

class StreakHabitItem(BaseModel):
    id: str
    description: str | None
    streak: int

    model_config = {"from_attributes": True}
