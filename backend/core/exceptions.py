"""
core/exceptions.py

Custom exceptions and global exception handlers.

WHY CENTRALIZED EXCEPTION HANDLING:
In Express you'd have a final error-handling middleware:
    app.use((err, req, res, next) => { res.status(500).json({ error: err.message }) })

FastAPI has exception handlers registered on the app instance.
The benefit of centralized handling:
- Consistent error response shape across ALL routes
- Single place to add logging, Sentry reporting, etc.
- Services throw domain exceptions, not HTTP exceptions
  (business logic shouldn't know about HTTP status codes)

THE HIERARCHY:
AppException           ← base for all custom exceptions
├── NotFoundError      ← 404
├── ForbiddenError     ← 403  
├── ConflictError      ← 409 (e.g., duplicate email)
├── ValidationError    ← 422
└── UnauthorizedError  ← 401

Routes/services raise these domain exceptions.
The handlers below convert them to proper HTTP responses.
"""

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------
class AppException(Exception):
    """Base exception for all application-level errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str | None = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class NotFoundError(AppException):
    """Resource not found (404)."""

    def __init__(self, resource: str, identifier: str | None = None) -> None:
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} '{identifier}' not found"
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND, error_code="NOT_FOUND")


class ForbiddenError(AppException):
    """User lacks permission (403)."""

    def __init__(self, message: str = "You don't have permission to access this resource") -> None:
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN, error_code="FORBIDDEN")


class ConflictError(AppException):
    """Resource already exists or state conflict (409)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=status.HTTP_409_CONFLICT, error_code="CONFLICT")


class UnauthorizedError(AppException):
    """Authentication required (401)."""

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(
            message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="UNAUTHORIZED",
        )


class UnprocessableError(AppException):
    """Business logic validation failed (422)."""

    def __init__(self, message: str) -> None:
        super().__init__(
            message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code="UNPROCESSABLE",
        )


class ServiceUnavailableError(AppException):
    """Downstream service (LLM, DB) is unavailable (503)."""

    def __init__(self, service: str, message: str | None = None) -> None:
        msg = message or f"{service} is temporarily unavailable"
        super().__init__(msg, status_code=status.HTTP_503_SERVICE_UNAVAILABLE, error_code="SERVICE_UNAVAILABLE")


# ---------------------------------------------------------------------------
# Error response shape
# ---------------------------------------------------------------------------
def _error_response(
    status_code: int,
    message: str,
    error_code: str | None = None,
    details: list | None = None,
) -> JSONResponse:
    """
    Consistent error response envelope.
    
    All errors return the same shape:
    {
        "error": {
            "code": "NOT_FOUND",          ← machine-readable
            "message": "Goal not found",  ← human-readable
            "details": [...]              ← optional validation details
        }
    }
    
    WHY A CONSISTENT ENVELOPE:
    Your frontend can handle errors generically:
        if (response.error.code === "NOT_FOUND") { show404() }
    Without this, every endpoint has a different error shape and frontend
    code becomes a mess of conditional checks.
    """
    body: dict = {
        "error": {
            "code": error_code or "INTERNAL_ERROR",
            "message": message,
        }
    }
    if details:
        body["error"]["details"] = details

    return JSONResponse(status_code=status_code, content=body)


# ---------------------------------------------------------------------------
# Exception handlers — registered on the FastAPI app
# ---------------------------------------------------------------------------
def register_exception_handlers(app: FastAPI) -> None:
    """
    Register all exception handlers on the FastAPI application.
    Called once during app startup in main.py.
    """

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        """Handle all custom AppException subclasses."""
        return _error_response(
            status_code=exc.status_code,
            message=exc.message,
            error_code=exc.error_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """
        Handle Pydantic validation errors from request parsing.
        
        FastAPI raises RequestValidationError when request body/params
        don't match your Pydantic schemas. We reformat this into our
        consistent error envelope with field-level details.
        """
        details = [
            {
                "field": ".".join(str(loc) for loc in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Request validation failed",
            error_code="VALIDATION_ERROR",
            details=details,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """
        Catch-all for unexpected exceptions.
        
        PRODUCTION NOTE:
        In production, log the full traceback here and send to Sentry/Datadog.
        Never expose internal error details to clients in production.
        In development, re-raising gives you the full traceback in the console.
        """
        # TODO: Add Sentry/logging integration here
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")

        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="An unexpected error occurred. Please try again.",
            error_code="INTERNAL_ERROR",
        )
