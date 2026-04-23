#!/usr/bin/env python
"""
Test script to verify Gmail SMTP email configuration
Run from backend directory: python test_email_config.py
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, str(Path(__file__).parent))

django.setup()

from django.conf import settings
from django.core.mail import send_mail

print("=" * 60)
print("EMAIL CONFIGURATION TEST")
print("=" * 60)

print("\n1. EMAIL SETTINGS:")
print(f"   EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
print(f"   EMAIL_HOST: {settings.EMAIL_HOST}")
print(f"   EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
print(f"   EMAIL_PORT: {settings.EMAIL_PORT}")
print(f"   EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
print(f"   DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")

print("\n2. CHECKING CREDENTIALS:")
if settings.EMAIL_HOST_USER:
    print(f"   ✓ EMAIL_HOST_USER is set: {settings.EMAIL_HOST_USER}")
else:
    print("   ✗ EMAIL_HOST_USER is NOT set!")

if settings.EMAIL_HOST_PASSWORD:
    print(f"   ✓ EMAIL_HOST_PASSWORD is set (length: {len(settings.EMAIL_HOST_PASSWORD)})")
else:
    print("   ✗ EMAIL_HOST_PASSWORD is NOT set!")

print("\n3. TESTING EMAIL SENDING:")
try:
    result = send_mail(
        subject='🧪 Nobonir Email Test',
        message='This is a test email from Django to verify Gmail SMTP is working correctly.\n\nIf you received this, your email configuration is working!',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=['aliensarmy2500@gmail.com'],
        fail_silently=False,
    )
    print(f"   ✓ Email sent successfully! (Result: {result})")
    print(f"   Check your Gmail inbox for the test email.")
except Exception as e:
    print(f"   ✗ Error sending email:")
    print(f"   Error Type: {type(e).__name__}")
    print(f"   Error Message: {str(e)}")
    print(f"\n   TROUBLESHOOTING:")
    print(f"   - Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env")
    print(f"   - Make sure the app password doesn't have spaces")
    print(f"   - Check Gmail 2FA is enabled")
    print(f"   - Try https://myaccount.google.com/apppasswords again")

print("\n" + "=" * 60)
