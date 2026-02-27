from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "order", "amount", "method", "status", "transaction_id", "created_at"]
        read_only_fields = ["id", "amount", "status", "transaction_id", "created_at"]


class PaymentSimulationSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    method = serializers.CharField(default="SIMULATED")
    success = serializers.BooleanField(default=True)


class StripeCheckoutSessionSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
