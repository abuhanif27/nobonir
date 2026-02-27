from django.db import models
from django.conf import settings
from django.utils import timezone

from products.models import Product


class Coupon(models.Model):
	code = models.CharField(max_length=40, unique=True, db_index=True)
	discount_percent = models.PositiveSmallIntegerField(default=10)
	expires_at = models.DateTimeField()
	is_active = models.BooleanField(default=True, db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return self.code

	@property
	def is_expired(self) -> bool:
		return timezone.now() > self.expires_at


class Order(models.Model):
	class Status(models.TextChoices):
		PENDING = "PENDING", "Pending"
		PAID = "PAID", "Paid"
		PROCESSING = "PROCESSING", "Processing"
		SHIPPED = "SHIPPED", "Shipped"
		DELIVERED = "DELIVERED", "Delivered"
		CANCELLED = "CANCELLED", "Cancelled"

	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders")
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
	subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
	coupon_code = models.CharField(max_length=40, blank=True, default="")
	shipping_address = models.TextField()
	billing_address = models.TextField(blank=True, default="")
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]


class OrderItem(models.Model):
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
	product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
	product_name = models.CharField(max_length=180)
	unit_price = models.DecimalField(max_digits=10, decimal_places=2)
	quantity = models.PositiveIntegerField(default=1)

	class Meta:
		indexes = [models.Index(fields=["order", "product"])]


class CouponUsage(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="coupon_usages")
	coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="usages")
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="coupon_usages")
	used_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["user", "coupon"], name="unique_user_coupon_usage"),
		]
