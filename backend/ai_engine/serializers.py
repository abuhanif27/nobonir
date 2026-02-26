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
