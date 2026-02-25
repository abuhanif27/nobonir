from rest_framework import serializers


class QuerySerializer(serializers.Serializer):
    q = serializers.CharField()


class SentimentSerializer(serializers.Serializer):
    text = serializers.CharField()
