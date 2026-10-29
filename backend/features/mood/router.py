"""
features/mood/router.py

GET  /mood  → last 10 mood entries for the current user
POST /mood  → log a new mood entry
"""

from fastapi import APIRouter, status

from core.dependencies import DB, CurrentUser
from features.mood.schemas import MoodCreate, MoodResponse
from features.mood.service import MoodService

router = APIRouter(prefix="/mood", tags=["Mood"])


@router.get("", response_model=list[MoodResponse], summary="Get recent mood entries")
async def get_moods(current_user: CurrentUser, db: DB) -> list[MoodResponse]:
    service = MoodService(db)
    moods = await service.get_moods(user_id=current_user.id)
    return [MoodResponse.model_validate(m) for m in moods]


@router.post(
    "",
    response_model=MoodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a mood entry",
)
async def create_mood(
    body: MoodCreate, current_user: CurrentUser, db: DB
) -> MoodResponse:
    service = MoodService(db)
    entry = await service.create_mood(user_id=current_user.id, data=body)
    return MoodResponse.model_validate(entry)
