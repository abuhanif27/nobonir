"""
Email service for sending password reset emails and other notifications.
Supports SMTP, SendGrid, and console backends with template rendering.
"""

import logging
from typing import Optional, Dict, Any
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails with template rendering and error handling."""

    DEFAULT_FROM_EMAIL = settings.DEFAULT_FROM_EMAIL
    TEMPLATE_DIR = "emails"

    @classmethod
    def send_password_reset_email(
        cls,
        user,
        reset_token: str,
        expiry_hours: int = 24,
    ) -> bool:
        """
        Send password reset email to user.

        Args:
            user: User instance
            reset_token: Reset token string
            expiry_hours: Number of hours until token expires

        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # Build reset URL
            frontend_url = settings.FRONTEND_BASE_URL.rstrip("/")
            reset_url = f"{frontend_url}/reset-password?token={reset_token}"

            # Prepare context for template
            context = {
                "user": user,
                "reset_url": reset_url,
                "expiry_hours": expiry_hours,
                "app_name": "Nobonir",
                "support_email": cls.DEFAULT_FROM_EMAIL,
            }

            # Render email templates
            html_content = render_to_string(
                f"{cls.TEMPLATE_DIR}/password_reset.html",
                context
            )
            text_content = render_to_string(
                f"{cls.TEMPLATE_DIR}/password_reset.txt",
                context
            )

            # Create email
            subject = "Reset Your Nobonir Password"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=cls.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, "text/html")

            # Send email
            email.send(fail_silently=False)

            logger.info(
                f"Password reset email sent successfully to {user.email}",
                extra={
                    "event": "password_reset_email_sent",
                    "user_id": user.id,
                    "user_email": user.email,
                }
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to send password reset email to {user.email}: {str(e)}",
                extra={
                    "event": "password_reset_email_failed",
                    "user_id": user.id,
                    "user_email": user.email,
                    "error": str(e),
                },
                exc_info=True
            )
            return False

    @classmethod
    def send_password_changed_confirmation(cls, user) -> bool:
        """
        Send password change confirmation email.

        Args:
            user: User instance

        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            context = {
                "user": user,
                "app_name": "Nobonir",
                "login_url": f"{settings.FRONTEND_BASE_URL.rstrip('/')}/login",
                "support_email": cls.DEFAULT_FROM_EMAIL,
                "support_email": cls.DEFAULT_FROM_EMAIL,
            }

            html_content = render_to_string(
                f"{cls.TEMPLATE_DIR}/password_changed.html",
                context
            )
            text_content = render_to_string(
                f"{cls.TEMPLATE_DIR}/password_changed.txt",
                context
            )

            subject = "Your Password Has Been Changed"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=cls.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)

            logger.info(
                f"Password changed confirmation email sent to {user.email}",
                extra={
                    "event": "password_changed_email_sent",
                    "user_id": user.id,
                }
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to send password changed email to {user.email}: {str(e)}",
                extra={
                    "event": "password_changed_email_failed",
                    "user_id": user.id,
                },
                exc_info=True
            )
            return False

    @classmethod
    def send_welcome_email(cls, user, verification_token: Optional[str] = None) -> bool:
        """
        Send welcome email to new user.

        Args:
            user: User instance
            verification_token: Optional email verification token

        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            context = {
                "user": user,
                "support_email": cls.DEFAULT_FROM_EMAIL,
                "app_name": "Nobonir",
                "support_email": cls.DEFAULT_FROM_EMAIL,
            }

            if verification_token:
                frontend_url = settings.FRONTEND_BASE_URL.rstrip("/")
                context["verification_url"] = f"{frontend_url}/verify-email?token={verification_token}"

            html_content = render_to_string(
                f"{cls.TEMPLATE_DIR}/welcome.html",
                context
            )
            text_content = render_to_string(
                f"{cls.TEMPLATE_DIR}/welcome.txt",
                context
            )

            subject = f"Welcome to {context['app_name']}!"
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=cls.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)

            logger.info(
                f"Welcome email sent to {user.email}",
                extra={
                    "event": "welcome_email_sent",
                    "user_id": user.id,
                }
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to send welcome email to {user.email}: {str(e)}",
                extra={
                    "event": "welcome_email_failed",
                    "user_id": user.id,
                },
                exc_info=True
            )
            return False
