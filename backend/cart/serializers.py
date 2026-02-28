from rest_framework import serializers

from products.serializers import ProductSerializer
from .models import CartItem, WishlistItem


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, min_value=1)
    variant_id = serializers.IntegerField(write_only=True, required=False, allow_null=True, min_value=1)
    variant = serializers.SerializerMethodField(read_only=True)
    quantity = serializers.IntegerField(min_value=1, max_value=99)

    class Meta:
        model = CartItem
        fields = [
            "id",
            "product",
            "product_id",
            "variant",
            "variant_id",
            "quantity",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def get_variant(self, obj: CartItem):
        if not obj.variant_id:
            return None

        variant = obj.variant
        return {
            "id": variant.id,
            "color": variant.color,
            "size": variant.size,
            "sku": variant.sku,
            "stock_override": variant.stock_override,
        }


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, min_value=1)

    class Meta:
        model = WishlistItem
        fields = ["id", "product", "product_id", "created_at"]
        read_only_fields = ["id", "created_at"]


class CartItemQuantitySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0, max_value=99)
