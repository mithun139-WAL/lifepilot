"""
features/tasks/repository.py

Database access for Task, Checklist, and Planner progress updates.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import TaskStatus
from features.tasks.models import Checklist, Task


class TaskRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Task queries
    # ------------------------------------------------------------------

    async def get_task_by_id(self, task_id: str) -> Task | None:
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def get_tasks_today(self, user_id: str) -> list[Task]:
        """
        Return PENDING tasks for today (by preferred_time).
        Includes planner → learning_plan for the topic title.
        """
        from sqlalchemy.orm import selectinload
        from features.planners.models import Planner
        from features.learning_plans.models import LearningPlan

        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)

        result = await self.db.execute(
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.status == TaskStatus.PENDING,
                Task.preferred_time >= today_start,
                Task.preferred_time <= today_end,
            )
            .options(
                selectinload(Task.planner).selectinload(Planner.learning_plan)
            )
            .order_by(Task.preferred_time.asc())
        )
        return list(result.scalars().all())

    async def get_focus_stats(self, user_id: str) -> tuple[int, int]:
        """Return (total_tasks, completed_tasks) for the user."""
        result = await self.db.execute(
            select(Task.status).where(Task.user_id == user_id)
        )
        statuses = result.scalars().all()
        total = len(statuses)
        completed = sum(1 for s in statuses if s == TaskStatus.COMPLETED)
        return total, completed

    async def create_task(
        self,
        *,
        user_id: str,
        planner_id: str,
        title: str,
        status: TaskStatus,
        description: str | None,
        due_date: datetime | None,
        completed_at: datetime | None,
        checklists_data: list[dict],
    ) -> Task:
        task = Task(
            user_id=user_id,
            planner_id=planner_id,
            title=title,
            status=status,
            description=description,
            due_date=due_date,
            completed_at=completed_at,
        )
        self.db.add(task)
        await self.db.flush()

        for cl in checklists_data:
            checklist = Checklist(
                task_id=task.id,
                title=cl["title"],
                status=cl.get("status", status if status == TaskStatus.COMPLETED else TaskStatus.PENDING),
                description=cl.get("description"),
                expected_time=cl.get("expected_time"),
            )
            self.db.add(checklist)

        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def update_task(self, task_id: str, **kwargs: object) -> Task | None:
        stmt = (
            update(Task).where(Task.id == task_id).values(**kwargs).returning(Task)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def delete_task(self, task_id: str) -> None:
        await self.db.execute(delete(Task).where(Task.id == task_id))
        await self.db.flush()

    # ------------------------------------------------------------------
    # Checklist queries
    # ------------------------------------------------------------------

    async def get_checklist_by_id(self, checklist_id: str, task_id: str) -> Checklist | None:
        result = await self.db.execute(
            select(Checklist).where(
                Checklist.id == checklist_id,
                Checklist.task_id == task_id,
            )
        )
        return result.scalar_one_or_none()

    async def checklist_title_exists(
        self, *, task_id: str, title: str, exclude_id: str | None = None
    ) -> bool:
        from sqlalchemy import func as sa_func
        stmt = select(Checklist.id).where(
            Checklist.task_id == task_id,
            sa_func.lower(Checklist.title) == title.lower(),
        )
        if exclude_id:
            stmt = stmt.where(Checklist.id != exclude_id)
        result = await self.db.execute(stmt.limit(1))
        return result.scalar_one_or_none() is not None

    async def create_checklist(
        self,
        *,
        task_id: str,
        title: str,
        status: TaskStatus,
        description: str | None,
        expected_time: str | None,
    ) -> Checklist:
        item = Checklist(
            task_id=task_id,
            title=title,
            status=status,
            description=description,
            expected_time=expected_time,
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update_checklist(self, checklist_id: str, **kwargs: object) -> Checklist | None:
        stmt = (
            update(Checklist)
            .where(Checklist.id == checklist_id)
            .values(**kwargs)
            .returning(Checklist)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.scalar_one_or_none()

    async def delete_checklist(self, checklist_id: str) -> None:
        await self.db.execute(delete(Checklist).where(Checklist.id == checklist_id))
        await self.db.flush()

    async def get_checklists_for_task(self, task_id: str) -> list[Checklist]:
        result = await self.db.execute(
            select(Checklist).where(Checklist.task_id == task_id).order_by(Checklist.id)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Planner progress recalculation
    # ------------------------------------------------------------------

    async def recalculate_planner_progress(self, planner_id: str) -> int:
        """
        Recompute planner.progress as (completed_tasks / total_tasks) * 100.
        Updates the Planner row in place. Returns the new progress value.
        """
        from features.planners.models import Planner

        result = await self.db.execute(
            select(Task.status).where(Task.planner_id == planner_id)
        )
        statuses = result.scalars().all()
        total = len(statuses)
        completed = sum(1 for s in statuses if s == TaskStatus.COMPLETED)
        progress = round((completed / total) * 100) if total > 0 else 0

        await self.db.execute(
            update(Planner).where(Planner.id == planner_id).values(progress=progress)
        )
        await self.db.flush()
        return progress
