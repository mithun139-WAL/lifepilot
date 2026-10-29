"""
features/auth/schemas.py

Pydantic request and response schemas for auth endpoints.

THE MENTAL MODEL (MERN comparison):
In Express you might use Joi or Zod for request validation.
Pydantic schemas serve the same purpose BUT also:
- Auto-generate OpenAPI documentation
- Provide response serialization (control exactly what the client sees)
- Are the API contract — your frontend TypeScript types should be generated from these

THE CRITICAL DISTINCTION: Models vs Schemas
- SQLAlchemy Model = database representation (has DB-specific fields, relationships)
- Pydantic Schema = API representation (what comes in and goes out over HTTP)

NEVER return SQLAlchemy model objects directly from your routes.
Always serialize through a Pydantic schema.
This prevents:
- Accidentally leaking password_hash in a response
- Over-fetching (sending huge nested objects when the client just needs an ID)
- Tight coupling between your DB structure and your API contract

SCHEMA NAMING CONVENTION:
- XxxRequest  → body of incoming requests
- XxxResponse → what the client receives
- XxxCreate   → data needed to create (subset of full model)
- XxxUpdate   → data for updates (all fields Optional)
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
class SignupRequest(BaseModel):
    """Request body for POST /auth/signup."""

    name: str = Field(..., min_length=1, max_length=100, examples=["John Doe"])
    email: EmailStr = Field(..., examples=["john@example.com"])
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Password strength rules — matches your existing validatePasswordStrength() in lib/password.ts
        
        Rules:
        - At least 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        """
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        special_chars = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
        if not any(c in special_chars for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class SignupResponse(BaseModel):
    """Response for successful signup."""

    message: str
    user_id: str


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    """Request body for POST /auth/login (credentials flow)."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """
    Response containing JWT tokens.
    
    SECURITY NOTE:
    The refresh token should ideally be set as an httpOnly cookie,
    not in the response body. However, to maintain compatibility with
    your existing Next.js frontend which stores tokens client-side,
    we include it here for now.
    
    httpOnly cookie migration = Phase 2 security hardening.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------
class RefreshTokenRequest(BaseModel):
    """Request body for POST /auth/refresh."""

    refresh_token: str


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
class VerifyEmailRequest(BaseModel):
    """Request body for POST /auth/verify-email."""

    token: str


class ResendVerificationRequest(BaseModel):
    """Request body for POST /auth/resend-verification."""

    email: EmailStr


# ---------------------------------------------------------------------------
# Password
# ---------------------------------------------------------------------------
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


# ---------------------------------------------------------------------------
# User responses
# ---------------------------------------------------------------------------
class UserProfileResponse(BaseModel):
    """
    Safe user representation for API responses.
    
    CRITICALLY: password_hash is NOT included here.
    This is the only way the frontend should ever see user data.
    """

    id: str
    name: str | None
    email: str
    image: str | None
    is_verified: bool
    onboarding_complete: bool
    skill_level: str | None
    weekly_hours: int | None
    pace: str | None
    deadline: datetime | None
    preferred_formats: dict | list | None
    created_at: datetime

    model_config = {
        "from_attributes": True,  # Allows Pydantic to read from SQLAlchemy model attributes
    }


class MeResponse(BaseModel):
    """Response for GET /auth/me — the currently authenticated user."""

    user: UserProfileResponse


# ---------------------------------------------------------------------------
# Generic responses
# ---------------------------------------------------------------------------
class MessageResponse(BaseModel):
    """Simple success message response."""

    message: str


# ---------------------------------------------------------------------------
# Profile update
# ---------------------------------------------------------------------------
class ProfileUpdateRequest(BaseModel):
    """
    Request body for PUT /auth/profile.

    All fields are optional — only provided fields are applied (PATCH semantics
    via a PUT endpoint). This keeps the client simple: send only what changed.

    Validation mirrors the onboarding schema so preferences stay consistent.
    """

    name: str | None = Field(None, min_length=1, max_length=100)
    image: str | None = Field(None)
    skill_level: str | None = Field(
        None,
        alias="skillLevel",
        pattern="^(beginner|intermediate|advanced)$",
    )
    weekly_hours: int | None = Field(None, alias="weeklyHours", ge=1, le=40)
    pace: str | None = Field(
        None,
        alias="pace",
        pattern="^(slow|steady|fast)$",
    )
    deadline: str | None = Field(None, alias="deadline")
    preferred_formats: list[str] | None = Field(None, alias="preferredFormats")

    model_config = {"populate_by_name": True}
