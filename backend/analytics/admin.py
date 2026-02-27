from django.contrib import admin

from .models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_name", "source", "user", "session_key", "created_at")
    list_filter = ("event_name", "source", "created_at")
    search_fields = ("event_name", "session_key", "path", "user__email")
    ordering = ("-created_at",)
