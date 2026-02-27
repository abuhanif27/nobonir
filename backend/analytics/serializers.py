from rest_framework import serializers

from .models import AnalyticsEvent


class AnalyticsEventIngestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsEvent
        fields = ["event_name", "source", "path", "metadata"]

    def validate_event_name(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("event_name is required.")
        return normalized


class AnalyticsEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsEvent
        fields = [
            "id",
            "event_name",
            "source",
            "user",
            "session_key",
            "path",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
