from django.db import models
from django.conf import settings

from products.models import Product


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
	total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
