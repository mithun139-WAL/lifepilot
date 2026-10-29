"""
main.py

FastAPI application factory.

THE MENTAL MODEL (MERN comparison):
This is your server.js or app.js. It:
- Creates the FastAPI application instance
- Registers middleware (CORS, logging)
- Registers routers (features)
- Registers exception handlers
- Defines lifecycle hooks (startup, shutdown)

WHY APP FACTORY PATTERN:
Creating the app in a function (create_app()) instead of at module level:
- Makes the app testable (tests create fresh instances with overrides)
- Prevents circular imports from top-level app usage
- Follows the same pattern as Flask's create_app(), familiar if you've seen it

LIFESPAN vs ON_EVENT:
FastAPI 0.93+ uses the lifespan context manager instead of @app.on_event("startup").
The lifespan handler runs setup before yield and teardown after.
This is the current recommended pattern.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from core.config import settings
from core.database import check_db_connection
from core.exceptions import register_exception_handlers

# Eagerly import all SQLAlchemy models so that they are registered
# with the declarative Base metadata before mapping compilation runs.
# This prevents "failed to locate a name" errors for cross-feature relationships.
from features.auth.models import User, VerificationToken, Account  # noqa: F401
from features.goals.models import Goal  # noqa: F401
from features.learning_plans.models import LearningPlan  # noqa: F401
from features.planners.models import Planner  # noqa: F401
from features.tasks.models import Task, Checklist  # noqa: F401
from features.habits.models import Habit, HabitProgress  # noqa: F401
from features.mood.models import Mood  # noqa: F401
from features.knowledge.models import KnowledgeChunk  # noqa: F401
from features.chat.models import Chat, Message  # noqa: F401

# Configure logging before anything else
logging.basicConfig(
    level=logging.DEBUG if settings.is_development else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifecycle manager.
    
    Code before `yield` runs on startup.
    Code after `yield` runs on shutdown.
    
    Use this for:
    - Verifying database connectivity
    - Warming up connection pools
    - Loading ML models into memory (future: embedding models)
    - Gracefully closing connections on shutdown
    """
    # ---- Startup ----
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Verify database is reachable before accepting requests
    # Fail fast is better than accepting requests that will all fail at the DB layer
    db_ok = await check_db_connection()
    if not db_ok:
        logger.critical("Database connection failed on startup!")
        # In production, this would trigger a health check failure
        # and the orchestrator (Kubernetes, Railway) would restart the pod
    else:
        logger.info("Database connection verified")

    yield

    # ---- Shutdown ----
    logger.info("Shutting down — closing database connections")
    # SQLAlchemy's async engine handles pool cleanup automatically
    # Add explicit cleanup here if you add Redis, background workers, etc.


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Centralizing app creation here means tests can call create_app()
    with test-specific settings without affecting the production instance.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="LifePilot AI coaching backend API",
        # Only show OpenAPI docs in non-production environments
        # Exposing /docs in production is a security risk
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # Middleware (order matters — applied in reverse order)
    # ------------------------------------------------------------------

    # CORS — CRITICAL for your Next.js frontend
    # In development: allow localhost:3000
    # In production: only allow your actual frontend domain
    #
    # WHY NOT allow_origins=["*"] in production:
    # A wildcard CORS policy with allow_credentials=True is a security
    # vulnerability — it allows any website to make authenticated requests
    # to your API on behalf of your users.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.FRONTEND_URL,
            # Add additional origins if needed (e.g., Vercel preview URLs)
        ],
        allow_credentials=True,   # Required for cookies and auth headers
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # GZip compression for responses > 1KB
    # Reduces bandwidth for large AI responses (coaching messages, plans)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # ------------------------------------------------------------------
    # Exception handlers
    # ------------------------------------------------------------------
    register_exception_handlers(app)

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    _register_routers(app)

    return app


def _register_routers(app: FastAPI) -> None:
    """
    Register all feature routers.
    
    All API routes are prefixed with /api/v1 to:
    1. Namespace the API (avoids conflicts with frontend serving from same domain)
    2. Enable versioning (v1 → v2 without breaking existing clients)
    
    MIGRATION STRATEGY:
    During the incremental migration, your Next.js frontend calls /api/...
    Your FastAPI backend serves /api/v1/...
    
    The frontend makes calls to both in parallel:
    - New features → FastAPI (/api/v1/...)
    - Existing features → Next.js API routes (/api/...)
    - As each Next.js route is replaced, update the frontend to use /api/v1/
    
    This is the strangler fig pattern — no big bang rewrite.
    """
    from features.auth.router import router as auth_router
    from features.goals.router import router as goals_router
    from features.learning_plans.router import router as learning_plans_router
    from features.tasks.router import router as tasks_router
    from features.habits.router import router as habits_router
    from features.mood.router import router as mood_router
    from features.planners.router import router as planners_router
    from features.knowledge.router import router as knowledge_router
    from features.chat.router import router as chat_router
    from features.insights.router import router as insights_router
    from features.dashboard.router import router as dashboard_router
    from features.onboarding.router import router as onboarding_router

    # Future routers (uncomment as you implement each phase):
    # (nothing left for the core features)

    API_PREFIX = "/api/v1"

    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(goals_router, prefix=API_PREFIX)
    app.include_router(learning_plans_router, prefix=API_PREFIX)
    app.include_router(tasks_router, prefix=API_PREFIX)
    app.include_router(habits_router, prefix=API_PREFIX)
    app.include_router(mood_router, prefix=API_PREFIX)
    app.include_router(planners_router, prefix=API_PREFIX)
    app.include_router(knowledge_router, prefix=API_PREFIX)
    app.include_router(chat_router, prefix=API_PREFIX)
    app.include_router(insights_router, prefix=API_PREFIX)
    app.include_router(dashboard_router, prefix=API_PREFIX)
    app.include_router(onboarding_router, prefix=API_PREFIX)

    # ------------------------------------------------------------------
    # Health check endpoint
    # ------------------------------------------------------------------
    @app.get("/health", tags=["Infrastructure"])
    async def health_check() -> dict:
        """
        Health check for load balancers and orchestrators.
        
        Returns 200 if the API is healthy.
        Railway, Render, and Kubernetes use this to determine if
        the container should receive traffic.
        """
        db_ok = await check_db_connection()
        return {
            "status": "healthy" if db_ok else "degraded",
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "database": "connected" if db_ok else "disconnected",
        }


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------
# This is what uvicorn runs: `uvicorn main:app`
app = create_app()
