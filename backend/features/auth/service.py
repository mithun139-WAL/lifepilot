"""
features/auth/service.py

Business logic for authentication.

THE MENTAL MODEL:
The service layer is where your "verbs" live:
- register_user()      ← the WHAT (business rule: email must be unique, hash password, send email)
- login_user()         ← verify credentials, generate tokens
- verify_email()       ← validate token, mark verified, send welcome email

WHAT BELONGS HERE:
- Orchestration logic (call repo, call email service, call security utils)
- Business rules (password strength already validated in schema, but
  domain rules like "you can't log in if not verified" belong here)
- Error translation (repo returns None → raise NotFoundError with domain message)
- Calls to external services (email, not HTTP endpoints)

WHAT DOES NOT BELONG HERE:
- HTTP status codes — those belong in the router
- SQL queries — those belong in the repository
- Request/response serialization — that belongs in schemas

ASYNC PATTERN:
Services are async because they await repository calls (which await DB queries).
The async chain: router → service → repository → DB
Every link must be async or you block the event loop.
"""

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ConflictError, NotFoundError, UnauthorizedError, UnprocessableError
from core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from core.config import settings
from features.auth.models import User
from features.auth.repository import AuthRepository
from features.auth.schemas import TokenResponse


class AuthService:
    """
    Handles all authentication business logic.
    
    Constructor injection makes this testable:
        service = AuthService(mock_repo, mock_email_service)
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AuthRepository(db)

    async def register_user(
        self,
        *,
        name: str,
        email: str,
        password: str,
    ) -> User:
        """
        Register a new user with email + password.
        
        Flow:
        1. Check email uniqueness
        2. Hash password
        3. Create user
        4. Generate email verification token
        5. Send verification email
        
        Raises:
            ConflictError: If email is already registered
        """
        # Step 1: Email uniqueness check
        # We check before attempting insert to give a clear error message.
        # Without this, a DB unique constraint violation would bubble up as a
        # generic 500 error (IntegrityError) which is confusing for the client.
        if await self.repo.user_exists(email):
            raise ConflictError(f"An account with email '{email}' already exists")

        # Step 2: Hash the password
        # NEVER store plaintext passwords. Ever.
        # bcrypt is slow by design — it's designed to make brute force expensive.
        # This single line is doing ~100ms of intentional CPU work.
        password_hash = hash_password(password)

        # Step 3: Create the user
        user = await self.repo.create_user(
            name=name,
            email=email,
            password_hash=password_hash,
        )

        # Step 4: Generate verification token
        # secrets.token_urlsafe() is cryptographically secure — use this,
        # not uuid4() or random(), for security tokens.
        token = secrets.token_urlsafe(32)
        expires = datetime.now(UTC) + timedelta(
            hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
        )

        # Delete any existing tokens for this email (idempotent)
        await self.repo.delete_verification_token(email)
        await self.repo.create_verification_token(
            identifier=email,
            token=token,
            expires=expires,
        )

        # Step 5: Send verification email
        # We import here to avoid circular imports and keep the dependency
        # on the email service lazy (only loaded when needed)
        try:
            from integrations.email import send_verification_email
            await send_verification_email(
                to_email=email,
                user_name=name,
                token=token,
            )
        except Exception:
            # Email failure should NOT roll back user creation.
            # The user can request a resend. Log the error but continue.
            import logging
            logging.getLogger(__name__).exception(
                f"Failed to send verification email to {email}"
            )

        return user

    async def login_user(self, *, email: str, password: str) -> TokenResponse:
        """
        Authenticate a user and return JWT tokens.
        
        Security considerations:
        - Same error message for "user not found" vs "wrong password"
          This prevents user enumeration attacks (knowing if an email is registered)
        - verify_password uses constant-time comparison internally
        
        Raises:
            UnauthorizedError: If credentials are invalid or email not verified
        """
        user = await self.repo.get_user_by_email(email)

        # INTENTIONAL: identical error message for not found vs wrong password
        invalid_credentials_error = UnauthorizedError("Invalid email or password")

        if user is None:
            raise invalid_credentials_error

        # OAuth users (Google/GitHub) have no password hash
        if user.password_hash is None:
            raise UnauthorizedError(
                "This account uses Google or GitHub sign-in. "
                "Please use the OAuth button."
            )

        # Verify password
        if not verify_password(password, user.password_hash):
            raise invalid_credentials_error

        # Email verification gate
        if not user.is_verified:
            raise UnauthorizedError(
                "Please verify your email address before signing in. "
                "Check your inbox or request a new verification email."
            )

        return self._generate_tokens(user)

    async def refresh_tokens(self, *, refresh_token: str) -> TokenResponse:
        """
        Issue new tokens using a valid refresh token.
        
        This is the token rotation pattern:
        - Validate the refresh token
        - Issue new access + refresh tokens
        - (Future: invalidate the old refresh token in Redis)
        
        Raises:
            UnauthorizedError: If refresh token is invalid or expired
        """
        from core.security import decode_refresh_token
        from jose import JWTError

        try:
            payload = decode_refresh_token(refresh_token)
            user_id = payload.get("sub")
        except JWTError:
            raise UnauthorizedError("Invalid or expired refresh token")

        if not user_id:
            raise UnauthorizedError("Invalid refresh token")

        user = await self.repo.get_user_by_id(user_id)
        if user is None:
            raise UnauthorizedError("User no longer exists")

        return self._generate_tokens(user)

    async def verify_email(self, *, token: str) -> User:
        """
        Verify a user's email address using the token sent via email.
        
        Flow:
        1. Look up the token (check it exists AND hasn't expired)
        2. Find the user associated with the token's email
        3. Mark the user as verified
        4. Delete the used token (one-time use)
        5. Send welcome email
        
        Raises:
            UnprocessableError: If token is invalid or expired
            NotFoundError: If no user found for the token's email
        """
        # Step 1: Validate token
        vt = await self.repo.get_valid_verification_token(token)
        if vt is None:
            raise UnprocessableError(
                "Verification link is invalid or has expired. "
                "Please request a new one."
            )

        # Step 2: Find user
        user = await self.repo.get_user_by_email(vt.identifier)
        if user is None:
            raise NotFoundError("User", vt.identifier)

        # Idempotent: already verified is fine
        if user.is_verified:
            return user

        # Step 3: Mark verified
        user = await self.repo.mark_email_verified(user.id)

        # Step 4: Delete the used token
        await self.repo.delete_verification_token(vt.identifier)

        # Step 5: Send welcome email
        try:
            from integrations.email import send_welcome_email
            await send_welcome_email(to_email=user.email, user_name=user.name or "")
        except Exception:
            import logging
            logging.getLogger(__name__).exception(
                f"Failed to send welcome email to {user.email}"
            )

        return user

    async def resend_verification_email(self, *, email: str) -> None:
        """
        Resend a verification email.
        
        Rate limiting should be applied at the router/middleware level
        to prevent abuse. We don't implement it here (service layer
        shouldn't know about request context).
        """
        user = await self.repo.get_user_by_email(email)

        # Deliberately vague: don't reveal whether email is registered
        if user is None or user.is_verified:
            return  # Silently succeed — don't leak info

        token = secrets.token_urlsafe(32)
        expires = datetime.now(UTC) + timedelta(
            hours=settings.EMAIL_VERIFICATION_EXPIRE_HOURS
        )

        await self.repo.delete_verification_token(email)
        await self.repo.create_verification_token(
            identifier=email,
            token=token,
            expires=expires,
        )

        from integrations.email import send_verification_email
        await send_verification_email(
            to_email=email,
            user_name=user.name or "",
            token=token,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _generate_tokens(self, user: User) -> TokenResponse:
        """Generate an access + refresh token pair for a user."""
        access_token = create_access_token(
            subject=user.id,
            extra_claims={"onboarding_complete": user.onboarding_complete},
        )
        refresh_token = create_refresh_token(subject=user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
