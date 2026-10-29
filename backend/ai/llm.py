"""
ai/llm.py

NVIDIA NIM LLM client factory with model routing.

WHAT IS NVIDIA NIM:
NIM (NVIDIA Inference Microservices) is NVIDIA's hosted inference platform.
It exposes a fully OpenAI-compatible API — same /v1/chat/completions endpoint,
same request/response shape, same streaming protocol.

This means we use the standard `openai` Python SDK pointed at:
    base_url = "https://integrate.api.nvidia.com/v1"
    api_key  = <your NIM API key>

No custom SDKs needed. No vendor lock-in. If you ever want to switch back to
OpenAI or to a self-hosted model, you change two lines in config.py.

WHY DIFFERENT MODELS PER USE CASE:
This is one of the most important cost and quality decisions in AI engineering.

The common beginner mistake is using one powerful model for everything.
In production this creates:
- Unnecessary cost (a 70B model for a 3-word mood label is wasteful)
- Unnecessary latency (8B responds in ~300ms; 70B takes 1-3 seconds)
- Rate limit bottlenecks (your budget burns fast on simple tasks)

The right mental model: "use the smallest model that meets quality requirements".

Think of it like hiring:
- Don't use a senior engineer to write a shell script
- Don't use a junior engineer to design the core architecture

MODEL ASSIGNMENTS FOR THIS APP:

  ┌─────────────────────────────┬──────────────────────────────────────────────┐
  │ Use Case                    │ Model                                        │
  ├─────────────────────────────┼──────────────────────────────────────────────┤
  │ Chat / AI Coach             │ nvidia/llama-3.1-nemotron-70b-instruct       │
  │                             │ → Best conversational AI, NVIDIA fine-tuned  │
  │                             │ → Tool calling, multi-turn, RAG-augmented    │
  ├─────────────────────────────┼──────────────────────────────────────────────┤
  │ Planner (4-stage pipeline)  │ meta/llama-3.3-70b-instruct                 │
  │                             │ → Meta's latest, strong structured output    │
  │                             │ → Complex multi-step instruction following   │
  ├─────────────────────────────┼──────────────────────────────────────────────┤
  │ Task Generation             │ mistralai/mixtral-8x7b-instruct-v0.1        │
  │                             │ → MoE architecture: fast + high quality      │
  │                             │ → Reliable JSON generation                   │
  ├─────────────────────────────┼──────────────────────────────────────────────┤
  │ RAG Synthesis               │ meta/llama-3.1-70b-instruct                 │
  │                             │ → Good at context integration                │
  │                             │ → Cheaper than Nemotron for retrieval tasks  │
  ├─────────────────────────────┼──────────────────────────────────────────────┤
  │ Suggestions / Analysis      │ meta/llama-3.1-8b-instruct                  │
  │ / Mood / Onboarding         │ → Fast (~200ms), cheap, adequate quality     │
  │                             │ → Short context, simple outputs              │
  └─────────────────────────────┴──────────────────────────────────────────────┘
"""

from __future__ import annotations

from enum import Enum
from typing import AsyncIterator

from langchain_openai import ChatOpenAI
from openai import AsyncOpenAI

from core.config import settings


# ---------------------------------------------------------------------------
# Use case enum
# ---------------------------------------------------------------------------
class LLMUseCase(str, Enum):
    """
    Declares every AI use case in the application.
    
    Using an Enum instead of raw strings:
    - IDE autocomplete prevents typos
    - All use cases visible in one place
    - Easy to audit "what uses which model"
    - Type-safe — passing an invalid string is a runtime error at the enum level
    """
    CHAT = "chat"                   # Primary AI coaching conversation
    PLANNER = "planner"             # 4-stage plan generation pipeline
    TASKS = "tasks"                 # Task/checklist generation from plan stage
    RAG = "rag"                     # Synthesise answer from retrieved context
    SUGGESTIONS = "suggestions"     # Dashboard smart suggestions
    ANALYSIS = "analysis"           # Mood trends, insight summaries, habit patterns


# ---------------------------------------------------------------------------
# Model routing table
# ---------------------------------------------------------------------------
# Maps each use case to the configured model name.
# This is the single source of truth for model assignments.
# Changing a model for a use case = one line change here (or in .env).
def _get_model_for_use_case(use_case: LLMUseCase) -> str:
    return {
        LLMUseCase.CHAT:        settings.NIM_MODEL_CHAT,
        LLMUseCase.PLANNER:     settings.NIM_MODEL_PLANNER,
        LLMUseCase.TASKS:       settings.NIM_MODEL_TASKS,
        LLMUseCase.RAG:         settings.NIM_MODEL_RAG,
        LLMUseCase.SUGGESTIONS: settings.NIM_MODEL_SUGGESTIONS,
        LLMUseCase.ANALYSIS:    settings.NIM_MODEL_ANALYSIS,
    }[use_case]


