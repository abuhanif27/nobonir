from django.db import models
from django.conf import settings


class Category(models.Model):
	name = models.CharField(max_length=120, unique=True)
	slug = models.SlugField(max_length=140, unique=True, db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["name"]

	def __str__(self):
		return self.name


class Product(models.Model):
	category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="products")
	name = models.CharField(max_length=180, db_index=True)
	slug = models.SlugField(max_length=200, unique=True)
	description = models.TextField(blank=True)
	price = models.DecimalField(max_digits=10, decimal_places=2)
	stock = models.PositiveIntegerField(default=0)
	last_restocked_at = models.DateTimeField(null=True, blank=True, db_index=True)
	last_out_of_stock_at = models.DateTimeField(null=True, blank=True, db_index=True)
	last_stock_movement_at = models.DateTimeField(null=True, blank=True, db_index=True)
	is_active = models.BooleanField(default=True, db_index=True)
	image_url = models.URLField(blank=True)
	embedding = models.JSONField(null=True, blank=True, help_text="AI vector embedding for similarity search")
	created_at = models.DateTimeField(auto_now_add=True, db_index=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["category", "is_active"]),
			models.Index(fields=["price"]),
		]

	def __str__(self):
		return self.name


class ProductVariant(models.Model):
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
	color = models.CharField(max_length=60, blank=True)
	size = models.CharField(max_length=30, blank=True)
	sku = models.CharField(max_length=64, blank=True, default="")
	stock_override = models.PositiveIntegerField(null=True, blank=True)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["product_id", "color", "size", "id"]
		constraints = [
			models.UniqueConstraint(
				fields=["product", "color", "size"],
				name="unique_product_variant_color_size",
			),
		]

	def __str__(self):
		label_parts = [part for part in [self.color, self.size] if part]
		label = " / ".join(label_parts) if label_parts else "Default"
		return f"{self.product.name} - {label}"


class ProductMedia(models.Model):
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="media")
	variant = models.ForeignKey(
		ProductVariant,
		on_delete=models.CASCADE,
		related_name="media",
		null=True,
		blank=True,
	)
	image_file = models.ImageField(upload_to="products/media/", null=True, blank=True)
	image_url = models.URLField(blank=True)
	alt_text = models.CharField(max_length=180, blank=True)
	sort_order = models.PositiveIntegerField(default=0)
	is_primary = models.BooleanField(default=False)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["sort_order", "id"]
		indexes = [
			models.Index(fields=["product", "sort_order"]),
			models.Index(fields=["variant", "sort_order"]),
		]

	def __str__(self):
		if self.variant_id:
			return f"{self.product.name} variant media #{self.id}"
		return f"{self.product.name} media #{self.id}"


class StockNotificationSubscription(models.Model):
	class Channel(models.TextChoices):
		EMAIL = "EMAIL", "Email"
		WHATSAPP = "WHATSAPP", "WhatsApp"

	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_notifications")
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="stock_notifications",
	)
	channel = models.CharField(max_length=20, choices=Channel.choices)
	contact_value = models.CharField(max_length=180)
	is_active = models.BooleanField(default=True, db_index=True)
	notified_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		constraints = [
			models.UniqueConstraint(
				fields=["product", "channel", "contact_value"],
				condition=models.Q(is_active=True),
				name="unique_active_stock_notification",
			),
		]

	def __str__(self):
		return f"{self.product.name} {self.channel} {self.contact_value}"


class InventoryMovement(models.Model):
	class MovementType(models.TextChoices):
		RESTOCK = "RESTOCK", "Restock"
		SALE = "SALE", "Sale"
		ADJUSTMENT = "ADJUSTMENT", "Adjustment"
		RESERVATION = "RESERVATION", "Reservation"
		RESERVATION_RELEASE = "RESERVATION_RELEASE", "Reservation Release"
		RESERVATION_CONSUMED = "RESERVATION_CONSUMED", "Reservation Consumed"
		RETURN = "RETURN", "Return"

	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="inventory_movements")
	movement_type = models.CharField(max_length=40, choices=MovementType.choices, db_index=True)
	quantity_delta = models.IntegerField()
	quantity_before = models.PositiveIntegerField()
	quantity_after = models.PositiveIntegerField()
	reference_type = models.CharField(max_length=40, blank=True, default="")
	reference_id = models.CharField(max_length=80, blank=True, default="")
	note = models.CharField(max_length=255, blank=True, default="")
	created_at = models.DateTimeField(auto_now_add=True, db_index=True)

	class Meta:
		ordering = ["-created_at", "-id"]
		indexes = [
			models.Index(fields=["product", "created_at"]),
			models.Index(fields=["movement_type", "created_at"]),
		]


class StockReservation(models.Model):
	class Status(models.TextChoices):
		ACTIVE = "ACTIVE", "Active"
		RELEASED = "RELEASED", "Released"
		CONSUMED = "CONSUMED", "Consumed"
		EXPIRED = "EXPIRED", "Expired"

	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_reservations")
	variant = models.ForeignKey(
		ProductVariant,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="stock_reservations",
	)
	cart = models.ForeignKey("cart.Cart", on_delete=models.CASCADE, related_name="stock_reservations")
	order = models.ForeignKey(
		"orders.Order",
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="stock_reservations",
	)
	quantity = models.PositiveIntegerField(default=1)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
	expires_at = models.DateTimeField(db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		constraints = [
			models.UniqueConstraint(
				fields=["product", "variant", "cart"],
				condition=models.Q(status="ACTIVE", order__isnull=True),
				name="unique_active_reservation_per_cart_product_variant",
			),
		]
