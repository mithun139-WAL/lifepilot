"""
features/learning_plans/schemas.py

Pydantic schemas for learning plan endpoints.

CREATION INPUT:
The POST /learning-plans body mirrors the original Next.js handler:
  { topic, goalId, planner, task_list, habits_list }
  
SECURITY FIX vs original:
The original handler accepted userId, accessToken, refreshToken in the request body.
We drop all three:
  - userId is taken from the JWT (no client trust)
  - accessToken/refreshToken for Google Calendar are read from the Account table

RESPONSE SHAPE:
Responses include the LearningPlan plus nested planners/habits for the detail view,
matching what the settings page and planner page expect.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Task/Checklist nested schemas (used inside planner responses)
# ---------------------------------------------------------------------------

class ChecklistResponse(BaseModel):
    id: str
    task_id: str
    title: str
    status: str
    description: str | None
    expected_time: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskResponse(BaseModel):
    id: str
    user_id: str
    planner_id: str
    title: str
    status: str
    description: str | None
    due_date: datetime | None
    preferred_time: datetime
    completed_at: datetime | None
    google_calendar_event_id: str | None
    checklists: list[ChecklistResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlannerResponse(BaseModel):
    id: str
    user_id: str
    learning_plan_id: str
    title: str
    description: str | None
    week: int
    start_date: datetime | None
    end_date: datetime | None
    progress: int
    tasks: list[TaskResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
    # completed: enriched field added at query time (not stored)
    completed: bool = False
    completions: list[HabitProgressResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LearningPlanCreate(BaseModel):
    """Request body for POST /learning-plans."""

    goal_id: str = Field(..., alias="goalId")
    topic: str = Field(..., min_length=1, max_length=500)
    # Raw AI-generated JSON blobs
    planner: list[Any] = Field(default_factory=list)
    task_list: list[Any] = Field(default_factory=list)
    habits_list: list[Any] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class LearningPlanUpdate(BaseModel):
    """Request body for PUT /learning-plans/{id}."""

    topic: str | None = Field(None, min_length=1, max_length=500)
    planner: list[Any] | None = None
    task_list: list[Any] | None = Field(None, alias="task_list")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class LearningPlanResponse(BaseModel):
    """Basic learning plan (without nested planners/habits)."""

    id: str
    user_id: str
    goal_id: str
    topic: str
    planner: Any
    task_list: Any
    habits_list: Any
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LearningPlanDetailResponse(BaseModel):
    """
    Full learning plan including nested planners (with tasks) and enriched habits.
    Matches the shape returned by GET /learning-plans/{id} in Next.js.
    """

    id: str
    user_id: str
    goal_id: str
    topic: str
    planner: Any
    task_list: Any
    habits_list: Any
    planners: list[PlannerResponse] = []
    habits: list[HabitResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
