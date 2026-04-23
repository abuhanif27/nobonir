"""Development-only API endpoints for email inspection."""

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from common.email_utils import get_latest_email, get_all_emails, extract_reset_link_from_email


class LatestEmailAPIView(APIView):
    """
    Development-only endpoint to retrieve the latest sent email.
    ONLY available in DEBUG mode.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.DEBUG:
            return Response(
                {"error": "This endpoint is only available in development mode."},
                status=status.HTTP_403_FORBIDDEN
            )

        email_content = get_latest_email()
        if not email_content:
            return Response(
                {"error": "No emails found. Send a password reset request first."},
                status=status.HTTP_404_NOT_FOUND
            )

        reset_link = extract_reset_link_from_email(email_content)
        
        return Response({
            "content": email_content,
            "reset_link": reset_link,
            "message": "Password reset link extracted above. Copy the reset_link and visit it in your browser.",
        })


class AllEmailsAPIView(APIView):
    """
    Development-only endpoint to retrieve all sent emails.
    ONLY available in DEBUG mode.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.DEBUG:
            return Response(
                {"error": "This endpoint is only available in development mode."},
                status=status.HTTP_403_FORBIDDEN
            )

        emails = get_all_emails()
        return Response({
            "count": len(emails),
            "emails": emails,
            "message": "These are all emails sent during development. Check the reset_link in the latest email.",
        })
