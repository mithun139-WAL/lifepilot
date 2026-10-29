"""
features/tasks/router.py

HTTP endpoints for task and checklist management.

ROUTE STRUCTURE:
    POST   /tasks                                              → create task
    GET    /tasks/today                                        → today's tasks
    GET    /tasks/focus                                        → focus percentage
    GET    /tasks/{task_id}                                    → get task
    PUT    /tasks/{task_id}                                    → update task
    DELETE /tasks/{task_id}                                    → delete task
    POST   /tasks/{task_id}/checklists                         → add checklist item
    PUT    /tasks/{task_id}/checklists/{checklist_id}          → update + cascade
    DELETE /tasks/{task_id}/checklists/{checklist_id}          → delete checklist item

NOTE: /today and /focus must be declared BEFORE /{task_id} to avoid FastAPI
matching "today" and "focus" as task_id path parameters.
"""

from fastapi import APIRouter, status

from core.dependencies import DB, CurrentUser, OnboardedUser
from features.tasks.schemas import (
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ChecklistResponse,
    ChecklistUpdateResponse,
    FocusResponse,
    TaskCreate,
    TaskDataResponse,
    TaskResponse,
    TaskUpdate,
    TodayTaskItem,
    TodayTasksResponse,
)
from features.tasks.service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get(
    "/today",
    response_model=TodayTasksResponse,
    summary="Get today's pending tasks",
)
async def get_today_tasks(current_user: CurrentUser, db: DB) -> TodayTasksResponse:
    service = TaskService(db)
    items = await service.get_today_tasks(user_id=current_user.id)
    tasks = [
        TodayTaskItem(
            id=item["task"].id,
            title=item["task"].title,
            description=item["task"].description,
            status=item["task"].status,
            preferred_time=item["task"].preferred_time,
            completed_at=item["task"].completed_at,
            learning_plan_title=item["learning_plan_title"],
        )
        for item in items
    ]
    return TodayTasksResponse(tasks=tasks)


@router.get(
    "/focus",
    response_model=FocusResponse,
    summary="Get focus percentage (completed / total tasks)",
)
async def get_focus(current_user: CurrentUser, db: DB) -> FocusResponse:
    service = TaskService(db)
    focus = await service.get_focus_percent(user_id=current_user.id)
    return FocusResponse(focus=focus)


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a task",
)
async def create_task(
    body: TaskCreate, current_user: CurrentUser, db: DB
) -> TaskResponse:
    service = TaskService(db)
    task = await service.create_task(user_id=current_user.id, data=body)
    return TaskResponse.model_validate(task)


@router.get(
    "/{task_id}",
    response_model=TaskDataResponse,
    summary="Get a task by ID",
)
async def get_task(
    task_id: str, current_user: CurrentUser, db: DB
) -> TaskDataResponse:
    service = TaskService(db)
    task = await service.get_task(task_id=task_id, user_id=current_user.id)
    return TaskDataResponse(data=TaskResponse.model_validate(task))


@router.put(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Update a task",
)
async def update_task(
    task_id: str, body: TaskUpdate, current_user: CurrentUser, db: DB
) -> TaskResponse:
    service = TaskService(db)
    task = await service.update_task(task_id=task_id, user_id=current_user.id, data=body)
    return TaskResponse.model_validate(task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
)
async def delete_task(
    task_id: str, planner_id: str, db: DB
) -> None:
    """
    Delete a task by (taskId, plannerId) pair.
    Note: original handler took plannerId from request body.
    We accept it as a query param for REST correctness.
    """
    service = TaskService(db)
    await service.delete_task(task_id=task_id, planner_id=planner_id)


# ------------------------------------------------------------------
# Checklist sub-routes
# ------------------------------------------------------------------

@router.post(
    "/{task_id}/checklists",
    response_model=ChecklistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a checklist item to a task",
)
async def create_checklist(
    task_id: str, body: ChecklistItemCreate, current_user: CurrentUser, db: DB
) -> ChecklistResponse:
    service = TaskService(db)
    item = await service.create_checklist(
        task_id=task_id, user_id=current_user.id, data=body
    )
    return ChecklistResponse.model_validate(item)


@router.put(
    "/{task_id}/checklists/{checklist_id}",
    response_model=ChecklistUpdateResponse,
    summary="Update checklist item (cascades to task status and planner progress)",
)
async def update_checklist(
    task_id: str,
    checklist_id: str,
    body: ChecklistItemUpdate,
    current_user: CurrentUser,
    db: DB,
) -> ChecklistUpdateResponse:
    service = TaskService(db)
    item, task, progress = await service.update_checklist(
        checklist_id=checklist_id,
        task_id=task_id,
        user_id=current_user.id,
        data=body,
    )
    return ChecklistUpdateResponse(
        checklist=ChecklistResponse.model_validate(item),
        task=TaskResponse.model_validate(task),
        progress=progress,
    )


@router.delete(
    "/{task_id}/checklists/{checklist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a checklist item",
)
async def delete_checklist(
    task_id: str, checklist_id: str, current_user: CurrentUser, db: DB
) -> None:
    service = TaskService(db)
    await service.delete_checklist(
        checklist_id=checklist_id, task_id=task_id, user_id=current_user.id
    )
