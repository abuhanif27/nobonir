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
        fields = [
            "id",
            "status",
            "subtotal_amount",
            "discount_amount",
            "coupon_code",
            "total_amount",
            "shipping_address",
            "billing_address",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "subtotal_amount",
            "discount_amount",
            "coupon_code",
            "total_amount",
            "created_at",
            "updated_at",
        ]


class CheckoutSerializer(serializers.Serializer):
    shipping_address = serializers.CharField()
    billing_address = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(choices=["CARD", "COD"], default="CARD")
    coupon_code = serializers.CharField(required=False, allow_blank=True, max_length=40)


class CouponValidateSerializer(serializers.Serializer):
    coupon_code = serializers.CharField(max_length=40)
