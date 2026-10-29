"""
features/auth/repository.py

Database access layer for auth-related operations.

THE MENTAL MODEL:
The repository pattern separates "how to query the database" from 
"what to do with the result" (service) and "when to call it" (router).

WHY THIS MATTERS:
1. Testability: You can mock the repository in service tests without
   needing a real database.
   
2. Query consolidation: All SELECT/INSERT/UPDATE/DELETE for User data
   lives here. When a query is slow, you know exactly where to look.
   
3. No business logic: The repository only knows about SQL. It doesn't
   know what "registering a user" means — that's the service's job.
   It knows: insert a row, return the row.

MERN COMPARISON:
This is like your Mongoose model layer, but stripped of business logic:
   User.findOne({ email })    →   repo.get_user_by_email(email)
   User.create({ ... })       →   repo.create_user(data)
   User.findByIdAndUpdate()   →   repo.update_user(id, data)

ASYNC PATTERN:
All methods are async because we're using asyncpg + async SQLAlchemy.
The await keyword yields control back to the event loop while waiting
for the DB to respond — other requests can be handled in that time.
"""

from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from features.auth.models import Account, User, VerificationToken


class AuthRepository:
    """
    Handles all database operations for User, VerificationToken, and Account.
    
    Takes an AsyncSession as a constructor argument — injected by FastAPI's
    dependency system. This is the standard repository pattern.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # User queries
    # ------------------------------------------------------------------

    async def get_user_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    async def create_user(
        self,
        *,
        name: str,
        email: str,
        password_hash: str | None = None,
        image: str | None = None,
    ) -> User:
        """
        Create a new user record.
        
        IMPORTANT: email is lowercased before storage.
        Emails are case-insensitive by RFC spec — john@example.com and
        JOHN@EXAMPLE.COM are the same address. Always normalize before storing.
        """
        user = User(
            name=name,
            email=email.lower().strip(),
            password_hash=password_hash,
            image=image,
        )
        self.db.add(user)
        await self.db.flush()   # flush to get the generated ID without committing
        await self.db.refresh(user)
        return user

    async def update_user(self, user_id: str, **kwargs: object) -> User | None:
        """
        Update arbitrary user fields.
        
        We use mapped column names (snake_case Python names), NOT the DB column
        names (camelCase from Prisma). SQLAlchemy handles the mapping.
        """
        # Convert Python attribute names to actual column names for UPDATE
        # We use the ORM update approach to leverage SQLAlchemy's column mapping
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(**kwargs)
            .returning(User)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def mark_email_verified(self, user_id: str) -> User | None:
        """Mark a user's email as verified."""
        return await self.update_user(
            user_id,
            is_verified=True,
            email_verified=datetime.now(UTC),
        )

    async def complete_onboarding(
        self,
        user_id: str,
        *,
        skill_level: str,
        weekly_hours: int,
        pace: str,
        deadline: datetime | None,
        preferred_formats: dict,
    ) -> User | None:
        """Save onboarding preferences and mark onboarding complete."""
        return await self.update_user(
            user_id,
            skill_level=skill_level,
            weekly_hours=weekly_hours,
            pace=pace,
            deadline=deadline,
            preferred_formats=preferred_formats,
            onboarding_complete=True,
        )

    async def user_exists(self, email: str) -> bool:
        """
        Efficiently check if an email is already registered.
        Using EXISTS is faster than fetching the full row just to check existence.
        """
        result = await self.db.execute(
            select(User.id).where(User.email == email.lower().strip()).limit(1)
        )
        return result.scalar_one_or_none() is not None

    # ------------------------------------------------------------------
    # Verification tokens
    # ------------------------------------------------------------------

    async def create_verification_token(
        self,
        *,
        identifier: str,  # user's email
        token: str,
        expires: datetime,
    ) -> VerificationToken:
        vt = VerificationToken(identifier=identifier, token=token, expires=expires)
        self.db.add(vt)
        await self.db.flush()
        return vt

    async def get_verification_token(self, token: str) -> VerificationToken | None:
        result = await self.db.execute(
            select(VerificationToken).where(VerificationToken.token == token)
        )
        return result.scalar_one_or_none()

    async def delete_verification_token(self, identifier: str) -> None:
        """Delete all tokens for an email (cleanup before creating a new one)."""
        await self.db.execute(
            delete(VerificationToken).where(VerificationToken.identifier == identifier)
        )
        await self.db.flush()

    async def get_valid_verification_token(
        self, token: str
    ) -> VerificationToken | None:
        """Get a verification token only if it hasn't expired."""
        result = await self.db.execute(
            select(VerificationToken).where(
                VerificationToken.token == token,
                VerificationToken.expires > datetime.now(UTC),
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # OAuth accounts
    # ------------------------------------------------------------------

    async def get_account_by_provider(
        self, *, provider: str, provider_account_id: str
    ) -> Account | None:
        result = await self.db.execute(
            select(Account).where(
                Account.provider == provider,
                Account.provider_account_id == provider_account_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_account_tokens(
        self,
        *,
        provider: str,
        provider_account_id: str,
        access_token: str,
        refresh_token: str | None,
        expires_at: int | None,
    ) -> None:
        """Update OAuth tokens after a refresh."""
        await self.db.execute(
            update(Account)
            .where(
                Account.provider == provider,
                Account.provider_account_id == provider_account_id,
            )
            .values(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
            )
        )
        await self.db.flush()

    async def get_google_account_for_user(self, user_id: str) -> Account | None:
        """Get the Google OAuth account linked to a user (for Calendar access)."""
        result = await self.db.execute(
            select(Account).where(
                Account.user_id == user_id,
                Account.provider == "google",
            )
        )
        return result.scalar_one_or_none()
