"""
features/planners/schemas.py

Schemas for the AI plan generation endpoint.

POST /planner takes a goalId and runs the 4-stage AI pipeline:
  1. Goal interpretation
  2. Roadmap generation
  3. Task generation (per week)
  4. Habits generation

Then saves everything via LearningPlanService.

The response mirrors the original Next.js response shape so the frontend
doesn't need to change when this endpoint is migrated.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PlannerGenerateRequest(BaseModel):
    goal_id: str = Field(..., alias="goalId")

    model_config = {"populate_by_name": True}


class PlannerGenerateResponse(BaseModel):
    """
    Matches the shape returned by the original POST /api/planner:
    {
      roadmap: { planner: [...] },
      tasks: [...],
      habits: { habits: [...] },
      savedPlan: { ... }   <- the LearningPlanResponse from the DB save
    }
    """
    roadmap: dict[str, Any]
    tasks: list[Any]
    habits: dict[str, Any]
    saved_plan: dict[str, Any] = Field(..., alias="savedPlan")

    model_config = {"populate_by_name": True}


class PlannerJobStartResponse(BaseModel):
    """
    Immediate HTTP 202 response from POST /planner.

    The 4-stage pipeline is queued as a background job.
    Poll GET /planner/jobs/{jobId} to check progress.
    """
    job_id: str = Field(..., alias="jobId")
    status: str = "processing"

    model_config = {"populate_by_name": True}


class PlannerJobStatusResponse(BaseModel):
    """
    Response from GET /planner/jobs/{jobId}.

    status: "processing" | "done" | "failed"
    result: populated when status == "done"; contains roadmap/tasks/habits/savedPlan
    error:  populated when status == "failed"
    """
    job_id: str = Field(..., alias="jobId")
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None

    model_config = {"populate_by_name": True}