# ---------------------------------------------------------------------------
# Raw OpenAI-compatible async client
# ---------------------------------------------------------------------------
# Use this for direct API calls, streaming responses, and cases where you
# need fine-grained control over the request (tool definitions, response_format).
#
# This client is a module-level singleton — creating AsyncOpenAI is cheap
# (just sets up httpx internals), but there's no reason to create it per-request.
_nim_client = AsyncOpenAI(
    api_key=settings.nim_api_key_str,
    base_url=settings.NIM_BASE_URL,
)


def get_nim_client() -> AsyncOpenAI:
    """
    Return the shared NVIDIA NIM async client.
    
    WHY NOT CREATE PER REQUEST:
    AsyncOpenAI internally manages an httpx.AsyncClient with a connection pool.
    Creating a new client per request would defeat the pool and hammer NIM
    with new TLS handshakes on every request.
    Reusing one client allows connection keepalive — much lower latency.
    """
    return _nim_client


# ---------------------------------------------------------------------------
# LangChain ChatOpenAI wrappers — per use case
# ---------------------------------------------------------------------------
# Use these when you need LangChain features:
# - Chains (.pipe(), LCEL)
# - Prompt templates
# - Output parsers
# - Memory integration (Phase 4+)
# - LangGraph nodes (Phase 8+)
#
# Each function creates a configured ChatOpenAI instance pointing at NIM.

def get_chat_llm(
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
    streaming: bool = True,
) -> ChatOpenAI:
    """
    LLM for the AI coaching chat interface.
    
    Model: nvidia/llama-3.1-nemotron-70b-instruct
    
    WHY NEMOTRON FOR CHAT:
    Nemotron-70B is NVIDIA's instruction-tuned variant of Llama 3.1 70B.
    It's specifically fine-tuned for:
    - Extended multi-turn dialogue
    - Following nuanced system prompts
    - Tool/function calling accuracy
    - Reduced hallucination on personal advice contexts
    
    streaming=True by default because your existing chat already uses
    streaming (chunked text stream). Users feel the coach is "thinking"
    in real time — critical for engagement.
    """
    return ChatOpenAI(
        model=settings.NIM_MODEL_CHAT,
        api_key=settings.nim_api_key_str,
        base_url=settings.NIM_BASE_URL,
        temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
        max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
        streaming=streaming,
    )


def get_planner_llm(
    *,
    temperature: float = 0.4,
    max_tokens: int = 8192,
) -> ChatOpenAI:
    """
    LLM for the multi-stage plan generation pipeline.
    
    Model: meta/llama-3.3-70b-instruct
    
    WHY LOWER TEMPERATURE (0.4):
    Plan generation needs to be deterministic and structured.
    High temperature → creative, varied outputs (good for chat)
    Low temperature  → consistent, instruction-following outputs (good for plans)
    
    At 0.4, the model follows the JSON schema strictly without hallucinating
    extra weeks or phantom topics.
    
    WHY 8192 MAX TOKENS:
    The planner generates full week-by-week breakdowns with multiple tasks each.
    A 12-week plan with 5 tasks per week can easily exceed 4096 tokens.
    Llama 3.3 70B supports 128K context — 8192 output is well within limits.
    """
    return ChatOpenAI(
        model=settings.NIM_MODEL_PLANNER,
        api_key=settings.nim_api_key_str,
        base_url=settings.NIM_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=False,   # Plan generation is batch — no streaming needed
    )


