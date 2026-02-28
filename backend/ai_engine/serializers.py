from rest_framework import serializers

from products.models import Category
from .models import UserPreference


class QuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True)
    query = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        value = (attrs.get("q") or attrs.get("query") or "").strip()
        if not value:
            raise serializers.ValidationError({"q": "This field is required."})
        attrs["q"] = value
        return attrs


class SentimentSerializer(serializers.Serializer):
    text = serializers.CharField()


class AssistantChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
    session_key = serializers.CharField(max_length=80, required=False, allow_blank=True)


class AssistantChatProductSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    image = serializers.CharField(allow_blank=True)
    category = serializers.CharField()
    availability_status = serializers.CharField()
    available_stock = serializers.IntegerField(min_value=0)


class AssistantChatResponseSerializer(serializers.Serializer):
    reply = serializers.CharField()
    intent = serializers.CharField()
    session_key = serializers.CharField()
    suggested_products = AssistantChatProductSerializer(many=True)


class AssistantHistoryQuerySerializer(serializers.Serializer):
    session_key = serializers.CharField(max_length=80, required=False, allow_blank=True)


class AssistantHistoryMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    text = serializers.CharField()
    intent = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()


class AssistantHistoryResponseSerializer(serializers.Serializer):
    session_key = serializers.CharField()
    messages = AssistantHistoryMessageSerializer(many=True)


class AssistantHistoryClearResponseSerializer(serializers.Serializer):
    session_key = serializers.CharField()


class AssistantNotificationInsightSerializer(serializers.Serializer):
    term = serializers.CharField()
    message = serializers.CharField()
    tone = serializers.ChoiceField(choices=["info", "warning", "success"])
    sectionKey = serializers.CharField()


class UserPreferenceSerializer(serializers.ModelSerializer):
    preferred_categories = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Category.objects.all(),
        required=False,
    )

    class Meta:
        model = UserPreference
        fields = [
            "age",
            "location",
            "continent",
            "preferred_categories",
            "trained_category_weights",
            "inferred_segment",
            "inferred_segment_confidence",
            "last_trained_at",
        ]
        read_only_fields = [
            "trained_category_weights",
            "inferred_segment",
            "inferred_segment_confidence",
            "last_trained_at",
        ]

    def update(self, instance, validated_data):
        categories = validated_data.pop("preferred_categories", None)
        instance = super().update(instance, validated_data)
        if categories is not None:
            instance.preferred_categories.set(categories)
        return instance
