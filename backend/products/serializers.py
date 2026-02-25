from rest_framework import serializers

from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all(), write_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "category_id",
            "name",
            "slug",
            "description",
            "price",
            "stock",
            "is_active",
            "image_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value
