"""
core/dependencies.py

FastAPI dependency injection definitions.

THE MENTAL MODEL (MERN comparison):
In Express, you use middleware functions that run before your route handler:
    app.use(authMiddleware)
    router.get('/profile', authMiddleware, handler)

FastAPI's Depends() is more powerful:
- Dependencies are declared per-route (or per-router for groups)
- They can have their own dependencies (chained)
- They can be async
- FastAPI resolves the entire dependency tree before calling the handler
- They're testable — you can override any dependency in tests

DEPENDENCY INJECTION EXPLAINED:
When you write:
    async def get_profile(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        
FastAPI sees the Depends() declarations and:
1. Calls get_db() → yields AsyncSession
2. Calls get_current_user(db=<the session>) → returns User object
3. Calls your handler with both already resolved

This happens for EVERY request, without you wiring anything manually.
"""

from typing import Annotated

import logging

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

_log = logging.getLogger(__name__)

from core.database import get_db
from core.security import get_user_id_from_token

# We use TYPE_CHECKING to avoid a circular import.
# features/auth/models.py imports from core/database.py.
# If we imported User here directly, we'd have:
#   core/dependencies.py → features/auth/models.py → core/database.py → core/dependencies.py
# TYPE_CHECKING is only evaluated by type checkers (mypy), not at runtime.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from features.auth.models import User


# ---------------------------------------------------------------------------
# HTTP Bearer scheme
# ---------------------------------------------------------------------------
# This tells FastAPI to expect: Authorization: Bearer <token>
# auto_error=False means we handle the 401 ourselves with a better message.
bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Core auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User":
    """
    Extract and verify the current user from the Authorization header.
    
    This is the primary auth guard. Any route that includes this dependency
    is protected — unauthenticated requests receive HTTP 401.
    
    Flow:
    1. Extract Bearer token from Authorization header
    2. Decode and verify the JWT signature + expiry
    3. Extract user_id from "sub" claim
    4. Load the User from the database
    5. Verify the user exists and is active
    6. Return the User object to the route handler
    
    IMPORTANT: We always re-query the user from DB (step 4).
    We do NOT trust user data stored in the token.
    Reason: if a user is banned or deleted, their existing tokens would
    still carry stale data if we trusted the token payload.
    The small DB query cost is worth the security correctness.
    """
    # Lazy import to break the circular dependency at runtime
    from features.auth.repository import AuthRepository

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        _log.warning("AUTH 401: No credentials / malformed Bearer header")
        raise credentials_exception

    try:
        user_id = get_user_id_from_token(credentials.credentials)
    except JWTError as e:
        _log.warning("AUTH 401: JWT decode failed — %s | token_prefix=%s", e, credentials.credentials[:20] if credentials.credentials else "EMPTY")
        raise credentials_exception

    repo = AuthRepository(db)
    user = await repo.get_user_by_id(user_id)

    if user is None:
        _log.warning("AUTH 401: user_id=%s not found in DB", user_id)
        raise credentials_exception

    if not user.is_verified:
        _log.warning("AUTH 403: user_id=%s email not verified", user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified. Please check your inbox.",
        )

    return user


async def get_current_verified_user(
    current_user: Annotated["User", Depends(get_current_user)],
) -> "User":
    """
    Alias for routes that want to be explicit about requiring a verified user.
    Currently identical to get_current_user (which already checks verification),
    but having a named dependency makes route intent clearer and lets you
    add additional checks here later (e.g., subscription status).
    """
    return current_user


async def get_current_onboarded_user(
    current_user: Annotated["User", Depends(get_current_user)],
) -> "User":
    """
    Requires the user to have completed onboarding.
    
    Use this on routes that need an active user profile (goals, plans, etc.).
    The dashboard, planner, chat — all require onboarding to be complete.
    """
    if not current_user.onboarding_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please complete onboarding before accessing this feature.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Type aliases for cleaner route signatures
# ---------------------------------------------------------------------------
# These Annotated aliases let you write clean route signatures:
#   async def get_profile(user: CurrentUser, db: DB):
# instead of:
#   async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
#
# This is idiomatic FastAPI in 2024+.
CurrentUser = Annotated["User", Depends(get_current_user)]
OnboardedUser = Annotated["User", Depends(get_current_onboarded_user)]
DB = Annotated[AsyncSession, Depends(get_db)]
