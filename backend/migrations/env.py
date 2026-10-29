"""
migrations/env.py

Alembic migration environment configuration for async SQLAlchemy.

WHY ALEMBIC INSTEAD OF JUST USING PRISMA:
You could keep using Prisma for schema management during the transition.
However, as you migrate Python models, Alembic becomes the source of truth
for schema changes on the Python side.

Migration strategy during the transition period:
1. KEEP Prisma for existing tables that haven't been migrated yet
2. Use Alembic for NEW tables you add in the Python backend
3. Once all models are in SQLAlchemy, cut over completely to Alembic

ASYNC ALEMBIC:
Standard Alembic is synchronous. Async SQLAlchemy requires special handling.
The `run_async_migrations()` function below uses asyncio.run() to bridge
the sync Alembic CLI with our async engine.

GENERATING MIGRATIONS:
    # From backend/ directory:
    alembic revision --autogenerate -m "add new table"
    alembic upgrade head

CHECKING CURRENT MIGRATION STATE:
    alembic current
    alembic history
"""

import asyncio
from logging.config import fileConfig
from typing import Any

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import settings before models to ensure env vars are loaded
from core.config import settings

# Import Base and ALL models so Alembic can detect them for autogenerate.
# If you forget to import a model here, Alembic won't know it exists
# and won't generate migrations for it.
from core.database import Base

# Import all models — add new models here as you create them
from features.auth.models import User, VerificationToken, Account  # noqa: F401
from features.goals.models import Goal  # noqa: F401
from features.learning_plans.models import LearningPlan  # noqa: F401
from features.planners.models import Planner  # noqa: F401
from features.tasks.models import Task, Checklist  # noqa: F401
from features.habits.models import Habit, HabitProgress  # noqa: F401
from features.mood.models import Mood  # noqa: F401
from features.knowledge.models import KnowledgeChunk  # noqa: F401
from features.chat.models import Chat, Message  # noqa: F401

# ---------------------------------------------------------------------------
# Alembic configuration
# ---------------------------------------------------------------------------
config = context.config

# Use logging config from alembic.ini if present
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point Alembic at our models' metadata for autogenerate support
target_metadata = Base.metadata

# Override the SQLAlchemy URL from our settings
# This ensures migrations use the same DB as the application
config.set_main_option("sqlalchemy.url", settings.database_url_str)


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    Generates SQL scripts without connecting to the DB.
    Useful for reviewing migrations before applying them,
    or for applying migrations through a DBA.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # compare_type=True lets Alembic detect column type changes.
        # Without this, changing String(100) to String(200) won't be detected.
        compare_type=True,
        # Render as batch operations for SQLite compatibility (not needed for Postgres
        # but doesn't hurt)
        render_as_batch=False,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    Run migrations using the async engine.
    
    This bridges Alembic's synchronous interface with our async engine.
    The `sync_engine` wrapper allows Alembic to work with the async engine
    by running sync operations through asyncio.
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Don't pool connections for migrations
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to DB and applies migrations)."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
