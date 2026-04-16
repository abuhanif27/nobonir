"""
Services package for accounts app.

Contains business logic for email sending, user notifications, etc.
"""

from .email_service import EmailService

__all__ = ['EmailService']
