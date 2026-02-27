from django.conf import settings
from django.db import models


class AnalyticsEvent(models.Model):
    class Source(models.TextChoices):
        FRONTEND = "frontend", "Frontend"
        BACKEND = "backend", "Backend"

    event_name = models.CharField(max_length=80, db_index=True)
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.FRONTEND,
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="analytics_events",
    )
    session_key = models.CharField(max_length=64, blank=True, default="", db_index=True)
    path = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_name", "created_at"]),
            models.Index(fields=["source", "created_at"]),
        ]
