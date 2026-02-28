from rest_framework import serializers

from products.serializers import ProductSerializer
from .models import CartItem, WishlistItem


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=99)

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_id", "quantity", "updated_at"]
        read_only_fields = ["id", "updated_at"]


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, min_value=1)

    class Meta:
        model = WishlistItem
        fields = ["id", "product", "product_id", "created_at"]
        read_only_fields = ["id", "created_at"]


class CartItemQuantitySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0, max_value=99)
