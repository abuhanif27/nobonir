from .base import *  # noqa: F401,F403

DEBUG = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "nobonir"),
        "USER": os.getenv("POSTGRES_USER", "nobonir"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "nobonir"),
        "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}
