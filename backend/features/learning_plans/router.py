"""
features/learning_plans/router.py

HTTP endpoints for learning plan management.

ENDPOINTS:
    GET    /learning-plans              → list all plans (with nested data)
    POST   /learning-plans              → create plan + habits + planners + tasks
    GET    /learning-plans/{plan_id}    → single plan with enriched habits
    PUT    /learning-plans/{plan_id}    → update topic/planner/task_list JSON
    DELETE /learning-plans/{plan_id}    → delete plan + cascade

POST COMPLEXITY NOTE:
The create endpoint is heavyweight — it creates several rows atomically.
The session is auto-committed by FastAPI's DB dependency after the handler
returns without raising an exception.
"""

from fastapi import APIRouter, status

from core.dependencies import DB, OnboardedUser
from features.habits.models import Habit
from features.learning_plans.schemas import (
    HabitResponse,
    LearningPlanCreate,
    LearningPlanDetailResponse,
    LearningPlanResponse,
    LearningPlanUpdate,
    PlannerResponse,
    TaskResponse,
    ChecklistResponse,
)
from features.learning_plans.service import LearningPlanService
from features.planners.models import Planner

router = APIRouter(prefix="/learning-plans", tags=["Learning Plans"])


def _enrich_habit(habit: Habit) -> HabitResponse:
    """
    Add the computed `completed` field to a habit.

    completed = True if the habit has been marked complete today (DAILY)
    or this week (WEEKLY).

    Ported from isHabitCompleted() in src/lib/utils.ts.
    """
    from datetime import datetime, timedelta

    now = datetime.now()

    # Start/end of today
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Start/end of current week (Monday–Sunday)
    week_start = today_start - timedelta(days=today_start.weekday())
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)

    completed = False
    for c in habit.completions:
        if not c.completed:
            continue
        c_date = c.date
        # Make naive for comparison if needed
        if hasattr(c_date, "tzinfo") and c_date.tzinfo is not None:
            c_date = c_date.replace(tzinfo=None)

        if habit.frequency.value == "DAILY":
            if today_start <= c_date <= today_end:
                completed = True
                break
        else:  # WEEKLY
            if week_start <= c_date <= week_end:
                completed = True
                break

    return HabitResponse(
        id=habit.id,
        user_id=habit.user_id,
        learning_plan_id=habit.learning_plan_id,
        name=habit.name,
        description=habit.description,
        progress=habit.progress,
        streak=habit.streak,
        frequency=habit.frequency.value,
        completed=completed,
        completions=[
            from_habit_progress(c) for c in habit.completions
        ],
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


def from_habit_progress(c):
    from features.learning_plans.schemas import HabitProgressResponse
    return HabitProgressResponse(
        id=c.id,
        habit_id=c.habit_id,
        date=c.date,
        completed=c.completed,
        created_at=c.created_at,
    )


@router.get(
    "",
    response_model=list[LearningPlanResponse],
    summary="List all learning plans for the current user",
)
async def list_learning_plans(
    current_user: OnboardedUser,
    db: DB,
) -> list[LearningPlanResponse]:
    service = LearningPlanService(db)
    plans = await service.list_plans(user_id=current_user.id)
    return [LearningPlanResponse.model_validate(p) for p in plans]


@router.post(
    "",
    response_model=LearningPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a learning plan with planners, tasks, and habits",
)
async def create_learning_plan(
    body: LearningPlanCreate,
    current_user: OnboardedUser,
    db: DB,
) -> LearningPlanResponse:
    service = LearningPlanService(db)
    plan = await service.create_plan(user_id=current_user.id, data=body)
    return LearningPlanResponse.model_validate(plan)


@router.get(
    "/{plan_id}",
    response_model=LearningPlanDetailResponse,
    summary="Get a learning plan with full nested data and enriched habits",
)
async def get_learning_plan(
    plan_id: str,
    current_user: OnboardedUser,
    db: DB,
) -> LearningPlanDetailResponse:
    service = LearningPlanService(db)
    plan = await service.get_plan(plan_id=plan_id, user_id=current_user.id)

    # Build enriched habits
    enriched_habits = [_enrich_habit(h) for h in plan.habits]

    # Build planner responses with tasks
    planner_responses = [
        PlannerResponse(
            id=p.id,
            user_id=p.user_id,
            learning_plan_id=p.learning_plan_id,
            title=p.title,
            description=p.description,
            week=p.week,
            start_date=p.start_date,
            end_date=p.end_date,
            progress=p.progress,
            tasks=[TaskResponse.model_validate(t) for t in p.tasks],
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in plan.planners
    ]

    return LearningPlanDetailResponse(
        id=plan.id,
        user_id=plan.user_id,
        goal_id=plan.goal_id,
        topic=plan.topic,
        planner=plan.planner,
        task_list=plan.task_list,
        habits_list=plan.habits_list,
        planners=planner_responses,
        habits=enriched_habits,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


@router.put(
    "/{plan_id}",
    response_model=LearningPlanResponse,
    summary="Update a learning plan's topic or AI-generated JSON",
)
async def update_learning_plan(
    plan_id: str,
    body: LearningPlanUpdate,
    current_user: OnboardedUser,
    db: DB,
) -> LearningPlanResponse:
    service = LearningPlanService(db)
    plan = await service.update_plan(
        plan_id=plan_id, user_id=current_user.id, data=body
    )
    return LearningPlanResponse.model_validate(plan)


@router.delete(
    "/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a learning plan and all related data",
)
async def delete_learning_plan(
    plan_id: str,
    current_user: OnboardedUser,
    db: DB,
) -> None:
    service = LearningPlanService(db)
    await service.delete_plan(plan_id=plan_id, user_id=current_user.id)
