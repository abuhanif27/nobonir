import os
import sys
import django
import signal
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, str(Path(__file__).parent))

django.setup()

from django.conf import settings

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
    pwd_len = len(settings.EMAIL_HOST_PASSWORD)
    print(f"   ✓ EMAIL_HOST_PASSWORD is set (length: {pwd_len} chars)")
else:
    print("   ✗ EMAIL_HOST_PASSWORD is NOT set!")

print("\n3. TESTING EMAIL SENDING WITH TIMEOUT:")
def timeout_handler(signum, frame):
    raise TimeoutError("Email sending timed out after 10 seconds - SMTP server not responding")

signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(10)

try:
    from django.core.mail import send_mail
    result = send_mail(
        subject='Test Email from Nobonir',
        message='This is a test email.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=['aliensarmy2500@gmail.com'],
        fail_silently=False,
    )
    signal.alarm(0)
    print(f"   ✓ Email sent successfully! (Result: {result})")
except TimeoutError as e:
    signal.alarm(0)
    print(f"   ✗ {str(e)}")
except Exception as e:
    signal.alarm(0)
    print(f"   ✗ Error sending email:")
    print(f"   Error Type: {type(e).__name__}")
    print(f"   Error Message: {str(e)}")

print("\n" + "=" * 60)
