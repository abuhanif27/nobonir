import os
from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "analytics"
    path = os.path.dirname(os.path.abspath(__file__))
