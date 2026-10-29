"""
core/config.py

Centralized, typed configuration using Pydantic Settings.

WHY THIS MATTERS:
In MERN you typically access process.env.FOO directly anywhere in your code.
That pattern breaks down in production because:
1. No type safety — a missing env var silently becomes `undefined`
2. No validation — bad values cause runtime crashes far from the source
3. Scattered access makes config auditing impossible

Pydantic Settings solves this:
- All env vars declared in ONE place with types
- Validation runs at startup — the app refuses to start if config is invalid
- IDE autocomplete everywhere you use `settings`
- Easily testable — override settings per test without touching .env

PRODUCTION IMPLICATION:
On startup failure due to missing env vars, you get a clear ValidationError
listing exactly what's missing. No mysterious crashes 500ms into a request.
"""

from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Field types are validated at startup. SecretStr fields are redacted
    in logs and __repr__ — important for preventing secret leakage.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # DATABASE_URL and database_url both work
        extra="ignore",        # Don't fail on unknown env vars (useful in Docker)
    )

    # -------------------------------------------------------------------------
    # Application
    # -------------------------------------------------------------------------
    APP_NAME: str = "LifePilot API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # The URL the frontend will call. Used for CORS configuration.
    FRONTEND_URL: str = "http://localhost:3000"

    # -------------------------------------------------------------------------
    # Database
    # -------------------------------------------------------------------------
    # WHY asyncpg:
    # The standard psycopg2 driver is synchronous — it blocks the event loop.
    # asyncpg is a pure-Python async driver purpose-built for asyncio.
    # Using a sync driver in async code is one of the most common FastAPI mistakes
    # (it appears to work but kills throughput under load).
    DATABASE_URL: PostgresDsn

    # Connection pool tuning. These defaults suit a small-to-medium app.
    # For AI workloads (long LLM calls holding connections): keep pool_size low,
    # and let overflow handle burst traffic rather than holding idle connections.
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_scheme(cls, v: str) -> str:
        """
        SQLAlchemy async requires postgresql+asyncpg:// scheme.
        This validator auto-corrects postgres:// or postgresql:// URLs,
        which is what most hosting providers (Railway, Render, Supabase, Neon) give you.

        It also strips `sslmode` query parameters — asyncpg does NOT accept sslmode
        as a URL parameter (it's a libpq/psycopg2 concept). SSL for asyncpg is
        configured separately via connect_args; see database_connect_args below.
        """
        if isinstance(v, str):
            from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
            v = v.replace("postgres://", "postgresql+asyncpg://")
            v = v.replace("postgresql://", "postgresql+asyncpg://")
            # Strip sslmode — asyncpg rejects it as an unknown connect() kwarg
            parsed = urlparse(v)
            params = parse_qs(parsed.query, keep_blank_values=True)
            params.pop("sslmode", None)
            params.pop("channel_binding", None)  # also unsupported by asyncpg
            new_query = urlencode({k: vals[0] for k, vals in params.items()})
            v = urlunparse(parsed._replace(query=new_query))
        return v

    # -------------------------------------------------------------------------
    # JWT Authentication
    # -------------------------------------------------------------------------
    # WHY JWT over sessions:
    # Your Next.js backend already uses JWT (next-auth strategy: "jwt").
    # JWT is stateless — the server doesn't store session state.
    # This is correct for a horizontally scaled API.
    # The tradeoff: you cannot invalidate a token before expiry without a
    # blocklist (Redis-backed). We'll add that in a later phase.
    JWT_SECRET_KEY: SecretStr
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24        # 24 hours
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # -------------------------------------------------------------------------
    # AI / LLM — NVIDIA NIM
    # -------------------------------------------------------------------------
    # NVIDIA NIM exposes an OpenAI-compatible API, so we use the openai SDK
    # with a custom base_url. One API key works for all NIM-hosted models.
    #
    # NIM API reference: https://docs.api.nvidia.com/nim/reference
    # Get your key at: https://build.nvidia.com
    NIM_API_KEY: SecretStr
    NIM_BASE_URL: str = "https://integrate.api.nvidia.com/v1"

    # ── Per-use-case model assignments ────────────────────────────────────────
    # Different tasks have different quality/cost/latency requirements.
    # Using the right model for each task is a core AI engineering discipline.
    #
    # CHAT — highest quality, best conversational reasoning, tool calling.
    # nvidia/llama-3.1-nemotron-70b-instruct is NVIDIA's fine-tuned variant of
    # Llama 3.1 70B specifically optimized for instruction following, reasoning,
    # and multi-turn dialogue — the best fit for an AI coaching assistant.
    NIM_MODEL_CHAT: str = "nvidia/llama-3.1-nemotron-70b-instruct"

    # PLANNER — structured 4-stage generation pipeline.
    # meta/llama-3.3-70b-instruct is Meta's latest 70B, strong at following
    # complex multi-step instructions and producing structured JSON output.
    # Used for: Goal Interpretation → Roadmap → Per-week Tasks → Habits.
    NIM_MODEL_PLANNER: str = "meta/llama-3.3-70b-instruct"

    # TASKS — individual task/checklist generation from a plan stage.
    # mistralai/mixtral-8x7b-instruct-v0.1 (8x7B MoE) is fast, efficient,
    # and reliably produces structured JSON. Good cost-to-quality ratio for
    # repetitive generation where max quality isn't required.
    NIM_MODEL_TASKS: str = "mistralai/mixtral-8x7b-instruct-v0.1"

    # SUGGESTIONS — smart suggestions panel on the dashboard.
    # meta/llama-3.1-8b-instruct: small, fast, cheap. The suggestions prompt
    # has very short context (a few tasks + habits) and the output is brief.
    # No reason to pay for 70B-level reasoning here.
    NIM_MODEL_SUGGESTIONS: str = "meta/llama-3.1-8b-instruct"

    # ANALYSIS — mood trend analysis, insight summaries, habit pattern reading.
    # meta/llama-3.1-8b-instruct: same logic as suggestions — input is short,
    # output is simple classification/summary. 8B is sufficient.
    NIM_MODEL_ANALYSIS: str = "meta/llama-3.1-8b-instruct"

    # RAG SYNTHESIS — synthesising an answer from retrieved knowledge chunks.
    # Sits between chat and analysis quality: needs to reason over context
    # but doesn't need the full power of the chat model.
    NIM_MODEL_RAG: str = "meta/llama-3.1-70b-instruct"

    # ── Embeddings ────────────────────────────────────────────────────────────
    # nvidia/nv-embedqa-e5-v5 outputs 1024-dimensional vectors — an exact match
    # for your existing pgvector column (vector(1024)).
    # No schema migration needed. This is a direct drop-in replacement.
    NIM_EMBEDDING_MODEL: str = "nvidia/nv-embedqa-e5-v5"
    EMBEDDING_DIMENSIONS: int = 1024  # Must match the pgvector column

    # ── LLM generation defaults (overridable per-call) ────────────────────────
    LLM_TEMPERATURE: float = 0.6
    LLM_MAX_TOKENS: int = 4096

    # -------------------------------------------------------------------------
    # Google OAuth + Calendar
    # -------------------------------------------------------------------------
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: SecretStr = SecretStr("")

    # -------------------------------------------------------------------------
    # Email (Resend)
    # -------------------------------------------------------------------------
    RESEND_API_KEY: SecretStr = SecretStr("")
    EMAIL_FROM: str = "noreply@lifepilot.app"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24

    # -------------------------------------------------------------------------
    # GitHub OAuth
    # -------------------------------------------------------------------------
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: SecretStr = SecretStr("")

    # -------------------------------------------------------------------------
    # Computed properties
    # -------------------------------------------------------------------------
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def database_url_str(self) -> str:
        """Return the database URL as a plain string for SQLAlchemy."""
        return str(self.DATABASE_URL)

    @property
    def database_connect_args(self) -> dict:
        """
        asyncpg SSL connect_args.

        SSL cannot be expressed as a URL query parameter for asyncpg — it must
        be passed as a connect_arg. We infer whether SSL is needed by checking
        if the host is not localhost/127.0.0.1 (i.e. it's a remote Neon/Supabase
        database that requires TLS).
        """
        url = str(self.DATABASE_URL)
        is_local = "localhost" in url or "127.0.0.1" in url
        return {} if is_local else {"ssl": "require"}

    @property
    def nim_api_key_str(self) -> str:
        return self.NIM_API_KEY.get_secret_value()

    @property
    def jwt_secret_str(self) -> str:
        return self.JWT_SECRET_KEY.get_secret_value()


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    
    WHY lru_cache:
    Settings loads and validates env vars on instantiation.
    We only want this to happen once at startup, not on every request.
    lru_cache makes this a singleton without a global variable.
    
    In tests, you can override this:
        app.dependency_overrides[get_settings] = lambda: TestSettings(...)
    """
    return Settings()


# Module-level singleton for use outside FastAPI's DI system
# (e.g., in Alembic's env.py where you can't use Depends)
settings = get_settings()
