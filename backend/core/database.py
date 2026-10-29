"""
core/database.py

Async SQLAlchemy engine, session factory, and base model class.

THE MENTAL MODEL (MERN comparison):
In MERN: Mongoose.connect() establishes a connection pool, then model.find() borrows
a connection from that pool, runs the query, and returns it.

SQLAlchemy async works the same way:
- create_async_engine() = Mongoose.connect() (one engine for the whole app)
- AsyncSession = one unit of work (one request's worth of DB interaction)
- async_sessionmaker() = a factory that creates sessions on demand

WHY ASYNC MATTERS FOR AI WORKLOADS:
Your app will make LLM calls that take 2-10 seconds each.
During that time, a synchronous server would be blocked — unable to handle
any other requests on that thread.

FastAPI + asyncio means: while waiting for Groq to respond, the event loop
handles 50 other requests. This is critical for an AI app under load.

The async chain MUST be end-to-end:
  async def route → async def service → async def repository → await db.execute()
  
If any link in this chain is synchronous (e.g., using psycopg2 or synchronous
SQLAlchemy), you lose the benefit and may actually degrade performance.
"""

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, MappedColumn

from core.config import settings


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
# The engine manages the connection pool. Create exactly ONE per process.
# 
# pool_pre_ping=True:
#   Before lending a connection from the pool, SQLAlchemy sends a lightweight
#   "ping" to verify it's still alive. Without this, long-idle connections
#   (e.g., app sitting idle overnight) fail on first use.
#   Small overhead (~0.1ms), but prevents cryptic "connection closed" errors.
#
# echo=False in production:
#   echo=True logs every SQL statement — useful in development, catastrophic
#   in production (log volume, performance, potential data leakage in logs).
engine = create_async_engine(
    settings.database_url_str,
    connect_args=settings.database_connect_args,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    echo=settings.is_development,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
# async_sessionmaker creates AsyncSession objects.
# 
# expire_on_commit=False:
#   By default, SQLAlchemy "expires" all ORM objects after commit — meaning
#   the next attribute access triggers a new SELECT. In async code, attribute
#   access outside an active session raises an error.
#   Setting expire_on_commit=False means objects remain usable after commit.
#   This is the correct default for FastAPI where sessions close after response.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------
# All your SQLAlchemy model classes inherit from this.
# It registers the model's table name and columns in SQLAlchemy's metadata,
# which Alembic reads to generate migrations.
class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy ORM models.
    
    Using the modern DeclarativeBase (SQLAlchemy 2.x) instead of the legacy
    declarative_base() function. The new style supports:
    - Mapped[] type annotations (full typing support)
    - MappedColumn for column definitions
    - Better IDE support
    """
    pass


# ---------------------------------------------------------------------------
# Session dependency
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session per request.
    
    HOW THIS WORKS (the mental model):
    FastAPI's dependency injection calls this function for each request that
    declares `db: AsyncSession = Depends(get_db)`.
    
    The `async with` creates a session, yields it to the route handler,
    then — regardless of success or failure — closes the session and returns
    the connection to the pool.
    
    Think of it as: each HTTP request gets its own "transaction scope".
    All DB operations in that request share the same session.
    If the request raises an exception, SQLAlchemy rolls back automatically.
    
    COMMON MISTAKE:
    Creating a new session inside a service or repository instead of injecting
    it. This leads to session leaks and connection pool exhaustion under load.
    Always inject the session — never create one ad hoc.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Health check utility
# ---------------------------------------------------------------------------
async def check_db_connection() -> bool:
    """
    Ping the database. Used by the /health endpoint.
    Failing fast here is better than letting a broken DB cause mysterious 500s.
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
