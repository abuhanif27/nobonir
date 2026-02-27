from rest_framework import serializers

from .models import Coupon, CouponUsage, Order, OrderItem


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


class AdminOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "user_email",
            "user_name",
            "item_count",
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

    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username or obj.user.email

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.items.all())


class AdminCouponSerializer(serializers.ModelSerializer):
    usage_count = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "discount_percent",
            "expires_at",
            "is_active",
            "is_expired",
            "usage_count",
            "created_at",
        ]
        read_only_fields = ["id", "usage_count", "is_expired", "created_at"]

    def validate_code(self, value):
        return value.strip().upper()

    def validate_discount_percent(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError("Discount percent must be between 1 and 100")
        return value

    def get_usage_count(self, obj):
        return CouponUsage.objects.filter(coupon=obj).count()

    def get_is_expired(self, obj):
        return obj.is_expired
