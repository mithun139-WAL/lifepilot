"""
features/mood/schemas.py
"""

from datetime import datetime
from pydantic import BaseModel, Field


class MoodCreate(BaseModel):
    mood: str = Field(..., min_length=1, max_length=100)


class MoodResponse(BaseModel):
    id: str
    user_id: str
    mood: str
    created_at: datetime

    model_config = {"from_attributes": True}
