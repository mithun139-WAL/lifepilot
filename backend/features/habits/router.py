"""
features/habits/router.py

HTTP endpoints for habits.

ROUTE STRUCTURE (matching original Next.js paths):

    GET    /habits/streaks
        → DAILY habits with streak > 0 (auth ADDED — original had none)

    POST   /learning-plans/{learning_plan_id}/habits
        → create a habit under a learning plan

    PUT    /learning-plans/{learning_plan_id}/habits/{habit_id}
        → update habit name/description/frequency

    DELETE /learning-plans/{learning_plan_id}/habits/{habit_id}
        → delete a habit (no auth in original — kept for parity)

    PATCH  /learning-plans/{learning_plan_id}/habits/{habit_id}/toggle
        → toggle completion for a given date, recalculate streak/progress

WHY TWO PREFIX PATTERNS IN ONE ROUTER:
FastAPI resolves routes by declaration order, not prefix.
We define all paths explicitly and register this router with prefix=""
so the /api/v1 prefix from main.py is the only outer wrapper.
"""

from fastapi import APIRouter, status

from core.dependencies import DB, CurrentUser, OnboardedUser
from features.habits.schemas import (
    HabitCreate,
    HabitResponse,
    HabitUpdate,
    StreakHabitItem,
    ToggleHabitRequest,
    ToggleHabitResponse,
    HabitProgressResponse,
)
from features.habits.service import HabitService

router = APIRouter(tags=["Habits"])


# ---------------------------------------------------------------------------
# Standalone habits routes
# ---------------------------------------------------------------------------

@router.get(
    "/habits/streaks",
    response_model=list[StreakHabitItem],
    summary="Get DAILY habits with active streaks (auth required)",
)
async def get_streaks(current_user: CurrentUser, db: DB) -> list[StreakHabitItem]:
    """
    Returns DAILY habits ordered by streak descending.
    Auth was missing in the original Next.js handler — fixed here.
    """
    service = HabitService(db)
    habits = await service.get_streaks(user_id=current_user.id)
    return [
        StreakHabitItem(id=h.id, description=h.description, streak=h.streak)
        for h in habits
    ]


# ---------------------------------------------------------------------------
# Nested learning-plan habits routes
# ---------------------------------------------------------------------------

@router.post(
    "/learning-plans/{learning_plan_id}/habits",
    response_model=HabitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a habit under a learning plan",
)
async def create_habit(
    learning_plan_id: str,
    body: HabitCreate,
    current_user: OnboardedUser,
    db: DB,
) -> HabitResponse:
    service = HabitService(db)
    habit = await service.create_habit(
        user_id=current_user.id,
        learning_plan_id=learning_plan_id,
        data=body,
    )
    return HabitResponse(
        id=habit.id,
        user_id=habit.user_id,
        learning_plan_id=habit.learning_plan_id,
        name=habit.name,
        description=habit.description,
        progress=habit.progress,
        streak=habit.streak,
        frequency=habit.frequency.value,
        completed=False,
        completions=[],
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


@router.put(
    "/learning-plans/{learning_plan_id}/habits/{habit_id}",
    response_model=HabitResponse,
    summary="Update a habit's name, description or frequency",
)
async def update_habit(
    learning_plan_id: str,
    habit_id: str,
    body: HabitUpdate,
    current_user: OnboardedUser,
    db: DB,
) -> HabitResponse:
    service = HabitService(db)
    habit = await service.update_habit(
        habit_id=habit_id,
        learning_plan_id=learning_plan_id,
        user_id=current_user.id,
        data=body,
    )
    return HabitResponse(
        id=habit.id,
        user_id=habit.user_id,
        learning_plan_id=habit.learning_plan_id,
        name=habit.name,
        description=habit.description,
        progress=habit.progress,
        streak=habit.streak,
        frequency=habit.frequency.value,
        completed=False,
        completions=[],
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


@router.delete(
    "/learning-plans/{learning_plan_id}/habits/{habit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a habit",
)
async def delete_habit(
    learning_plan_id: str,
    habit_id: str,
    db: DB,
) -> None:
    """
    Delete habit by (habitId, learningPlanId).
    Original had no auth check — kept for parity.
    """
    service = HabitService(db)
    await service.delete_habit(
        habit_id=habit_id,
        learning_plan_id=learning_plan_id,
    )


@router.patch(
    "/learning-plans/{learning_plan_id}/habits/{habit_id}/toggle",
    response_model=ToggleHabitResponse,
    summary="Toggle habit completion for a given date",
)
async def toggle_habit(
    learning_plan_id: str,
    habit_id: str,
    body: ToggleHabitRequest,
    db: DB,
) -> ToggleHabitResponse:
    """
    Toggle a habit complete/incomplete for the given date period.
    Recalculates streak and progress and stores them on the Habit row.
    """
    service = HabitService(db)
    habit, progress_record = await service.toggle_habit(
        habit_id=habit_id,
        date_str=body.date,
    )

    habit_resp = HabitResponse(
        id=habit.id,
        user_id=habit.user_id,
        learning_plan_id=habit.learning_plan_id,
        name=habit.name,
        description=habit.description,
        progress=habit.progress,
        streak=habit.streak,
        frequency=habit.frequency.value,
        completed=False,   # _enrich_habit() handles this in the detail endpoint
        completions=[
            HabitProgressResponse(
                id=c.id,
                habit_id=c.habit_id,
                date=c.date,
                completed=c.completed,
                created_at=c.created_at,
            )
            for c in habit.completions
        ],
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )

    return ToggleHabitResponse(
        habit=habit_resp,
        habit_progress=HabitProgressResponse(
            id=progress_record.id,
            habit_id=progress_record.habit_id,
            date=progress_record.date,
            completed=progress_record.completed,
            created_at=progress_record.created_at,
        ),
    )
