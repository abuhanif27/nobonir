import os
import json
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-in-production")
DEBUG = os.getenv("DEBUG", "False").strip().lower() in ("true", "1", "yes")
ALLOWED_HOSTS = [host.strip() for host in os.getenv("ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "django_filters",
    "accounts",
    "products",
    "cart",
    "orders",
    "payments",
    "reviews",
    "ai_engine",
    "analytics",
    "shop",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174").split(",")
    if origin.strip()
]

# Redis Cache
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://localhost:6379/1"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPageNumberPagination",
    "PAGE_SIZE": 12,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "review_create": "10/hour",
        "review_update": "30/hour",
        "cart_write": "120/hour",
        "order_checkout": "15/hour",
        "order_coupon_validate": "60/hour",
        "order_invoice_download": "30/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Nobonir E-Commerce API",
    "DESCRIPTION": "AI powered modular e-commerce backend",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

INVOICE_BASE_CURRENCY = os.getenv("INVOICE_BASE_CURRENCY", "USD").strip().upper()

DEFAULT_INVOICE_USD_TO_RATES = {
    "USD": "1",
    "BDT": "121.00",
    "INR": "83.00",
    "PKR": "279.00",
    "NPR": "132.80",
    "LKR": "304.00",
    "CAD": "1.35",
    "GBP": "0.79",
    "AUD": "1.53",
    "NZD": "1.64",
    "SGD": "1.34",
    "MYR": "4.70",
    "AED": "3.67",
    "SAR": "3.75",
    "QAR": "3.64",
    "KWD": "0.31",
    "EUR": "0.92",
    "SEK": "10.40",
    "NOK": "10.70",
    "DKK": "6.87",
    "CHF": "0.88",
    "JPY": "150.00",
    "KRW": "1330.00",
    "CNY": "7.20",
    "HKD": "7.80",
    "THB": "35.50",
    "VND": "24500.00",
    "BRL": "5.00",
    "MXN": "17.00",
    "ZAR": "18.60",
}

INVOICE_USD_TO_RATES = DEFAULT_INVOICE_USD_TO_RATES.copy()


def _as_bool(value: str, default: bool = False) -> bool:
    normalized = str(value).strip().lower()
    if not normalized:
        return default
    return normalized in {"1", "true", "yes", "on"}


AI_FREE_LLM_ENABLED = _as_bool(os.getenv("AI_FREE_LLM_ENABLED", "1"), default=True)
AI_FREE_LLM_PROVIDER = os.getenv("AI_FREE_LLM_PROVIDER", "pollinations").strip().lower() or "pollinations"
AI_FREE_LLM_PROVIDERS = [
    item.strip().lower()
    for item in os.getenv("AI_FREE_LLM_PROVIDERS", "pollinations,huggingface").split(",")
    if item.strip()
]
AI_FREE_LLM_TIMEOUT_SECONDS = float(os.getenv("AI_FREE_LLM_TIMEOUT_SECONDS", "8"))
AI_FREE_LLM_POLLINATIONS_URL = os.getenv("AI_FREE_LLM_POLLINATIONS_URL", "https://text.pollinations.ai").strip()
AI_FREE_LLM_HUGGINGFACE_URL = os.getenv(
    "AI_FREE_LLM_HUGGINGFACE_URL",
    "https://api-inference.huggingface.co/models/google/flan-t5-large",
).strip()
AI_FREE_LLM_HUGGINGFACE_TOKEN = os.getenv("AI_FREE_LLM_HUGGINGFACE_TOKEN", "").strip()

invoice_rates_json = os.getenv("INVOICE_USD_TO_RATES_JSON", "").strip()
if invoice_rates_json:
    try:
        loaded = json.loads(invoice_rates_json)
        if isinstance(loaded, dict):
            for code, value in loaded.items():
                code_normalized = str(code).strip().upper()
                value_normalized = str(value).strip()
                if code_normalized and value_normalized:
                    INVOICE_USD_TO_RATES[code_normalized] = value_normalized
    except json.JSONDecodeError:
        pass

invoice_rates_csv = os.getenv("INVOICE_USD_TO_RATES", "").strip()
if invoice_rates_csv:
    for part in invoice_rates_csv.split(","):
        chunk = part.strip()
        if not chunk or ":" not in chunk:
            continue
        code, value = chunk.split(":", 1)
        code_normalized = code.strip().upper()
        value_normalized = value.strip()
        if code_normalized and value_normalized:
            INVOICE_USD_TO_RATES[code_normalized] = value_normalized
