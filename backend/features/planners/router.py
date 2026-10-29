"""
features/planners/router.py

POST /planner  — queue the 4-stage AI pipeline as a background job.
GET  /planner/jobs/{job_id} — poll status of a queued job.

WHY BACKGROUND JOBS INSTEAD OF A BLOCKING RESPONSE:

The original synchronous design kept a single HTTP connection open for the
entire 15-minute pipeline.  Two things go wrong:
  1. OS-level TCP keepalive / proxy timeouts close the connection first.
  2. The browser's fetch() throws "Failed to fetch" when the connection drops.

The fix: decouple "start work" from "get result".

  POST /planner   → 202 Accepted  { jobId }          (returns in <100ms)
  GET  /planner/jobs/{jobId} → { status, result }    (poll every 3s)

The background task uses its own SQLAlchemy session (AsyncSessionLocal) so
it is fully independent of the request lifecycle.

IN-MEMORY JOB STORE:
  _jobs is a simple dict[str, dict] — sufficient for a single-process server.
  For multi-process deployments (gunicorn workers, k8s replicas) swap this for
  Redis with a TTL so jobs are visible across processes.

PARALLELISM NOTE:
  asyncio.gather in PlannerService.generate_plan() fires Stage 3 (all weeks)
  and Stage 4 (habits) simultaneously.  Combined with the 8B model for habits,
  total pipeline time drops from ~15 min to ~1–2 min.
"""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from core.database import AsyncSessionLocal
from core.dependencies import OnboardedUser
from features.planners.schemas import (
    PlannerGenerateRequest,
    PlannerJobStartResponse,
    PlannerJobStatusResponse,
)
from features.planners.service import PlannerService

router = APIRouter(prefix="/planner", tags=["Planner"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
# Keys:   job UUID strings
# Values: { status: str, result: dict | None, error: str | None }
_jobs: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# POST /planner  — queue the plan generation job
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=PlannerJobStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue AI plan generation (async background job)",
)
async def generate_plan(
    body: PlannerGenerateRequest,
    current_user: OnboardedUser,
    background_tasks: BackgroundTasks,
) -> PlannerJobStartResponse:
    """
    Queue the 4-stage AI pipeline as a background job and return immediately.

    The client should poll GET /planner/jobs/{jobId} every 3 seconds until
    status is "done" or "failed".
    """
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "processing", "result": None, "error": None}

    background_tasks.add_task(
        _run_plan_job,
        job_id,
        body.goal_id,
        current_user.id,
    )

    return PlannerJobStartResponse(jobId=job_id, status="processing")


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

async def _run_plan_job(job_id: str, goal_id: str, user_id: str) -> None:
    """
    Run the full plan generation pipeline in the background.

    Creates its own DB session — independent of the request that scheduled it.
    Updates _jobs[job_id] with the final status and result/error.
    """
    async with AsyncSessionLocal() as db:
        try:
            service = PlannerService(db)
            result = await service.generate_plan(goal_id=goal_id, user_id=user_id)
            await db.commit()
            _jobs[job_id] = {"status": "done", "result": result, "error": None}
            logger.info("Plan job %s completed successfully", job_id)
        except Exception as exc:
            await db.rollback()
            logger.error("Plan job %s failed: %s", job_id, exc, exc_info=True)
            _jobs[job_id] = {"status": "failed", "result": None, "error": str(exc)}


# ---------------------------------------------------------------------------
# GET /planner/jobs/{job_id}  — poll job status
# ---------------------------------------------------------------------------

@router.get(
    "/jobs/{job_id}",
    response_model=PlannerJobStatusResponse,
    summary="Poll plan generation job status",
)
async def get_plan_job(
    job_id: str,
    current_user: OnboardedUser,
) -> PlannerJobStatusResponse:
    """
    Return the current status of a background plan generation job.

    status: "processing" — still running, keep polling
    status: "done"       — result contains roadmap/tasks/habits/savedPlan
    status: "failed"     — error contains the failure message
    """
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found. It may have expired or never existed.",
        )

    return PlannerJobStatusResponse(
        jobId=job_id,
        status=job["status"],
        result=job.get("result"),
        error=job.get("error"),
    )
