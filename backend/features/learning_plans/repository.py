"""
features/learning_plans/repository.py

Database access for LearningPlan, with eager-loading strategies
matching what the frontend expects.
"""

from __future__ import annotations

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.learning_plans.models import LearningPlan
from features.planners.models import Planner
from features.tasks.models import Checklist, Task


class LearningPlanRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_plans_by_user(self, user_id: str) -> list[LearningPlan]:
        """
        Return all learning plans with nested planners → tasks → checklists
        and habits → completions. Ordered newest-first.
        """
        result = await self.db.execute(
            select(LearningPlan)
            .where(LearningPlan.user_id == user_id)
            .options(
                selectinload(LearningPlan.planners).selectinload(Planner.tasks).selectinload(Task.checklists),
                selectinload(LearningPlan.habits),
            )
            .order_by(LearningPlan.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_plan_by_id(self, plan_id: str) -> LearningPlan | None:
        """Fetch a plan by ID (no nested loading — use get_plan_detail for that)."""
        result = await self.db.execute(
            select(LearningPlan).where(LearningPlan.id == plan_id)
        )
        return result.scalar_one_or_none()

    async def get_plan_detail(self, plan_id: str) -> LearningPlan | None:
        """
        Fetch a plan with full nesting:
        planners (ordered by week) → tasks (ordered by due_date) → checklists (ordered by id)
        habits → completions
        """
        from features.habits.models import Habit, HabitProgress

        result = await self.db.execute(
            select(LearningPlan)
            .where(LearningPlan.id == plan_id)
            .options(
                selectinload(LearningPlan.planners)
                .selectinload(Planner.tasks)
                .selectinload(Task.checklists),
                selectinload(LearningPlan.habits)
                .selectinload(Habit.completions),
            )
        )
        return result.scalar_one_or_none()

    async def create_plan(
        self,
        *,
        user_id: str,
        goal_id: str,
        topic: str,
        planner: list,
        task_list: list,
        habits_list: list,
    ) -> LearningPlan:
        plan = LearningPlan(
            user_id=user_id,
            goal_id=goal_id,
            topic=topic,
            planner=planner,
            task_list=task_list,
            habits_list=habits_list,
        )
        self.db.add(plan)
        await self.db.flush()
        await self.db.refresh(plan)
        return plan

    async def update_plan(self, plan_id: str, **kwargs: object) -> LearningPlan | None:
        stmt = (
            update(LearningPlan)
            .where(LearningPlan.id == plan_id)
            .values(**kwargs)
            .returning(LearningPlan)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def delete_plan(self, plan_id: str) -> None:
        await self.db.execute(
            delete(LearningPlan).where(LearningPlan.id == plan_id)
        )
        await self.db.flush()
