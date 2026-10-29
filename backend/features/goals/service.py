"""
features/goals/service.py

Business logic for goal management.

WHAT BELONGS HERE:
- Ownership enforcement: "does this user own this goal?"
- Orchestration: call repo, check result, raise domain error
- Pre-delete cleanup: (future) delete Google Calendar events before goal deletion

WHAT DOES NOT BELONG HERE:
- SQL queries (in repository)
- HTTP status codes (in router/exception handlers)
- Sending HTTP responses (in router)

OWNERSHIP PATTERN:
Every mutating operation (get, update, delete) calls get_goal() first.
get_goal() enforces ownership — if the goal exists but belongs to another
user, it raises ForbiddenError (403), not NotFoundError (404).

WHY 403 instead of 404 for "not your goal":
Returning 404 would be more secure (doesn't reveal the resource exists)
but it makes debugging confusing. We log at the service level and return 403.
In a public-facing API you might return 404 — either is defensible.

GOOGLE CALENDAR NOTE:
The original Next.js DELETE handler also deleted Google Calendar events
for all tasks linked to this goal's planners. That logic lives in the
tasks feature phase (we need Task model + Google OAuth token lookup).
For now, delete_goal() removes DB rows via CASCADE; calendar events remain
orphaned in Google Calendar (minor UX issue, not a data integrity issue).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import ForbiddenError, NotFoundError
from features.goals.models import Goal
from features.goals.repository import GoalRepository
from features.goals.schemas import GoalCreate, GoalUpdate


class GoalService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = GoalRepository(db)

    async def list_goals(self, *, user_id: str) -> list[Goal]:
        """Return all goals belonging to the authenticated user."""
        return await self.repo.get_goals_by_user(user_id)

    async def get_goal(self, *, goal_id: str, user_id: str) -> Goal:
        """
        Fetch a single goal, enforcing that it belongs to the caller.

        Raises:
            NotFoundError: goal_id does not exist in the DB
            ForbiddenError: goal exists but belongs to a different user
        """
        goal = await self.repo.get_goal_by_id(goal_id)
        if goal is None:
            raise NotFoundError("Goal", goal_id)
        if goal.user_id != user_id:
            # Don't leak that the resource exists — raise ForbiddenError
            raise ForbiddenError()
        return goal

    async def create_goal(self, *, user_id: str, data: GoalCreate) -> Goal:
        """
        Create a new goal for the authenticated user.

        preferred_time is optional in GoalCreate.  When the caller omits it
        (onboarding flow) or the frontend sends null (goal page with no time
        picker selection), we default to tomorrow at 09:00 UTC so the planner
        AI pipeline always has a concrete start time to schedule tasks around.
        """
        if data.preferred_time is not None:
            preferred_time: datetime = data.preferred_time
        else:
            # Default: next calendar day at 09:00 UTC
            preferred_time = (
                datetime.now(timezone.utc).replace(
                    hour=9, minute=0, second=0, microsecond=0
                )
                + timedelta(days=1)
            )

        return await self.repo.create_goal(
            user_id=user_id,
            title=data.title,
            hours_per_day=data.hours_per_day,
            target_weeks=data.target_weeks,
            preferred_time=preferred_time,
        )

    async def update_goal(
        self, *, goal_id: str, user_id: str, data: GoalUpdate
    ) -> Goal:
        """
        Update an existing goal, enforcing ownership.

        Only non-None fields in data are applied (partial update semantics).
        If the body is completely empty, returns the goal unchanged.

        Raises:
            NotFoundError / ForbiddenError: via get_goal()
        """
        # Ownership check — raises before we touch the DB
        await self.get_goal(goal_id=goal_id, user_id=user_id)

        # Build the kwargs dict from provided fields only
        # exclude_none=True drops fields the caller didn't send
        # by_alias=False ensures we use Python attribute names (snake_case)
        # which match the mapped_column() names in the Goal model
        updates = data.model_dump(exclude_none=True, by_alias=False)

        if not updates:
            # Nothing to update — return current state without a wasted DB write
            return await self.repo.get_goal_by_id(goal_id)  # type: ignore[return-value]

        updated = await self.repo.update_goal(goal_id, **updates)
        if updated is None:
            # Should not happen (we just verified it exists), but handle it
            raise NotFoundError("Goal", goal_id)
        return updated

    async def delete_goal(self, *, goal_id: str, user_id: str) -> None:
        """
        Delete a goal and all its related data.

        DB cascade handles: LearningPlan → Planner → Task rows.

        FUTURE (tasks feature phase):
        Before calling repo.delete_goal(), load all Task.googleCalendarEventId
        values linked to this goal, then call the Google Calendar API to delete
        those events using the user's stored OAuth tokens from the Account table.

        Raises:
            NotFoundError / ForbiddenError: via get_goal()
        """
        # Verify ownership before deletion
        await self.get_goal(goal_id=goal_id, user_id=user_id)
        await self.repo.delete_goal(goal_id)
