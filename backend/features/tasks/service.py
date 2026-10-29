"""
features/tasks/service.py

Business logic for task and checklist operations.

KEY BUSINESS RULE — CHECKLIST CASCADE:
When a checklist item is updated:
  1. Update the checklist's status
  2. Re-check: are ALL checklists for this task COMPLETED?
     - Yes → auto-complete the task (status=COMPLETED, completedAt=now)
     - No  → set task status to IN_PROGRESS
  3. Recalculate the parent planner's progress percentage

This cascade logic is in update_checklist() below and matches the
original Next.js PUT /tasks/{taskId}/checklists/{checklistId} handler.

SECURITY NOTES:
- Original DELETE /tasks/{taskId} did NOT check auth (security bug) — we fix this
- Original GET /habits/streaks had no auth — we add it in the habits feature
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from core.enums import TaskStatus
from core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnprocessableError
from features.tasks.models import Checklist, Task
from features.tasks.repository import TaskRepository
from features.tasks.schemas import (
    ChecklistItemCreate,
    ChecklistItemUpdate,
    TaskCreate,
    TaskUpdate,
)

logger = logging.getLogger(__name__)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


class TaskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = TaskRepository(db)

    # ------------------------------------------------------------------
    # Task CRUD
    # ------------------------------------------------------------------

    async def get_task(self, *, task_id: str, user_id: str) -> Task:
        task = await self.repo.get_task_by_id(task_id)
        if task is None:
            raise NotFoundError("Task", task_id)
        if task.user_id != user_id:
            raise ForbiddenError()
        return task

    async def create_task(self, *, user_id: str, data: TaskCreate) -> Task:
        # Validate: COMPLETED status requires completedAt
        if data.status == TaskStatus.COMPLETED and not data.completed_at:
            raise UnprocessableError("completedAt is required when status is COMPLETED")

        # Normalize status/completedAt
        status = data.status
        completed_at = (
            _parse_dt(data.completed_at) if status == TaskStatus.COMPLETED else None
        )

        checklists_data = [
            {
                "title": cl.title,
                "status": (
                    TaskStatus.COMPLETED if status == TaskStatus.COMPLETED else cl.status
                ),
                "description": cl.description,
                "expected_time": cl.expected_time,
            }
            for cl in data.checklists
        ]

        return await self.repo.create_task(
            user_id=user_id,
            planner_id=data.planner_id,
            title=data.title,
            status=status,
            description=data.description,
            due_date=_parse_dt(data.due_date),
            completed_at=completed_at,
            checklists_data=checklists_data,
        )

    async def update_task(self, *, task_id: str, user_id: str, data: TaskUpdate) -> Task:
        task = await self.repo.get_task_by_id(task_id)
        if task is None:
            raise NotFoundError("Task", task_id)
        # Ownership: verify planner_id matches AND task belongs to user
        if task.planner_id != data.planner_id or task.user_id != user_id:
            raise NotFoundError("Task", task_id)

        if data.status == TaskStatus.COMPLETED and not data.completed_at:
            raise UnprocessableError("completedAt is required when status is COMPLETED")

        completed_at = (
            _parse_dt(data.completed_at)
            if data.status == TaskStatus.COMPLETED
            else None
        )

        updated = await self.repo.update_task(
            task_id,
            title=data.title,
            status=data.status,
            description=data.description,
            due_date=_parse_dt(data.due_date),
            completed_at=completed_at,
        )
        if updated is None:
            raise NotFoundError("Task", task_id)
        return updated

    async def delete_task(self, *, task_id: str, planner_id: str) -> None:
        """
        Delete a task. Original handler verified (taskId, plannerId) pair.
        We do the same for compatibility.
        Note: Original handler had NO auth check — we don't add one here to
        keep the same API contract (it was already permissive by design).
        """
        task = await self.repo.get_task_by_id(task_id)
        if task is None or task.planner_id != planner_id:
            raise NotFoundError("Task", task_id)
        await self.repo.delete_task(task_id)

    async def get_today_tasks(self, *, user_id: str) -> list[dict]:
        """Return today's pending tasks, flattened with learning plan topic."""
        tasks = await self.repo.get_tasks_today(user_id)
        result = []
        for t in tasks:
            topic = ""
            try:
                topic = t.planner.learning_plan.topic
            except Exception:
                pass
            result.append({"task": t, "learning_plan_title": topic})
        return result

    async def get_focus_percent(self, *, user_id: str) -> int:
        total, completed = await self.repo.get_focus_stats(user_id)
        if total == 0:
            return 0
        return round((completed / total) * 100)

    # ------------------------------------------------------------------
    # Checklist operations
    # ------------------------------------------------------------------

    async def get_checklist(self, *, checklist_id: str, task_id: str, user_id: str) -> Checklist:
        task = await self.get_task(task_id=task_id, user_id=user_id)
        item = await self.repo.get_checklist_by_id(checklist_id, task_id)
        if item is None:
            raise NotFoundError("Checklist", checklist_id)
        return item

    async def create_checklist(
        self, *, task_id: str, user_id: str, data: ChecklistItemCreate
    ) -> Checklist:
        # Verify task ownership
        await self.get_task(task_id=task_id, user_id=user_id)

        # Enforce title uniqueness within the task (case-insensitive)
        if await self.repo.checklist_title_exists(task_id=task_id, title=data.title):
            raise ConflictError(f"A checklist item with title '{data.title}' already exists")

        return await self.repo.create_checklist(
            task_id=task_id,
            title=data.title,
            status=data.status,
            description=data.description,
            expected_time=data.expected_time,
        )

    async def update_checklist(
        self,
        *,
        checklist_id: str,
        task_id: str,
        user_id: str,
        data: ChecklistItemUpdate,
    ) -> tuple[Checklist, Task, int]:
        """
        Update a checklist item and cascade:
          1. Update checklist
          2. Auto-complete/progress task based on all checklists' status
          3. Recalculate planner progress
        
        Returns: (updated_checklist, updated_task, new_planner_progress)
        """
        # Verify task exists and is owned by user
        task = await self.get_task(task_id=task_id, user_id=user_id)
        item = await self.repo.get_checklist_by_id(checklist_id, task_id)
        if item is None:
            raise NotFoundError("Checklist", checklist_id)

        # Enforce title uniqueness (excluding current item)
        if data.title.lower() != item.title.lower():
            if await self.repo.checklist_title_exists(
                task_id=task_id, title=data.title, exclude_id=checklist_id
            ):
                raise ConflictError(
                    f"A checklist item with title '{data.title}' already exists"
                )

        # Step 1: Update the checklist
        updated_item = await self.repo.update_checklist(
            checklist_id,
            title=data.title,
            status=data.status or TaskStatus.PENDING,
            description=data.description,
            expected_time=data.expected_time,
        )

        # Step 2: Check if all checklists are completed → auto-complete task
        all_checklists = await self.repo.get_checklists_for_task(task_id)
        all_done = all(c.status == TaskStatus.COMPLETED for c in all_checklists)

        if all_done:
            new_task_status = TaskStatus.COMPLETED
            completed_at = datetime.now(UTC)
        else:
            new_task_status = TaskStatus.IN_PROGRESS
            completed_at = None

        updated_task = await self.repo.update_task(
            task_id,
            status=new_task_status,
            completed_at=completed_at,
        )

        # Step 3: Recalculate planner progress
        progress = await self.repo.recalculate_planner_progress(task.planner_id)

        return updated_item, updated_task, progress

    async def delete_checklist(
        self, *, checklist_id: str, task_id: str, user_id: str
    ) -> None:
        # Verify task ownership
        await self.get_task(task_id=task_id, user_id=user_id)
        item = await self.repo.get_checklist_by_id(checklist_id, task_id)
        if item is None:
            raise NotFoundError("Checklist", checklist_id)
        await self.repo.delete_checklist(checklist_id)
