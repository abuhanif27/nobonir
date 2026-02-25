from django.contrib import admin
from .models import CartItem, Category, Order, OrderItem, Product, Review, WishlistItem


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
	list_display = ('name', 'slug')
	search_fields = ('name',)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
	list_display = ('name', 'category', 'price', 'stock', 'offer_percent', 'is_active')
	list_filter = ('category', 'is_active')
	search_fields = ('name', 'description')


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
	list_display = ('product', 'customer_name', 'rating', 'created_at')
	list_filter = ('rating',)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
	list_display = ('customer_id', 'product', 'quantity', 'updated_at')
	search_fields = ('customer_id',)


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
	list_display = ('customer_id', 'product', 'created_at')
	search_fields = ('customer_id',)


class OrderItemInline(admin.TabularInline):
	model = OrderItem
	extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = ('id', 'customer_name', 'customer_email', 'status', 'total_amount', 'created_at')
	list_filter = ('status',)
	search_fields = ('customer_name', 'customer_email')
	inlines = [OrderItemInline]
