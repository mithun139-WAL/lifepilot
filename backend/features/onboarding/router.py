from fastapi import APIRouter

from core.dependencies import CurrentUser, DB
from features.onboarding.schemas import OnboardingRequest, OnboardingResponse
from features.onboarding.service import complete_onboarding

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.post("", response_model=OnboardingResponse)
async def onboarding(
    body: OnboardingRequest,
    current_user: CurrentUser,
    db: DB,
) -> OnboardingResponse:
    """
    Save onboarding preferences and mark the account as fully set up.
    Frontend redirects to /dashboard after this succeeds.
    """
    await complete_onboarding(db=db, user_id=current_user.id, data=body)
    return OnboardingResponse(message="Onboarding complete.")
