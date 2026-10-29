"""
features/chat/service.py

Business logic for the AI Coach chat feature.

THE TWO RESPONSIBILITIES:
1. Chat CRUD — thin delegates to ChatRepository (list, create, update, delete)
2. Streaming — the core agentic loop: context → RAG → LLM → tool calls → final response

STREAMING ARCHITECTURE:
  stream_response() is an async generator.
  It yields str chunks that the router passes directly to StreamingResponse.

  PHASE 1: Context building (blocking, happens before first yield)
    - Fetch: active learning plan, today's tasks, habits, recent mood
    - Run RAG: embed last user message → similarity search → context block
    - Build system prompt from all of the above

  PHASE 2: Agentic loop (_run_agentic_loop)
    - Call NIM with tool definitions enabled
    - Stream text tokens → yield each to the client
    - Accumulate any tool_calls deltas silently
    - After stream ends: if tool calls exist, execute them and recurse (max 2 turns)
    - If no tool calls: done

TOOL CALLING:
  The AI Coach has two tools (mirrors the Next.js version):
    complete_task(taskId)  → mark Task as COMPLETED, set completedAt
    log_mood(mood)         → create a Mood entry
  Tools execute inside the agentic loop, keeping the streaming connection open.

WHY MAX_TURNS = 2:
  One tool call = 1 extra LLM turn. In theory, the model could call tools
  on the second turn too. We cap at 2 to prevent infinite recursion from
  a misbehaving model response and to bound total latency.

WHY SEQUENTIAL CONTEXT QUERIES (NOT asyncio.gather):
  SQLAlchemy's AsyncSession uses a single underlying async connection.
  Concurrent coroutines on the same session via gather can interleave
  in ways the session isn't designed for. Sequential queries are safe and
  fast enough for 4 small SELECT queries (<5ms total).
"""

from __future__ import annotations

import json
from datetime import date, datetime, time as time_obj
from typing import AsyncGenerator, TYPE_CHECKING

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ai.llm import get_nim_client
from ai.prompts import ai_coach_system_prompt
from core.config import settings
from features.chat.models import Chat, Message
from features.chat.repository import ChatRepository
from features.chat.schemas import ChatCreate, ChatResponse, MessageResponse
from features.habits.models import Habit
from features.knowledge.service import KnowledgeService
from features.learning_plans.models import LearningPlan
from features.mood.models import Mood
from features.tasks.models import Task
from core.enums import TaskStatus

if TYPE_CHECKING:
    from features.auth.models import User


# ---------------------------------------------------------------------------
# Tool definitions — mirrors src/app/api/chat/route.ts
# ---------------------------------------------------------------------------
_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a task as completed",
            "parameters": {
                "type": "object",
                "properties": {
                    "taskId": {
                        "type": "string",
                        "description": "The ID of the task to complete",
                    }
                },
                "required": ["taskId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_mood",
            "description": "Log the user's current mood",
            "parameters": {
                "type": "object",
                "properties": {
                    "mood": {
                        "type": "string",
                        "description": "The mood to log (e.g., happy, stressed, motivated)",
                    }
                },
                "required": ["mood"],
            },
        },
    },
]


class ChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._repo = ChatRepository(db)

    # ------------------------------------------------------------------
    # Chat CRUD
    # ------------------------------------------------------------------

    async def list_chats(self, user_id: str) -> list[ChatResponse]:
        chats = await self._repo.get_chats_by_user(user_id)
        return [ChatResponse.model_validate(c) for c in chats]

    async def create_chat(self, user_id: str, data: ChatCreate) -> ChatResponse:
        chat = await self._repo.create_chat(user_id=user_id, title=data.title)
        return ChatResponse.model_validate(chat)

    async def get_chat(self, user_id: str, chat_id: str) -> Chat | None:
        """Return a chat only if it belongs to user_id."""
        chat = await self._repo.get_chat_by_id(chat_id)
        if chat is None or chat.user_id != user_id:
            return None
        return chat

    async def update_chat_title(
        self, user_id: str, chat_id: str, title: str
    ) -> Chat | None:
        return await self._repo.update_chat_title(
            chat_id=chat_id, user_id=user_id, title=title
        )

    async def delete_chat(self, user_id: str, chat_id: str) -> None:
        await self._repo.delete_chat(chat_id=chat_id, user_id=user_id)

    async def get_messages(
        self, user_id: str, chat_id: str
    ) -> list[MessageResponse] | None:
        """Return messages for a chat; None if chat not found / not owned."""
        chat = await self.get_chat(user_id, chat_id)
        if chat is None:
            return None
        msgs = await self._repo.get_messages(chat_id)
        return [MessageResponse.model_validate(m) for m in msgs]

    async def create_message(
        self, user_id: str, chat_id: str, role: str, content: str
    ) -> MessageResponse | None:
        """Append a message; None if chat not found / not owned."""
        chat = await self.get_chat(user_id, chat_id)
        if chat is None:
            return None
        msg = await self._repo.create_message(
            chat_id=chat_id, role=role, content=content
        )
        return MessageResponse.model_validate(msg)

    async def delete_message(
        self, user_id: str, chat_id: str, message_id: str
    ) -> bool:
        """Delete a message; False if chat not owned."""
        chat = await self.get_chat(user_id, chat_id)
        if chat is None:
            return False
        await self._repo.delete_message(message_id=message_id)
        return True

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    async def stream_response(
        self,
        current_user: "User",
        messages: list[dict],
    ) -> AsyncGenerator[str, None]:
        """
        Async generator — yields text chunks for the streaming response.

        PHASE 1 (before first yield): build context + system prompt.
        PHASE 2 (yields): run the agentic LLM loop.

        The DB queries in PHASE 1 happen before the first chunk is emitted.
        This means the client waits for context + RAG before tokens start
        flowing — typically 200-500ms (RAG embedding is the bottleneck).

        Args:
            current_user: The authenticated User ORM object.
            messages: Full conversation history in OpenAI format.
        """
        user_name = current_user.name or current_user.email or "User"

        # PHASE 1: Build context (all blocking I/O, no yields yet)
        system_prompt = await self._build_system_prompt(
            user_id=current_user.id,
            user_name=user_name,
            messages=messages,
        )
        full_messages = [{"role": "system", "content": system_prompt}, *messages]

        # PHASE 2: Agentic loop — this is where we yield tokens
        async for chunk in self._run_agentic_loop(current_user.id, full_messages):
            yield chunk

    # ------------------------------------------------------------------
    # Private: context builder
    # ------------------------------------------------------------------

    async def _build_system_prompt(
        self,
        user_id: str,
        user_name: str,
        messages: list[dict],
    ) -> str:
        """
        Fetch user context from the DB and run RAG, then build the system prompt.

        4 sequential DB queries (safe on a single AsyncSession):
          1. Latest LearningPlan (active plan topic)
          2. Today's Task rows (id, title, status)
          3. All Habit rows (name, streak)
          4. Most recent Mood entry

        Then RAG: embed the last user message → similarity search → context block.

        The result is the full system prompt string passed to the LLM.
        """
        today_start = datetime.combine(date.today(), time_obj.min)
        today_end = datetime.combine(date.today(), time_obj.max)

        # 1. Active learning plan
        plan_result = await self.db.execute(
            select(LearningPlan)
            .where(LearningPlan.user_id == user_id)
            .order_by(LearningPlan.created_at.desc())
            .limit(1)
        )
        active_plan = plan_result.scalar_one_or_none()

        # 2. Today's tasks
        tasks_result = await self.db.execute(
            select(Task.id, Task.title, Task.status)
            .where(Task.user_id == user_id)
            .where(Task.due_date >= today_start)
            .where(Task.due_date <= today_end)
        )
        today_tasks = [
            {"id": row.id, "title": row.title, "status": row.status.value}
            for row in tasks_result.all()
        ]

        # 3. All habits
        habits_result = await self.db.execute(
            select(Habit.name, Habit.streak).where(Habit.user_id == user_id)
        )
        habits = [
            {"name": row.name, "streak": row.streak}
            for row in habits_result.all()
        ]

        # 4. Most recent mood
        mood_result = await self.db.execute(
            select(Mood.mood)
            .where(Mood.user_id == user_id)
            .order_by(Mood.created_at.desc())
            .limit(1)
        )
        mood_row = mood_result.first()
        recent_mood = mood_row.mood if mood_row else None

        # 5. RAG: embed last user message → retrieve relevant chunks
        last_user_msg = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            None,
        )
        rag_context = ""
        if last_user_msg:
            try:
                ks = KnowledgeService(self.db)
                chunks = await ks.search(user_id, last_user_msg, top_k=5)
                rag_context = KnowledgeService.build_context_block(chunks)
            except Exception:
                # RAG failure must never block the chat — silently skip
                pass

        # 6. Build system prompt
        base_prompt = ai_coach_system_prompt(
            user_name=user_name,
            active_plan_topic=active_plan.topic if active_plan else None,
            active_plan_progress=0,  # TODO: calculate from task completion rate
            today_tasks=today_tasks,
            habits=habits,
            recent_mood=recent_mood,
        )

        return base_prompt + rag_context

    # ------------------------------------------------------------------
    # Private: agentic streaming loop
    # ------------------------------------------------------------------

    async def _run_agentic_loop(
        self,
        user_id: str,
        messages: list[dict],
        max_turns: int = 2,
    ) -> AsyncGenerator[str, None]:
        """
        Stream one LLM turn with tool call support.

        If the model outputs text tokens → yield them to the client.
        If the model calls tools → execute them silently, then recurse
        for the follow-up response (max_turns prevents infinite loops).

        TOOL CALL ACCUMULATION:
        In streaming mode, tool call data arrives across many chunks:
          Chunk 1: delta.tool_calls[0].id = "call_abc123"
          Chunk 2: delta.tool_calls[0].function.name = "complete_"
          Chunk 3: delta.tool_calls[0].function.name = "task"
          Chunk 4: delta.tool_calls[0].function.arguments = '{"taskId":'
          Chunk 5: delta.tool_calls[0].function.arguments = '"abc"}'
        We accumulate these into pending_tool_calls[index] dict.
        """
        if max_turns == 0:
            return

        client = get_nim_client()
        stream = await client.chat.completions.create(
            model=settings.NIM_MODEL_CHAT,
            messages=messages,  # type: ignore[arg-type]
            tools=_TOOLS,  # type: ignore[arg-type]
            tool_choice="auto",
            temperature=0.4,
            max_tokens=4096,
            top_p=0.95,
            stream=True,
        )

        # pending_tool_calls: index → accumulated dict
        pending_tool_calls: dict[int, dict] = {}

        async for chunk in stream:
            delta = chunk.choices[0].delta

            # Text token — yield directly to the streaming response
            if delta.content:
                yield delta.content

            # Tool call delta — accumulate silently (no yield)
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    idx = tc.index
                    if idx not in pending_tool_calls:
                        pending_tool_calls[idx] = {
                            "id": "",
                            "type": "function",
                            "function": {"name": "", "arguments": ""},
                        }
                    # id only appears on the first chunk for this tool call
                    if tc.id:
                        pending_tool_calls[idx]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            pending_tool_calls[idx]["function"]["name"] += (
                                tc.function.name
                            )
                        if tc.function.arguments:
                            pending_tool_calls[idx]["function"]["arguments"] += (
                                tc.function.arguments
                            )

        # No tool calls — we're done
        if not pending_tool_calls:
            return

        # Tool calls present — execute each one, then recurse for the final answer
        tool_call_list = [
            pending_tool_calls[k] for k in sorted(pending_tool_calls.keys())
        ]
        next_messages: list[dict] = [
            *messages,
            {"role": "assistant", "tool_calls": tool_call_list},
        ]

        for tc in tool_call_list:
            result = await self._execute_tool(
                user_id=user_id,
                name=tc["function"]["name"],
                args_str=tc["function"]["arguments"],
            )
            next_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": tc["function"]["name"],
                    "content": result,
                }
            )

        # Recurse for the follow-up response after tool results
        async for chunk in self._run_agentic_loop(
            user_id, next_messages, max_turns=max_turns - 1
        ):
            yield chunk

    # ------------------------------------------------------------------
    # Private: tool execution
    # ------------------------------------------------------------------

    async def _execute_tool(
        self, *, user_id: str, name: str, args_str: str
    ) -> str:
        """
        Execute a tool call from the AI Coach.

        SECURITY: Every mutation is scoped to user_id so the model cannot
        affect another user's data even if it hallucinates a different ID.

        Returns a JSON string result that is fed back to the model as
        a "tool" role message.
        """
        try:
            args = json.loads(args_str)

            if name == "complete_task":
                task_id = args.get("taskId", "")
                # Update scoped to user_id to prevent cross-user mutations
                await self.db.execute(
                    update(Task)
                    .where(Task.id == task_id, Task.user_id == user_id)
                    .values(
                        status=TaskStatus.COMPLETED,
                        completed_at=datetime.utcnow(),
                    )
                )
                await self.db.flush()
                return json.dumps(
                    {"success": True, "message": "Task marked as completed"}
                )

            if name == "log_mood":
                mood_str = args.get("mood", "")
                mood_entry = Mood(user_id=user_id, mood=mood_str)
                self.db.add(mood_entry)
                await self.db.flush()
                return json.dumps(
                    {"success": True, "message": "Mood logged successfully"}
                )

        except (json.JSONDecodeError, KeyError, Exception) as exc:
            return json.dumps({"success": False, "error": str(exc)})

        return json.dumps({"success": False, "error": f"Unknown tool: {name}"})
