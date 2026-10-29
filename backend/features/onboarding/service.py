from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from features.auth.models import User
from features.onboarding.schemas import OnboardingRequest


async def complete_onboarding(
    *,
    db: AsyncSession,
    user_id: str,
    data: OnboardingRequest,
) -> None:
    """
    Persist onboarding preferences onto the User row and mark
    onboarding_complete = True.

    deadline arrives as an ISO date string (e.g. "2025-12-31") or empty string.
    We parse it to an aware datetime; if blank/invalid we leave it as None.
    """
    deadline: datetime | None = None
    if data.deadline:
        try:
            deadline = datetime.fromisoformat(data.deadline).replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            deadline = None

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            skill_level=data.skillLevel,
            weekly_hours=data.weeklyHours,
            pace=data.pace,
            deadline=deadline,
            preferred_formats=data.preferredFormats,
            onboarding_complete=True,
        )
    )
    await db.commit()
