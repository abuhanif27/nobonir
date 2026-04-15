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
    llm_provider = serializers.CharField()
    llm_enhanced = serializers.BooleanField()
    llm_attempts = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    suggested_products = AssistantChatProductSerializer(many=True)


class AssistantHistoryQuerySerializer(serializers.Serializer):
    session_key = serializers.CharField(max_length=80, required=False, allow_blank=True)
    before_id = serializers.IntegerField(required=False, min_value=1)
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100, default=30)


class AssistantHistoryMessageSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    role = serializers.ChoiceField(choices=["user", "assistant"])
    text = serializers.CharField()
    intent = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()


class AssistantHistoryResponseSerializer(serializers.Serializer):
    session_key = serializers.CharField()
    messages = AssistantHistoryMessageSerializer(many=True)
    has_more = serializers.BooleanField()
    next_before_id = serializers.IntegerField(required=False, allow_null=True)


class AssistantHistoryClearResponseSerializer(serializers.Serializer):
    session_key = serializers.CharField()


class AssistantRuntimeStatusSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    providers = serializers.ListField(child=serializers.CharField())
    timeout_seconds = serializers.FloatField()
    huggingface_token_configured = serializers.BooleanField()
    test_mode = serializers.BooleanField()


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
