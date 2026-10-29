"""
features/learning_plans/service.py

Business logic for creating and managing learning plans.

THE BIG CREATE OPERATION:
POST /learning-plans is the most complex write in the system. It:
  1. Creates the LearningPlan row
  2. Bulk-inserts Habit rows from habits_list
  3. For each week in planner JSON:
     a. Finds the matching tasks from task_list (by week number)
     b. Creates a Planner row for that week
     c. Creates Task rows (with Checklist sub-rows) for that week
     d. [FUTURE] Creates Google Calendar events (best-effort)

All steps run within a single database transaction.
If step 3 fails for one week, that week's Planner/Tasks are skipped
(same behaviour as the original Next.js handler which used try/catch per week).

GOOGLE CALENDAR:
The original Next.js handler accepted accessToken/refreshToken in the request body
and used them for Google Calendar event creation. This is a security anti-pattern.

Our approach:
- Look up the user's stored Google OAuth tokens from the Account table
- Use those for Calendar API calls
- Mark as best-effort (calendar failures do not fail the overall request)
- CURRENTLY: Calendar integration is a TODO — will be added in a future phase
  once integrations/google_calendar.py is implemented.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import HabitFrequency, TaskStatus
from core.exceptions import ForbiddenError, NotFoundError
from features.learning_plans.models import LearningPlan
from features.learning_plans.repository import LearningPlanRepository
from features.learning_plans.schemas import LearningPlanCreate, LearningPlanUpdate

logger = logging.getLogger(__name__)


def _safe_to_datetime(value: str | None) -> datetime | None:
    """
    Parse a date/time string to a datetime object.

    Handles:
    - Full ISO datetime strings: "2023-11-06T14:00:00"
    - Date-only strings: "2023-11-06"
    - Time-only strings: "14:00" (treated as today at that time)
    - None/empty → returns None

    Ported from safeToISO() in the original Next.js handler.
    """
    if not value:
        return None
    try:
        stripped = value.strip()
        # Time-only: "14:00" or "9:30"
        import re
        if re.match(r"^\d{1,2}:\d{2}$", stripped):
            hours, minutes = map(int, stripped.split(":"))
            now = datetime.now()
            return now.replace(hour=hours, minute=minutes, second=0, microsecond=0)
        # Full ISO string or date-only — fromisoformat handles both
        return datetime.fromisoformat(stripped)
    except (ValueError, TypeError):
        return None


class LearningPlanService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = LearningPlanRepository(db)

    async def list_plans(self, *, user_id: str) -> list[LearningPlan]:
        return await self.repo.get_plans_by_user(user_id)

    async def get_plan(self, *, plan_id: str, user_id: str) -> LearningPlan:
        """
        Fetch a plan with full nested data, enforcing ownership.
        Enriches habits with `completed` flag computed at query time.
        """
        plan = await self.repo.get_plan_detail(plan_id)
        if plan is None:
            raise NotFoundError("LearningPlan", plan_id)
        if plan.user_id != user_id:
            raise ForbiddenError()
        return plan

    async def create_plan(self, *, user_id: str, data: LearningPlanCreate) -> LearningPlan:
        """
        Create a learning plan with all associated Planners, Tasks, and Habits.

        All DB writes happen within the caller's transaction (the session is flushed
        but not committed until the request handler returns without error).
        """
        # Step 1: Create the LearningPlan row
        plan = await self.repo.create_plan(
            user_id=user_id,
            goal_id=data.goal_id,
            topic=data.topic,
            planner=data.planner,
            task_list=data.task_list,
            habits_list=data.habits_list,
        )

        # Step 2: Create Habit rows from habits_list
        await self._create_habits(user_id=user_id, plan_id=plan.id, habits_list=data.habits_list)

        # Step 3: Create Planner + Task + Checklist rows from planner + task_list
        await self._create_planners_and_tasks(
            user_id=user_id,
            plan_id=plan.id,
            planner_json=data.planner,
            task_list_json=data.task_list,
        )

        return plan

    async def update_plan(
        self, *, plan_id: str, user_id: str, data: LearningPlanUpdate
    ) -> LearningPlan:
        """Update topic, planner JSON, and/or task_list JSON."""
        # Ownership check
        existing = await self.repo.get_plan_by_id(plan_id)
        if existing is None:
            raise NotFoundError("LearningPlan", plan_id)
        if existing.user_id != user_id:
            raise ForbiddenError()

        updates = data.model_dump(exclude_none=True, by_alias=False)
        if not updates:
            return existing

        updated = await self.repo.update_plan(plan_id, **updates)
        if updated is None:
            raise NotFoundError("LearningPlan", plan_id)
        return updated

    async def delete_plan(self, *, plan_id: str, user_id: str) -> None:
        """
        Delete a learning plan. DB cascade handles Planner → Task → Checklist + Habit rows.

        FUTURE: Before deletion, collect googleCalendarEventId from all tasks,
        then delete those calendar events using the user's stored Google OAuth tokens.
        """
        existing = await self.repo.get_plan_by_id(plan_id)
        if existing is None:
            raise NotFoundError("LearningPlan", plan_id)
        if existing.user_id != user_id:
            raise ForbiddenError()

        # TODO (tasks phase): Delete Google Calendar events for all tasks in this plan
        # before deleting the DB rows, because CASCADE will remove the task records
        # (and with them the googleCalendarEventId values we need for the API call).

        await self.repo.delete_plan(plan_id)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _create_habits(
        self, *, user_id: str, plan_id: str, habits_list: list[Any]
    ) -> None:
        """Bulk-create Habit rows from the AI-generated habits_list JSON."""
        from features.habits.models import Habit

        if not habits_list:
            return

        habits = []
        for habit_data in habits_list:
            freq_str = (habit_data.get("frequency") or "daily").upper()
            frequency = HabitFrequency.WEEKLY if freq_str == "WEEKLY" else HabitFrequency.DAILY
            habit = Habit(
                user_id=user_id,
                learning_plan_id=plan_id,
                name=habit_data.get("title") or habit_data.get("name") or "",
                description=habit_data.get("description"),
                frequency=frequency,
            )
            habits.append(habit)

        if habits:
            self.db.add_all(habits)
            await self.db.flush()

    async def _create_planners_and_tasks(
        self,
        *,
        user_id: str,
        plan_id: str,
        planner_json: list[Any],
        task_list_json: list[Any],
    ) -> None:
        """
        Create Planner rows for each week, with nested Tasks and Checklists.

        If creating a week's data fails, that week is skipped with a warning
        (matches the original Next.js error handling per week).
        """
        from features.planners.models import Planner
        from features.tasks.models import Checklist, Task

        for plan_entry in planner_json:
            try:
                week_num = int(plan_entry.get("week", 0))

                # Find tasks for this week from task_list
                week_tasks = []
                for week_entry in task_list_json:
                    if int(week_entry.get("week", -1)) == week_num:
                        week_tasks = week_entry.get("tasks", [])
                        break

                # Create the Planner (weekly milestone)
                planner = Planner(
                    user_id=user_id,
                    learning_plan_id=plan_id,
                    title=plan_entry.get("milestone") or plan_entry.get("title") or f"Week {week_num}",
                    description=plan_entry.get("summary") or plan_entry.get("description"),
                    week=week_num,
                    start_date=_safe_to_datetime(plan_entry.get("startDate")),
                    end_date=_safe_to_datetime(plan_entry.get("endDate")),
                )
                self.db.add(planner)
                await self.db.flush()  # Need planner.id for tasks

                # Create Tasks for this week
                for task_data in week_tasks:
                    preferred = (
                        _safe_to_datetime(task_data.get("preferredTime"))
                        or datetime.now()
                    )
                    task = Task(
                        user_id=user_id,
                        planner_id=planner.id,
                        title=task_data.get("title") or "",
                        description=task_data.get("description"),
                        due_date=_safe_to_datetime(task_data.get("dueDate")),
                        preferred_time=preferred,
                        status=TaskStatus.PENDING,
                    )
                    self.db.add(task)
                    await self.db.flush()  # Need task.id for checklists

                    # Create Checklists for this task
                    for cl_data in task_data.get("checklists") or []:
                        checklist = Checklist(
                            task_id=task.id,
                            title=cl_data.get("title") or "",
                            description=cl_data.get("description"),
                            expected_time=cl_data.get("expectedTime"),
                            status=TaskStatus.PENDING,
                        )
                        self.db.add(checklist)

                await self.db.flush()

            except Exception:
                logger.warning(
                    f"Failed to create planner data for week {plan_entry.get('week')}, "
                    "skipping this week",
                    exc_info=True,
                )
