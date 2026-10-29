"""
integrations/email.py

Resend email integration.

WHY IN integrations/ AND NOT IN features/auth/:
Email sending is a cross-cutting integration — multiple features will send emails:
- Auth: verification, welcome, password reset
- Future: habit reminders, weekly reports, AI-generated insights

Keeping it in integrations/ means:
- One place to swap email providers (Resend → SendGrid → SES)
- One place to add rate limiting, templates, logging
- No duplication across features

PRODUCTION PATTERN:
For high-volume email, replace direct Resend calls with a queue:
  route → service → email_queue.publish(EmailJob)
  background_worker → consumes jobs → calls Resend

This prevents email sending from blocking the HTTP request cycle.
For now, direct calls are fine for the scale you're at.
"""

import logging
from typing import Any

import resend

from core.config import settings

logger = logging.getLogger(__name__)

# Initialize Resend client once at module level
resend.api_key = settings.RESEND_API_KEY.get_secret_value() if settings.RESEND_API_KEY.get_secret_value() else ""


async def send_verification_email(
    *,
    to_email: str,
    user_name: str,
    token: str,
) -> None:
    """
    Send email verification link.
    
    Replicates the behavior of your existing lib/email.ts sendVerificationEmail().
    The verification URL format matches what your frontend expects to receive.
    """
    # For the FastAPI backend, verification is a POST request with the token
    # rather than a GET with query params, but we keep the same flow for now
    verification_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify your LifePilot account</h2>
        <p>Hi {user_name or "there"},</p>
        <p>Click the button below to verify your email address:</p>
        <a href="{verification_url}" 
           style="display: inline-block; padding: 12px 24px; background-color: #6366f1; 
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Verify Email
        </a>
        <p>Or copy this link: <a href="{verification_url}">{verification_url}</a></p>
        <p>This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.</p>
        <p>If you didn't create a LifePilot account, you can safely ignore this email.</p>
    </div>
    """

    await _send_email(
        to=to_email,
        subject="Verify your LifePilot account",
        html=html_content,
    )


async def send_welcome_email(*, to_email: str, user_name: str) -> None:
    """Send welcome email after successful verification."""
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to LifePilot! 🎉</h2>
        <p>Hi {user_name or "there"},</p>
        <p>Your email has been verified. Your AI-powered personal coach is ready.</p>
        <a href="{settings.FRONTEND_URL}/onboarding"
           style="display: inline-block; padding: 12px 24px; background-color: #6366f1;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Get Started
        </a>
    </div>
    """

    await _send_email(
        to=to_email,
        subject="Welcome to LifePilot",
        html=html_content,
    )


async def send_password_reset_email(
    *, to_email: str, user_name: str, token: str
) -> None:
    """Send password reset link."""
    reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your LifePilot password</h2>
        <p>Hi {user_name or "there"},</p>
        <p>Click the button below to reset your password:</p>
        <a href="{reset_url}"
           style="display: inline-block; padding: 12px 24px; background-color: #6366f1;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
    </div>
    """

    await _send_email(
        to=to_email,
        subject="Reset your LifePilot password",
        html=html_content,
    )


async def _send_email(*, to: str, subject: str, html: str) -> None:
    """
    Internal helper to send an email via Resend.
    
    Resend's Python SDK is synchronous. We wrap it here so callers
    can use await — in a future phase we'd move this to a background task.
    """
    if not settings.RESEND_API_KEY.get_secret_value():
        logger.warning(f"RESEND_API_KEY not set — email to {to} not sent (skipping)")
        return

    try:
        params: dict[str, Any] = {
            "from": f"LifePilot <{settings.EMAIL_FROM}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        # Resend SDK is sync — run in thread pool to avoid blocking event loop
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: resend.Emails.send(params))
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.exception(f"Failed to send email to {to}: {e}")
        raise
