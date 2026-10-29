"""
features/tasks/schemas.py

Pydantic schemas for task and checklist endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from core.enums import TaskStatus


# ---------------------------------------------------------------------------
# Checklist schemas
# ---------------------------------------------------------------------------

class ChecklistItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    status: TaskStatus = TaskStatus.PENDING
    description: str | None = None
    expected_time: str | None = Field(None, alias="expectedTime")

    model_config = {"populate_by_name": True}


class ChecklistItemUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    status: TaskStatus | None = None
    description: str | None = None
    expected_time: str | None = Field(None, alias="expectedTime")

    model_config = {"populate_by_name": True}


class ChecklistResponse(BaseModel):
    id: str
    task_id: str
    title: str
    status: TaskStatus
    description: str | None
    expected_time: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Task schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    """Request body for POST /tasks."""

    planner_id: str = Field(..., alias="plannerId")
    title: str = Field(..., min_length=1, max_length=500)
    status: TaskStatus = TaskStatus.PENDING
    description: str | None = None
    due_date: str | None = Field(None, alias="dueDate")
    completed_at: str | None = Field(None, alias="completedAt")
    checklists: list[ChecklistItemCreate] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class TaskUpdate(BaseModel):
    """Request body for PUT /tasks/{taskId}."""

    planner_id: str = Field(..., alias="plannerId")
    title: str = Field(..., min_length=1, max_length=500)
    status: TaskStatus
    description: str | None = None
    due_date: str | None = Field(None, alias="dueDate")
    completed_at: str | None = Field(None, alias="completedAt")

    model_config = {"populate_by_name": True}


class TaskResponse(BaseModel):
    id: str
    user_id: str
    planner_id: str
    title: str
    status: TaskStatus
    description: str | None
    due_date: datetime | None
    preferred_time: datetime
    completed_at: datetime | None
    google_calendar_event_id: str | None
    checklists: list[ChecklistResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskDataResponse(BaseModel):
    """Single task wrapped in { data: ... } envelope."""
    data: TaskResponse


# ---------------------------------------------------------------------------
# Today / focus schemas
# ---------------------------------------------------------------------------

class TodayTaskItem(BaseModel):
    id: str
    title: str
    description: str | None
    status: TaskStatus
    preferred_time: datetime
    completed_at: datetime | None
    learning_plan_title: str = ""

    model_config = {"from_attributes": True}


class TodayTasksResponse(BaseModel):
    tasks: list[TodayTaskItem]


class FocusResponse(BaseModel):
    focus: int  # 0–100 percentage


# ---------------------------------------------------------------------------
# Checklist update cascade response
# ---------------------------------------------------------------------------

class ChecklistUpdateResponse(BaseModel):
    """
    Response for PUT /tasks/{taskId}/checklists/{checklistId}.
    Returns the updated checklist, task, and planner progress.
    Matches the original Next.js response shape.
    """
    checklist: ChecklistResponse
    task: TaskResponse
    progress: int
