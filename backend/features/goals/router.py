"""
features/goals/router.py

HTTP endpoints for goal management.

ROUTE DESIGN:
    GET    /goals           → list all goals for current user
    POST   /goals           → create a new goal
    GET    /goals/{goal_id} → get a single goal
    PUT    /goals/{goal_id} → update a goal (partial updates supported)
    DELETE /goals/{goal_id} → delete goal + cascade

AUTH REQUIREMENT: OnboardedUser
All goal endpoints require the user to have completed onboarding.
Goals are part of the core product — a non-onboarded user has no
skill_level, pace, etc., so they can't meaningfully use goals yet.

WHY OnboardedUser vs CurrentUser:
CurrentUser: authenticated and email-verified (minimum requirement)
OnboardedUser: also has onboarding_complete=True (for feature access)
Use OnboardedUser for all product features.

THIN ROUTER RULE:
Routers only:
1. Parse the request (Pydantic does this automatically)
2. Call the service
3. Return a response

All business logic — ownership checks, validation beyond types — is in the service.
"""

from fastapi import APIRouter, status

from core.dependencies import DB, OnboardedUser
from features.goals.schemas import (
    GoalCreate,
    GoalDataResponse,
    GoalListDataResponse,
    GoalResponse,
    GoalSuggestion,
    GoalSuggestionsResponse,
    GoalUpdate,
)
from features.goals.service import GoalService

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.get(
    "",
    response_model=GoalListDataResponse,
    summary="List all goals",
)
async def list_goals(
    current_user: OnboardedUser,
    db: DB,
) -> GoalListDataResponse:
    """
    Return all goals for the authenticated user, newest first.

    Includes the full goal record. LearningPlan data (the AI-generated plan)
    is fetched separately via GET /learning-plans/{plan_id}.
    """
    service = GoalService(db)
    goals = await service.list_goals(user_id=current_user.id)
    return GoalListDataResponse(
        data=[GoalResponse.model_validate(g) for g in goals]
    )


@router.post(
    "",
    response_model=GoalDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new goal",
)
async def create_goal(
    body: GoalCreate,
    current_user: OnboardedUser,
    db: DB,
) -> GoalDataResponse:
    """
    Create a new learning goal.

    After creating a goal, the frontend typically calls POST /learning-plans
    to generate the AI learning plan for this goal.
    """
    service = GoalService(db)
    goal = await service.create_goal(user_id=current_user.id, data=body)
    return GoalDataResponse(data=GoalResponse.model_validate(goal))


@router.get(
    "/{goal_id}",
    response_model=GoalDataResponse,
    summary="Get a goal by ID",
)
async def get_goal(
    goal_id: str,
    current_user: OnboardedUser,
    db: DB,
) -> GoalDataResponse:
    """Fetch a single goal by ID. Returns 403 if it belongs to another user."""
    service = GoalService(db)
    goal = await service.get_goal(goal_id=goal_id, user_id=current_user.id)
    return GoalDataResponse(data=GoalResponse.model_validate(goal))


@router.put(
    "/{goal_id}",
    response_model=GoalDataResponse,
    summary="Update a goal",
)
async def update_goal(
    goal_id: str,
    body: GoalUpdate,
    current_user: OnboardedUser,
    db: DB,
) -> GoalDataResponse:
    """
    Update one or more fields of an existing goal.

    All fields are optional — only provided fields are updated.
    This matches the behaviour of the original Next.js PUT handler.
    """
    service = GoalService(db)
    goal = await service.update_goal(
        goal_id=goal_id, user_id=current_user.id, data=body
    )
    return GoalDataResponse(data=GoalResponse.model_validate(goal))


@router.delete(
    "/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a goal and all related data",
)
async def delete_goal(
    goal_id: str,
    current_user: OnboardedUser,
    db: DB,
) -> None:
    """
    Delete a goal.

    DB cascade removes: LearningPlan, Planner, Task, Habit rows linked to this goal.

    NOTE: Google Calendar events for tasks are NOT cleaned up yet.
    This will be added in the tasks feature phase.
    """
    service = GoalService(db)
    await service.delete_goal(goal_id=goal_id, user_id=current_user.id)


