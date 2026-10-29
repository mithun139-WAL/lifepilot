from pydantic import BaseModel, Field
from typing import Optional


class OnboardingRequest(BaseModel):
    goal: str = Field(..., min_length=10, description="User's primary learning goal")
    skillLevel: str = Field(..., pattern="^(beginner|intermediate|advanced)$")
    weeklyHours: int = Field(..., ge=1, le=40)
    pace: str = Field(..., pattern="^(slow|steady|fast)$")
    deadline: Optional[str] = None
    preferredFormats: list[str] = Field(..., min_length=1)


class OnboardingResponse(BaseModel):
    message: str
    onboarding_complete: bool = True
