"""
features/planners/service.py

AI plan generation orchestrator — the core of LifePilot's value.

THE 4-STAGE PIPELINE:

  Stage 1 — Goal Interpretation
    Input : goal title (string)
    Model : PLANNER (meta/llama-3.3-70b-instruct)
    Output: { skills, tools, use_cases, constraints }

  Stage 2 — Roadmap
    Input : goal title + stage-1 output + targetWeeks
    Model : PLANNER
    Output: { planner: [{week, milestone, summary, startDate, endDate}] }

  Stage 3 — Task Generation (ALL weeks in parallel)
    Input : goal title + stage-1 output + week + milestone + hoursPerDay
    Model : TASKS (mistralai/mixtral-8x7b-instruct-v0.1)
    Output: [{ week, tasks: [{title, checklists, dueDate, preferredTime}] }]
    NOTE  : asyncio.gather fires all weeks simultaneously — the biggest
            latency win (reduces N×T to ~T for N weeks).

  Stage 4 — Habits (runs in PARALLEL with Stage 3)
    Input : goal title + stage-1 output
    Model : SUGGESTIONS (meta/llama-3.1-8b-instruct) — habits are simple
    Output: { habits: [{title, frequency, description, impact}] }
    NOTE  : Stage 4 only depends on Stage 1, not Stage 3, so it runs
            concurrently with Stage 3 using a second asyncio.gather.

PARALLELISM SUMMARY:
  Before: S1 → S2 → S3[w1] → S3[w2] → ... → S3[wN] → S4  (~15 min for 8 weeks)
  After : S1 → S2 → gather(S3[w1..wN], S4)              (~1–2 min for 8 weeks)
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from ai.llm import LLMUseCase, get_llm_for
from ai.prompts import (
    goal_interpretation_prompt,
    habits_prompt,
    roadmap_prompt,
    task_generation_prompt,
)
from core.exceptions import NotFoundError, UnprocessableError
from features.goals.repository import GoalRepository
from features.learning_plans.schemas import LearningPlanCreate
from features.learning_plans.service import LearningPlanService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> Any:
    """
    Extract the first JSON object or array from LLM output.

    LLMs sometimes wrap their JSON in markdown code fences (```json ... ```)
    or include preamble text. This strips all of that.

    Raises ValueError if no valid JSON found.
    """
    # Strip markdown code fences
    text = re.sub(r"```(?:json)?\s*", "", text).strip()

    # Find first { or [
    start = -1
    for i, ch in enumerate(text):
        if ch in ("{", "["):
            start = i
            break

    if start == -1:
        raise ValueError(f"No JSON found in LLM output: {text[:200]!r}")

    # Find matching last } or ]
    opener = text[start]
    closer = "}" if opener == "{" else "]"
    end = text.rfind(closer)

    if end == -1 or end <= start:
        raise ValueError(f"Unbalanced JSON in LLM output: {text[:200]!r}")

    return json.loads(text[start : end + 1])


# ---------------------------------------------------------------------------
# LLM call helper
# ---------------------------------------------------------------------------

async def _call_llm(
    *,
    system: str,
    user: str,
    use_case: LLMUseCase,
    label: str,
) -> Any:
    """
    Send a chat completion to the NIM model for the given use case
    and return parsed JSON.

    Logs the raw output at DEBUG level (useful during development).
    Raises ValueError if the output cannot be parsed as JSON.
    """
    llm = get_llm_for(use_case)
    messages = [SystemMessage(content=system), HumanMessage(content=user)]

    response = await llm.ainvoke(messages)
    raw = response.content if hasattr(response, "content") else str(response)
    logger.debug("[%s] raw output: %s", label, raw[:500])

    parsed = _extract_json(raw)
    logger.debug("[%s] parsed: %s", label, str(parsed)[:300])
    return parsed


# ---------------------------------------------------------------------------
# Per-week task generator (used in parallel gather)
# ---------------------------------------------------------------------------

async def _generate_week_tasks(
    title: str,
    expansion: Any,
    week_data: dict[str, Any],
    hours_per_day: str,
) -> Any | None:
    """
    Generate tasks for a single week.  Returns None on failure so the
    caller can skip failed weeks without crashing the whole pipeline.
    """
    try:
        p3 = task_generation_prompt(
            title,
            expansion,
            week_data.get("week", 0),
            week_data.get("milestone", ""),
            hours_per_day,
        )
        return await _call_llm(
            system=p3["system"],
            user=p3["user"],
            use_case=LLMUseCase.TASKS,
            label=f"Tasks W{week_data.get('week')}",
        )
    except Exception as exc:
        logger.warning(
            "Task generation failed for week %s — skipping: %s",
            week_data.get("week"),
            exc,
        )
        return None


# ---------------------------------------------------------------------------
# Habits generator (runs in parallel with Stage 3)
# ---------------------------------------------------------------------------

async def _generate_habits(title: str, expansion: Any) -> dict[str, Any]:
    """
    Generate habit suggestions using the fast 8B model.
    Uses SUGGESTIONS (8B) instead of PLANNER (70B) — habits are a short,
    simple structured output that doesn't need the larger model.
    Returns {"habits": []} on failure.
    """
    try:
        p4 = habits_prompt(title, expansion)
        result = await _call_llm(
            system=p4["system"],
            user=p4["user"],
            use_case=LLMUseCase.SUGGESTIONS,   # 8B — fast & cheap for simple tasks
            label="Habits",
        )
        if not isinstance(result.get("habits"), list):
            result["habits"] = []
        return result
    except Exception as exc:
        logger.warning("Habits generation failed — using empty list: %s", exc)
        return {"habits": []}


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

class PlannerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_plan(
        self, *, goal_id: str, user_id: str
    ) -> dict[str, Any]:
        """
        Run the 4-stage AI pipeline and persist the result.

        Returns a dict matching the original Next.js response shape:
          { roadmap, tasks, habits, savedPlan }
        """
        # Load the goal — ownership is enforced here
        goal_repo = GoalRepository(self.db)
        goal = await goal_repo.get_goal_by_id(goal_id)
        if goal is None:
            raise NotFoundError("Goal", goal_id)
        if goal.user_id != user_id:
            raise NotFoundError("Goal", goal_id)

        title = goal.title
        hours_per_day = goal.hours_per_day
        target_weeks = goal.target_weeks

        # ----------------------------------------------------------------
        # Stage 1 — Goal Interpretation  (70B — sets quality for everything)
        # ----------------------------------------------------------------
        p1 = goal_interpretation_prompt(title)
        expansion = await _call_llm(
            system=p1["system"],
            user=p1["user"],
            use_case=LLMUseCase.PLANNER,
            label="Goal Interpretation",
        )

        # ----------------------------------------------------------------
        # Stage 2 — Roadmap  (70B — complex week-by-week structure)
        # ----------------------------------------------------------------
        p2 = roadmap_prompt(title, expansion, target_weeks)
        roadmap = await _call_llm(
            system=p2["system"],
            user=p2["user"],
            use_case=LLMUseCase.PLANNER,
            label="Roadmap",
        )

        if not isinstance(roadmap.get("planner"), list):
            logger.warning("roadmap.planner is not a list — defaulting to []")
            roadmap["planner"] = []

        weeks = roadmap["planner"]

        # ----------------------------------------------------------------
        # Stage 3 + Stage 4 — run ALL in parallel
        #
        # Stage 3 tasks: one coroutine per week, all fired simultaneously
        # Stage 4 habits: depends only on S1 output, not S2/S3 → run now
        #
        # asyncio.gather(*coros) fires all coroutines concurrently and
        # returns results in the same order.  The last element is habits.
        # ----------------------------------------------------------------
        week_coros = [
            _generate_week_tasks(title, expansion, w, hours_per_day)
            for w in weeks
        ]

        all_results = await asyncio.gather(*week_coros, _generate_habits(title, expansion))

        habits_data: dict[str, Any] = all_results[-1]          # last coro = habits
        tasks: list[Any] = [r for r in all_results[:-1] if r is not None]

        # ----------------------------------------------------------------
        # Save to DB via LearningPlanService
        # ----------------------------------------------------------------
        lp_service = LearningPlanService(self.db)
        plan_create = LearningPlanCreate(
            goalId=goal_id,
            topic=title,
            planner=roadmap.get("planner", []),
            task_list=tasks,
            habits_list=habits_data.get("habits", []),
        )
        saved_plan = await lp_service.create_plan(user_id=user_id, data=plan_create)

        return {
            "roadmap": roadmap,
            "tasks": tasks,
            "habits": habits_data,
            "savedPlan": {"id": saved_plan.id, "topic": saved_plan.topic},
        }
