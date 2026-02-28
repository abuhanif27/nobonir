from django.contrib import admin
from .models import (
	Category,
	InventoryMovement,
	Product,
	ProductMedia,
	ProductVariant,
	StockNotificationSubscription,
	StockReservation,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
	list_display = ("name", "slug")
	search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
	list_display = ("name", "category", "price", "stock", "is_active")
	list_filter = ("category", "is_active")
	search_fields = ("name", "description")


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
	list_display = ("product", "color", "size", "sku", "stock_override", "is_active")
	list_filter = ("is_active", "color", "size")
	search_fields = ("product__name", "sku", "color", "size")


@admin.register(ProductMedia)
class ProductMediaAdmin(admin.ModelAdmin):
	list_display = ("product", "variant", "sort_order", "is_primary", "created_at")
	list_filter = ("is_primary",)
	search_fields = ("product__name", "alt_text")


@admin.register(StockNotificationSubscription)
class StockNotificationSubscriptionAdmin(admin.ModelAdmin):
	list_display = ("product", "channel", "contact_value", "is_active", "notified_at")
	list_filter = ("channel", "is_active")
	search_fields = ("product__name", "contact_value")


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
	list_display = (
		"product",
		"movement_type",
		"quantity_delta",
		"quantity_before",
		"quantity_after",
		"created_at",
	)
	list_filter = ("movement_type",)
	search_fields = ("product__name", "reference_type", "reference_id")


@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
	list_display = ("product", "cart", "quantity", "status", "expires_at")
	list_filter = ("status",)
	search_fields = ("product__name",)