@router.post(
    "/suggest",
    response_model=GoalSuggestionsResponse,
    summary="Get AI-suggested goals based on user preferences",
)
async def suggest_goals(
    current_user: OnboardedUser,
    db: DB,
) -> GoalSuggestionsResponse:
    """
    Generate 4 personalised goal suggestions using the user's saved preferences
    (skill level, weekly hours, pace, preferred formats) and their existing goals
    (to avoid obvious repetition).

    Uses the fast 8B model — this is a lightweight classification/generation task,
    not a complex reasoning problem. Response time is ~300–500ms.
    """
    import json
    import re
    import logging

    from langchain_core.messages import HumanMessage, SystemMessage
    from ai.llm import LLMUseCase, get_llm_for
    from features.goals.service import GoalService

    logger = logging.getLogger(__name__)

    # Load existing goal titles to avoid suggesting duplicates
    goal_service = GoalService(db)
    existing_goals = await goal_service.list_goals(user_id=current_user.id)
    existing_titles = [g.title for g in existing_goals] if existing_goals else []

    # --- Build the prompt ---------------------------------------------------
    skill = current_user.skill_level or "beginner"
    hours = current_user.weekly_hours or 5
    pace = current_user.pace or "steady"
    formats = current_user.preferred_formats or []

    formats_label = (
        ", ".join(formats) if isinstance(formats, list) and formats
        else "any format"
    )

    existing_section = (
        f"Existing goals (do NOT suggest these):\n"
        + "\n".join(f"- {t}" for t in existing_titles)
        if existing_titles
        else "No existing goals yet."
    )

    # Derive a per-day estimate from weekly hours (÷ 5 working days)
    hours_per_day_raw = max(1, round(hours / 5))
    hours_per_day_label = f"{hours_per_day_raw} hour{'s' if hours_per_day_raw > 1 else ''}"

    # Derive suggested weeks from pace
    pace_to_weeks = {"slow": 12, "steady": 8, "fast": 4}
    base_weeks = pace_to_weeks.get(pace, 8)

    system_prompt = (
        "You are a learning goal advisor for LifePilot, an AI-powered personal learning app.\n"
        "Your task: suggest 4 specific, actionable, and achievable learning goals "
        "tailored to the user's profile.\n\n"
        "RULES:\n"
        "- Each goal must be concrete and outcome-focused (e.g. 'Build a REST API with FastAPI' "
        "not 'Learn Python')\n"
        "- Vary the domains: mix technical skills, creative, professional, and personal development\n"
        "- Respect the user's time commitment and skill level\n"
        "- Return ONLY valid JSON — no markdown, no explanation\n\n"
        "OUTPUT FORMAT (JSON array of exactly 4 objects):\n"
        '[\n'
        '  {\n'
        '    "title": "...",\n'
        '    "description": "...",\n'
        '    "emoji": "...",\n'
        '    "suggestedWeeks": <integer>,\n'
        '    "hoursPerDay": "... hours"\n'
        '  }\n'
        ']'
    )

    user_prompt = (
        f"User profile:\n"
        f"- Skill level: {skill}\n"
        f"- Available time: {hours} hours/week ({hours_per_day_label}/day)\n"
        f"- Learning pace: {pace}\n"
        f"- Preferred formats: {formats_label}\n\n"
        f"{existing_section}\n\n"
        f"Suggest 4 personalised learning goals. "
        f"For each, set suggestedWeeks to approximately {base_weeks} weeks "
        f"and hoursPerDay to '{hours_per_day_label}'."
    )

    # --- Call LLM -----------------------------------------------------------
    try:
        llm = get_llm_for(LLMUseCase.SUGGESTIONS)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        response = await llm.ainvoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)

        # Strip markdown fences if present
        raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        start = raw.find("[")
        end = raw.rfind("]")
        if start == -1 or end == -1:
            raise ValueError("No JSON array in LLM response")
        parsed = json.loads(raw[start : end + 1])

        suggestions = [
            GoalSuggestion(
                title=item.get("title", ""),
                description=item.get("description", ""),
                emoji=item.get("emoji", "🎯"),
                suggestedWeeks=int(item.get("suggestedWeeks", base_weeks)),
                hoursPerDay=item.get("hoursPerDay", hours_per_day_label),
            )
            for item in parsed
            if isinstance(item, dict) and item.get("title")
        ]

    except Exception as exc:
        logger.warning("Goal suggestion LLM failed: %s — returning defaults", exc)
        # Fallback: return static suggestions so the UI never breaks
        suggestions = [
            GoalSuggestion(
                title="Build a full-stack web application",
                description="Design, build, and deploy a complete web app with a modern frontend and backend.",
                emoji="🌐",
                suggestedWeeks=base_weeks,
                hoursPerDay=hours_per_day_label,
            ),
            GoalSuggestion(
                title="Learn data analysis with Python and Pandas",
                description="Master data wrangling, visualisation, and storytelling using real-world datasets.",
                emoji="📊",
                suggestedWeeks=base_weeks,
                hoursPerDay=hours_per_day_label,
            ),
            GoalSuggestion(
                title="Get comfortable with public speaking",
                description="Overcome anxiety and build confidence through structured speaking practice.",
                emoji="🎤",
                suggestedWeeks=base_weeks,
                hoursPerDay=hours_per_day_label,
            ),
            GoalSuggestion(
                title="Write and publish a technical blog",
                description="Develop a writing habit, sharpen your thinking, and grow your professional presence.",
                emoji="✍️",
                suggestedWeeks=base_weeks,
                hoursPerDay=hours_per_day_label,
            ),
        ]

    return GoalSuggestionsResponse(suggestions=suggestions[:4])
