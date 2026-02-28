from rest_framework import serializers

from orders.models import Order, OrderItem
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "user",
            "user_name",
            "product",
            "rating",
            "comment",
            "is_approved",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "is_approved", "created_at", "updated_at"]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value

    def validate_product(self, product):
        if not product.is_active:
            raise serializers.ValidationError("You can review only active products.")

        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return product

        has_delivered_purchase = OrderItem.objects.filter(
            product=product,
            order__user=user,
            order__status=Order.Status.DELIVERED,
        ).exists()
        if not has_delivered_purchase:
            raise serializers.ValidationError(
                "You can review only products from your delivered orders."
            )

        if self.instance is None:
            already_reviewed = Review.objects.filter(user=user, product=product).exists()
            if already_reviewed:
                raise serializers.ValidationError("You have already reviewed this product.")

        return product

    def validate_comment(self, value):
        cleaned = (value or "").strip()
        if len(cleaned) > 2000:
            raise serializers.ValidationError("Comment cannot exceed 2000 characters.")
        return cleaned

    def validate(self, attrs):
        if self.instance is not None and "product" in attrs and attrs["product"].id != self.instance.product_id:
            raise serializers.ValidationError({"product": "Product cannot be changed after review creation."})
        return attrs

    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username or obj.user.email


class MyReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "product_name",
            "rating",
            "comment",
            "is_approved",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_approved", "created_at", "updated_at"]


class AdminReviewSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "user_email",
            "product_name",
            "product",
            "rating",
            "comment",
            "is_approved",
            "created_at",
            "updated_at",
        ]
