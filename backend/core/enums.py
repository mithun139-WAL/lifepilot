"""
core/enums.py

Shared Python enums and PostgreSQL enum column type definitions.

WHY CENTRALIZED:
TaskStatus is used in both Task and Checklist (separate feature modules).
HabitFrequency is used in Habit.
Centralizing avoids duplicate definitions and circular imports.

create_type=False EXPLAINED:
Prisma already created the PostgreSQL enum types ('TaskStatus', 'HabitFrequency')
when you ran `prisma migrate`. SQLAlchemy must reference them by name only —
NOT try to CREATE TYPE them again. create_type=False tells SQLAlchemy:
"This enum type exists in the DB, just use it by name."

If you accidentally omit create_type=False, Alembic autogenerate will try to
drop and recreate the enum types, which fails if there's existing data using them.
"""

import enum

from sqlalchemy.dialects.postgresql import ENUM as PGEnum


# ---------------------------------------------------------------------------
# Python enum classes (for type safety in Python code)
# ---------------------------------------------------------------------------

class TaskStatus(str, enum.Enum):
    """Mirrors the Prisma TaskStatus enum."""

    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class HabitFrequency(str, enum.Enum):
    """Mirrors the Prisma HabitFrequency enum."""

    DAILY = "DAILY"
    WEEKLY = "WEEKLY"


# ---------------------------------------------------------------------------
# SQLAlchemy PostgreSQL enum column types
# ---------------------------------------------------------------------------
# These are used as column types in mapped_column() definitions.
# They reference the existing PostgreSQL enum types (created by Prisma).

task_status_pg_enum = PGEnum(
    TaskStatus,
    name="TaskStatus",
    create_type=False,
)

habit_frequency_pg_enum = PGEnum(
    HabitFrequency,
    name="HabitFrequency",
    create_type=False,
)
