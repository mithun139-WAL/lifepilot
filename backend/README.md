# LifePilot Backend

FastAPI backend for the LifePilot AI coaching system.

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- PostgreSQL (same instance as your existing Next.js app)

## Setup

```bash
# Install uv (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
cd backend
uv sync

# Copy env file
cp .env.example .env
# Edit .env with your actual values
```

## Running the server

```bash
# Development (auto-reload on file changes)
uv run uvicorn main:app --reload --port 8000

# Or with the fastapi CLI (bundled with fastapi[standard])
uv run fastapi dev main.py --port 8000
```

API will be available at:
- `http://localhost:8000` — API
- `http://localhost:8000/docs` — Swagger UI (development only)
- `http://localhost:8000/health` — Health check

## Database Migrations

```bash
# Check current migration state
uv run alembic current

# Generate a new migration from model changes
uv run alembic revision --autogenerate -m "describe your change"

# Apply pending migrations
uv run alembic upgrade head

# Roll back one migration
uv run alembic downgrade -1
```

> **Note during migration phase:** Your existing Prisma-managed tables already
> exist in the database. Alembic will detect them and may try to drop/recreate
> them. Run `alembic revision --autogenerate` and review the generated file
> carefully before applying.

## Project Structure

```
backend/
├── main.py              # App factory, middleware, router registration
├── core/
│   ├── config.py        # All env vars (Pydantic Settings)
│   ├── database.py      # Async SQLAlchemy engine + session
│   ├── security.py      # JWT + bcrypt
│   ├── dependencies.py  # FastAPI DI (get_current_user, get_db)
│   └── exceptions.py    # Domain exceptions + global handlers
├── features/
│   └── auth/            # One directory per domain
│       ├── models.py    # SQLAlchemy ORM
│       ├── schemas.py   # Pydantic request/response
│       ├── repository.py # DB queries
│       ├── service.py   # Business logic
│       └── router.py    # HTTP endpoints
├── ai/                  # AI orchestration layer (Phase 4+)
├── integrations/        # Third-party services (email, calendar)
└── migrations/          # Alembic migration scripts
```

## Migration Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation (this file) | ✅ Done |
| 1 | Auth + User | ✅ Done |
| 2 | Goals + Learning Plans | 🔲 Next |
| 3 | Tasks + Habits | 🔲 Pending |
| 4 | Chat + Knowledge/RAG | 🔲 Pending |
| 5 | Insights + Dashboard | 🔲 Pending |
| 6 | Planner AI Pipeline | 🔲 Pending |
| 7 | LangChain refactor | 🔲 Pending |
| 8 | LangGraph agents | 🔲 Pending |

## Frontend Integration

During migration, the Next.js frontend calls both backends:
- **Existing features** → Next.js API routes at `/api/...`
- **Migrated features** → FastAPI at `/api/v1/...`

Update your Next.js environment:
```bash
# In frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Then update fetch calls one feature at a time as they're migrated.