def get_tasks_llm(
    *,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> ChatOpenAI:
    """
    LLM for individual task/checklist generation.
    
    Model: mistralai/mixtral-8x7b-instruct-v0.1
    
    WHY MIXTRAL FOR TASKS:
    Mixtral uses a Mixture-of-Experts (MoE) architecture — 8 expert sub-networks,
    2 active per token. This gives it near-70B quality for structured generation
    at roughly 13B active parameter cost (faster, cheaper).
    
    Task generation is highly repetitive and schema-bound (JSON with specific
    fields). Mixtral is excellent at this. You don't need Llama 70B to generate
    "Task: Review Chapter 3, Duration: 45min, Checklist: [Read, Notes, Quiz]".
    """
    return ChatOpenAI(
        model=settings.NIM_MODEL_TASKS,
        api_key=settings.nim_api_key_str,
        base_url=settings.NIM_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=False,
    )


def get_rag_llm(
    *,
    temperature: float = 0.5,
    max_tokens: int = 2048,
) -> ChatOpenAI:
    """
    LLM for RAG answer synthesis.
    
    Model: meta/llama-3.1-70b-instruct
    
    WHY A DIFFERENT 70B FOR RAG vs CHAT:
    RAG synthesis is a more constrained task than open coaching:
    - The model has retrieved context to work from (less hallucination risk)
    - The output is a factual summary, not an empathetic conversation
    - We don't need Nemotron's dialogue fine-tuning here
    
    llama-3.1-70b is slightly faster and cheaper than Nemotron-70B while
    being equally capable for context-grounded answers.
    """
    return ChatOpenAI(
        model=settings.NIM_MODEL_RAG,
        api_key=settings.nim_api_key_str,
        base_url=settings.NIM_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=False,
    )


def get_fast_llm(
    *,
    temperature: float = 0.5,
    max_tokens: int = 1024,
) -> ChatOpenAI:
    """
    Fast, cheap LLM for simple tasks: suggestions, mood analysis, classification.
    
    Model: meta/llama-3.1-8b-instruct
    
    WHY 8B FOR THESE TASKS:
    The suggestions endpoint receives: today's tasks (list) + recent mood (string).
    That's ~200 tokens of input. The output is 3 bullet points (~100 tokens).
    
    Running this on Nemotron-70B would be like using a supercomputer to sort
    a 5-element list. 8B handles it in ~200ms at a fraction of the cost.
    
    Cost implication: if 1000 users hit the dashboard simultaneously,
    the difference between 8B and 70B here is roughly 10x in API cost.
    """
    return ChatOpenAI(
        model=settings.NIM_MODEL_SUGGESTIONS,
        api_key=settings.nim_api_key_str,
        base_url=settings.NIM_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=False,
    )


# ---------------------------------------------------------------------------
# Convenience: get LLM by use case
# ---------------------------------------------------------------------------
def get_llm_for(use_case: LLMUseCase, **kwargs: object) -> ChatOpenAI:
    """
    Get the appropriate LangChain LLM for a given use case.
    
    This is the primary entry point for services that don't need to know
    which specific model is being used — they just declare their intent:
    
        llm = get_llm_for(LLMUseCase.PLANNER)
        result = await llm.ainvoke(messages)
    
    The model routing table handles the rest. If NVIDIA releases a better
    model tomorrow, you update config.py — no service code changes.
    """
    dispatch = {
        LLMUseCase.CHAT:        get_chat_llm,
        LLMUseCase.PLANNER:     get_planner_llm,
        LLMUseCase.TASKS:       get_tasks_llm,
        LLMUseCase.RAG:         get_rag_llm,
        LLMUseCase.SUGGESTIONS: get_fast_llm,
        LLMUseCase.ANALYSIS:    get_fast_llm,
    }
    return dispatch[use_case](**kwargs)  # type: ignore[operator]


# ---------------------------------------------------------------------------
# Streaming helper (raw client)
# ---------------------------------------------------------------------------
async def stream_chat_completion(
    *,
    messages: list[dict[str, str]],
    use_case: LLMUseCase = LLMUseCase.CHAT,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> AsyncIterator[str]:
    """
    Stream a chat completion token by token using the raw NIM client.
    
    Use this for FastAPI streaming responses (StreamingResponse / SSE).
    
    WHY USE THE RAW CLIENT FOR STREAMING:
    LangChain's streaming works well within chains (.astream()), but for
    FastAPI's StreamingResponse we need a raw async generator that yields
    text chunks as they arrive.
    
    The raw OpenAI client gives us exactly that with streaming=True.
    
    Usage in a route:
        async def chat_stream():
            async for chunk in stream_chat_completion(messages=msgs):
                yield f"data: {chunk}\\n\\n"
        
        return StreamingResponse(chat_stream(), media_type="text/event-stream")
    """
    model = _get_model_for_use_case(use_case)
    client = get_nim_client()

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        temperature=temperature or settings.LLM_TEMPERATURE,
        max_tokens=max_tokens or settings.LLM_MAX_TOKENS,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta is not None:
            yield delta
