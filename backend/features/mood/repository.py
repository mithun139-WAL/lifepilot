"""
features/mood/repository.py
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.mood.models import Mood


class MoodRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_mood(self, *, user_id: str, mood: str) -> Mood:
        entry = Mood(user_id=user_id, mood=mood)
        self.db.add(entry)
        await self.db.flush()
        await self.db.refresh(entry)
        return entry

    async def get_recent_moods(self, user_id: str, limit: int = 10) -> list[Mood]:
        result = await self.db.execute(
            select(Mood)
            .where(Mood.user_id == user_id)
            .order_by(Mood.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
