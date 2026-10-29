"""
features/mood/service.py
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from features.mood.models import Mood
from features.mood.repository import MoodRepository
from features.mood.schemas import MoodCreate


class MoodService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = MoodRepository(db)

    async def create_mood(self, *, user_id: str, data: MoodCreate) -> Mood:
        return await self.repo.create_mood(user_id=user_id, mood=data.mood)

    async def get_moods(self, *, user_id: str, limit: int = 10) -> list[Mood]:
        return await self.repo.get_recent_moods(user_id, limit=limit)
