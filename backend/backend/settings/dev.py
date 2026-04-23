from .base import *  # noqa: F401,F403

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Development email backend: use real SMTP (Gmail or Mailtrap)
# Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env file
# If no credentials provided, fall back to console output for debugging
if os.getenv("EMAIL_HOST_USER") and os.getenv("EMAIL_HOST_PASSWORD"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    # Console backend prints emails to Django server console for debugging
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
