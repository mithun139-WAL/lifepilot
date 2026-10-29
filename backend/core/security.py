"""
core/security.py

JWT creation/verification and password hashing.

WHY THIS IS IN core/ AND NOT IN features/auth/:
Security utilities are cross-cutting concerns.
- JWT verification is needed in core/dependencies.py (the auth middleware)
- Password hashing has no feature-specific context
- Keeping them here prevents circular imports (auth/ would import from core/,
  and if dependencies.py imported from auth/, you'd have a cycle)

THE JWT MENTAL MODEL:
JWT = a signed, base64-encoded JSON payload.
Structure: header.payload.signature

When a user logs in:
1. Server creates a payload: {"sub": "user_id_123", "exp": timestamp}
2. Signs it with JWT_SECRET_KEY using HS256
3. Returns the token string to the client

On each subsequent request:
1. Client sends: Authorization: Bearer <token>
2. Server verifies the signature (proves it wasn't tampered with)
3. Checks expiry
4. Extracts user_id from "sub" field
5. Loads the user from DB

The token is NOT encrypted — the payload is readable by anyone.
Never put sensitive data (passwords, PII) in a JWT payload.

REFRESH TOKEN PATTERN:
Access tokens are short-lived (24h here). Refresh tokens are long-lived (30 days).
When access token expires, the client uses the refresh token to get a new one
without asking the user to log in again. Your Next.js frontend already implements
this pattern — we're replicating the same behavior.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from core.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
# Using bcrypt directly instead of passlib.
#
# WHY NOT passlib:
# passlib 1.7.4 is effectively unmaintained. bcrypt 4.x changed behavior —
# it now raises ValueError for passwords > 72 bytes instead of silently
# truncating. passlib's internal wrap-bug detection feeds a >72 byte string
# to bcrypt, which crashes on 4.x. The fix is to drop the passlib layer.
#
# The hash format ($2b$12$...) is IDENTICAL — existing bcryptjs hashes in
# the DB continue to verify correctly with no migration needed.
#
# COST FACTOR (12 rounds):
# 12 is the current industry standard. Each increment doubles the work.
# At 12 rounds: ~250ms to hash — slow enough to frustrate brute-force,
# fast enough to not degrade login UX.

_BCRYPT_ROUNDS = 12


def hash_password(plain_password: str) -> str:
    """
    Hash a plaintext password using bcrypt.

    Returns a full bcrypt hash string including the salt, e.g.:
    "$2b$12$..." — compatible with existing bcryptjs hashes in the DB.
    """
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hash.

    bcrypt.checkpw uses constant-time comparison — immune to timing attacks.
    Returns False (not raises) if the hash is malformed.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------
def create_access_token(
    subject: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Create a short-lived access token.
    
    Args:
        subject: The user's ID (stored in "sub" claim — standard JWT practice)
        extra_claims: Optional additional claims (e.g., onboarding_complete)
    
    Returns:
        Signed JWT string
    
    PRODUCTION NOTE:
    The "sub" claim holds the user's ID — NOT their email.
    Email can change; ID is immutable. Always use the immutable identifier.
    """
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": subject,           # Subject = user ID
        "iat": now,               # Issued at
        "exp": expire,            # Expiry
        "type": "access",         # Token type — we check this on verification
    }

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.jwt_secret_str,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(subject: str) -> str:
    """
    Create a long-lived refresh token.
    
    Refresh tokens should be:
    - Stored server-side (Redis/DB) for revocation capability
    - Sent via httpOnly cookie (not accessible to JS)
    - Rotated on each use (prevents replay attacks)
    
    We'll implement server-side storage in a later phase.
    For now, this establishes the pattern.
    """
    now = datetime.now(UTC)
    expire = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "refresh",
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_str,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT token.
    
    Raises:
        JWTError: If the token is invalid, expired, or has wrong signature.
        The caller (dependencies.py) catches this and raises HTTP 401.
    
    WHY WE EXPLICITLY CHECK "type":
    Without checking the token type, a refresh token could be used as an
    access token (token confusion attack). Always verify the intended use.
    """
    payload = jwt.decode(
        token,
        settings.jwt_secret_str,
        algorithms=[settings.JWT_ALGORITHM],
    )
    return payload


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access token specifically."""
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise JWTError("Token is not an access token")

    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decode and validate a refresh token specifically."""
    payload = decode_token(token)

    if payload.get("type") != "refresh":
        raise JWTError("Token is not a refresh token")

    return payload


def get_user_id_from_token(token: str) -> str:
    """
    Extract the user ID from a verified access token.
    
    Returns the "sub" (subject) claim, which holds the user's ID.
    Raises JWTError if the token is invalid or "sub" is missing.
    """
    payload = decode_access_token(token)
    user_id: str | None = payload.get("sub")

    if user_id is None:
        raise JWTError("Token missing subject claim")

    return user_id
