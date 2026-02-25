from rest_framework import serializers

from .models import CartItem, Category, Order, OrderItem, Product, Review, WishlistItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    discounted_price = serializers.FloatField(read_only=True)
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'category',
            'price',
            'discounted_price',
            'stock',
            'image_url',
            'offer_percent',
            'is_active',
            'average_rating',
            'created_at',
        ]

    def get_average_rating(self, obj):
        ratings = [item.rating for item in obj.reviews.all()]
        if not ratings:
            return None
        return round(sum(ratings) / len(ratings), 2)


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['id', 'product', 'customer_name', 'rating', 'comment', 'created_at']
        read_only_fields = ['created_at']


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = CartItem
        fields = ['id', 'customer_id', 'product', 'product_id', 'quantity', 'updated_at']
        read_only_fields = ['updated_at']


class WishlistSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'customer_id', 'product', 'product_id', 'created_at']
        read_only_fields = ['created_at']


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'product_name', 'quantity', 'unit_price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id',
            'customer_name',
            'customer_email',
            'shipping_address',
            'status',
            'total_amount',
            'items',
            'created_at',
            'updated_at',
        ]
