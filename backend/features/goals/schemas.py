"""
features/goals/schemas.py

Pydantic request and response schemas for goal endpoints.

CAMELCASE ALIASES:
The existing Next.js frontend sends { hoursPerDay, targetWeeks, preferredTime }
(camelCase) in request bodies. We use Field(alias=...) so Pydantic accepts those
keys, while storing them internally as snake_case Python attributes.

populate_by_name=True allows the field to be set via either its Python name
OR its alias — useful in tests and when calling services directly.

RESPONSE ENVELOPE:
The existing frontend code does:
    const response = await apiClient.get('/goals')
    setGoals(response.data)         ← accesses .data

So we wrap all responses in { data: ... } to preserve frontend compatibility
when flipping NEXT_PUBLIC_API_URL to point at FastAPI.

FIELD NAMES IN RESPONSES:
We use snake_case in GoalResponse (Python/FastAPI convention).
When we flip the frontend to FastAPI, we'll update field access:
    goal.hoursPerDay  →  goal.hours_per_day
This is a one-time, mechanical change.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    """Request body for POST /goals."""

    title: str = Field(..., min_length=1, max_length=500)
    hours_per_day: str = Field(..., alias="hoursPerDay", min_length=1)
    target_weeks: int = Field(..., alias="targetWeeks", ge=1, le=520)
    # Optional — if not supplied the service defaults to tomorrow at 09:00 UTC.
    # The /goal page sends null when the user skips the time picker; the
    # onboarding flow never collects a preferred time at all.
    preferred_time: Optional[datetime] = Field(None, alias="preferredTime")

    model_config = {
        "populate_by_name": True,  # Accept both hours_per_day and hoursPerDay
    }


class GoalUpdate(BaseModel):
    """
    Request body for PUT /goals/{id}.

    All fields optional — only provided (non-None) values are applied.
    This gives PUT patch-semantics, which matches the original Next.js handler.
    """

    title: str | None = Field(None, min_length=1, max_length=500)
    hours_per_day: str | None = Field(None, alias="hoursPerDay", min_length=1)
    target_weeks: int | None = Field(None, alias="targetWeeks", ge=1, le=520)
    preferred_time: datetime | None = Field(None, alias="preferredTime")

    model_config = {
        "populate_by_name": True,
    }


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class GoalResponse(BaseModel):
    """
    Shape of a single goal in API responses.

    from_attributes=True lets Pydantic read directly from the SQLAlchemy
    Goal ORM instance (goal.id, goal.hours_per_day, etc.) without manual mapping.
    """

    id: str
    user_id: str
    title: str
    hours_per_day: str
    target_weeks: int
    preferred_time: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class GoalDataResponse(BaseModel):
    """Single goal wrapped in { data: ... } envelope."""

    data: GoalResponse


class GoalListDataResponse(BaseModel):
    """List of goals wrapped in { data: [...] } envelope."""

    data: list[GoalResponse]


# ---------------------------------------------------------------------------
# Goal suggestions (AI-generated from user profile)
# ---------------------------------------------------------------------------

class GoalSuggestion(BaseModel):
    """A single AI-suggested goal derived from the user's profile preferences."""

    title: str
    """Concise, actionable goal statement (e.g. 'Build a full-stack web app with React and Node.js')."""

    description: str
    """1–2 sentence explanation of what the user will achieve."""

    emoji: str
    """Single emoji that represents the goal topic."""

    suggested_weeks: int = Field(alias="suggestedWeeks")
    """Estimated duration in weeks based on the user's pace and weekly hours."""

    hours_per_day: str = Field(alias="hoursPerDay")
    """Suggested daily time commitment label (e.g. '1 hour', '2 hours')."""

    model_config = {"populate_by_name": True}


class GoalSuggestionsResponse(BaseModel):
    """Response for POST /goals/suggest."""

    suggestions: list[GoalSuggestion]
