from rest_framework import serializers


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
