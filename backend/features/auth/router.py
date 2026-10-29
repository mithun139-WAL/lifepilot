"""
features/auth/router.py

HTTP endpoints for authentication.

THE MENTAL MODEL:
Routers are THIN. They do:
1. Accept HTTP input (parse body, validate via Pydantic schema)
2. Call the service
3. Return an HTTP response

They do NOT:
- Contain business logic
- Access the database directly
- Call other services
- Know about password hashing, token generation, etc.

This keeps your router readable as "what endpoints exist and what they accept"
without burying the logic in what should be a routing concern.

MERN COMPARISON:
This is your Express controller, but stripped of all logic.
The Express pattern often bleeds business logic into controllers.
FastAPI's pattern enforces the boundary.

RESPONSE MODELS:
`response_model=XxxResponse` on each endpoint:
- Tells FastAPI to serialize the response through that Pydantic schema
- Strips any fields not in the schema (security: won't leak password_hash)
- Documents the response shape in the auto-generated OpenAPI docs
- Acts as a type contract between backend and frontend
"""

from fastapi import APIRouter, Depends, status

from core.dependencies import CurrentUser, DB
from features.auth.schemas import (
    LoginRequest,
    MeResponse,
    MessageResponse,
    ProfileUpdateRequest,
    RefreshTokenRequest,
    ResendVerificationRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserProfileResponse,
    VerifyEmailRequest,
)
from features.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def signup(body: SignupRequest, db: DB) -> SignupResponse:
    """
    Register a new user with email and password.
    
    - Creates user account
    - Sends verification email
    - User must verify email before signing in
    """
    service = AuthService(db)
    user = await service.register_user(
        name=body.name,
        email=body.email,
        password=body.password,
    )
    return SignupResponse(
        message="Account created. Please check your email to verify your address.",
        user_id=user.id,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Sign in with email and password",
)
async def login(body: LoginRequest, db: DB) -> TokenResponse:
    """
    Authenticate with email + password credentials.
    
    Returns access and refresh JWT tokens.
    """
    service = AuthService(db)
    return await service.login_user(email=body.email, password=body.password)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
async def refresh_token(body: RefreshTokenRequest, db: DB) -> TokenResponse:
    """
    Exchange a valid refresh token for new access + refresh tokens.
    
    Call this when the access token expires (check the `expires_in` field
    returned on login, or catch 401 responses).
    """
    service = AuthService(db)
    return await service.refresh_tokens(refresh_token=body.refresh_token)


@router.post(
    "/verify-email",
    response_model=MessageResponse,
    summary="Verify email address",
)
async def verify_email(body: VerifyEmailRequest, db: DB) -> MessageResponse:
    """
    Verify a user's email using the token from the verification email.
    
    Token is single-use and expires after 24 hours.
    """
    service = AuthService(db)
    await service.verify_email(token=body.token)
    return MessageResponse(message="Email verified successfully. You can now sign in.")


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    summary="Resend verification email",
)
async def resend_verification(body: ResendVerificationRequest, db: DB) -> MessageResponse:
    """
    Resend the verification email to an unverified address.
    
    Returns success even if the email is not registered (prevents enumeration).
    """
    service = AuthService(db)
    await service.resend_verification_email(email=body.email)
    return MessageResponse(
        message="If that email is registered and unverified, a new verification link has been sent."
    )


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current user profile",
)
async def get_me(current_user: CurrentUser) -> MeResponse:
    """
    Return the currently authenticated user's profile.
    
    Requires: Authorization: Bearer <access_token>
    """
    return MeResponse(user=UserProfileResponse.model_validate(current_user))


@router.put(
    "/profile",
    response_model=MeResponse,
    summary="Update user profile and preferences",
)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: DB,
) -> MeResponse:
    """
    Update the authenticated user's profile fields and/or learning preferences.

    All fields are optional — only provided (non-None) fields are applied.
    This mirrors PATCH semantics: the client sends only what changed.

    Preferences updated here (skillLevel, weeklyHours, pace, deadline,
    preferredFormats) are the same fields set during onboarding. Updating
    them here lets the user refine their profile as they grow without
    re-running the full onboarding wizard.
    """
    from datetime import UTC, datetime as dt
    from features.auth.repository import AuthRepository

    repo = AuthRepository(db)

    # Build a dict of only the fields that were explicitly provided
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.image is not None:
        updates["image"] = body.image
    if body.skill_level is not None:
        updates["skill_level"] = body.skill_level
    if body.weekly_hours is not None:
        updates["weekly_hours"] = body.weekly_hours
    if body.pace is not None:
        updates["pace"] = body.pace
    if body.preferred_formats is not None:
        updates["preferred_formats"] = body.preferred_formats
    if body.deadline is not None:
        # Parse ISO date string → timezone-aware datetime
        try:
            updates["deadline"] = dt.fromisoformat(body.deadline).replace(tzinfo=UTC)
        except ValueError:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="deadline must be a valid ISO 8601 date string (e.g. '2025-12-31')",
            )

    if not updates:
        # Nothing to update — return current profile as-is
        return MeResponse(user=UserProfileResponse.model_validate(current_user))

    updated_user = await repo.update_user(current_user.id, **updates)
    if updated_user is None:
        updated_user = current_user  # fallback (shouldn't happen)

    await db.commit()
    await db.refresh(updated_user)
    return MeResponse(user=UserProfileResponse.model_validate(updated_user))
