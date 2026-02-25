from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "unit_price", "quantity"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "status", "total_amount", "shipping_address", "items", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "total_amount", "created_at", "updated_at"]


class CheckoutSerializer(serializers.Serializer):
    shipping_address = serializers.CharField()
