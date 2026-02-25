from django.db import models


class Category(models.Model):
	name = models.CharField(max_length=120, unique=True)
	slug = models.SlugField(max_length=140, unique=True)

	def __str__(self):
		return self.name


class Product(models.Model):
	category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
	name = models.CharField(max_length=180)
	description = models.TextField(blank=True)
	price = models.DecimalField(max_digits=10, decimal_places=2)
	stock = models.PositiveIntegerField(default=0)
	image_url = models.URLField(blank=True)
	offer_percent = models.PositiveIntegerField(default=0)
	is_active = models.BooleanField(default=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']

	@property
	def discounted_price(self):
		return float(self.price) * (1 - (self.offer_percent / 100))

	def __str__(self):
		return self.name


class Review(models.Model):
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
	customer_name = models.CharField(max_length=100)
	rating = models.PositiveSmallIntegerField(default=5)
	comment = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']


class WishlistItem(models.Model):
	customer_id = models.CharField(max_length=64, db_index=True)
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='wishlisted_by')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['customer_id', 'product'], name='unique_wishlist_item')
		]


class CartItem(models.Model):
	customer_id = models.CharField(max_length=64, db_index=True)
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='carted_by')
	quantity = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['customer_id', 'product'], name='unique_cart_item')
		]


class Order(models.Model):
	class Status(models.TextChoices):
		PENDING = 'PENDING', 'Pending'
		PAID = 'PAID', 'Paid'
		SHIPPED = 'SHIPPED', 'Shipped'
		DELIVERED = 'DELIVERED', 'Delivered'
		CANCELLED = 'CANCELLED', 'Cancelled'

	customer_name = models.CharField(max_length=120)
	customer_email = models.EmailField(db_index=True)
	shipping_address = models.TextField()
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	total_amount = models.DecimalField(max_digits=10, decimal_places=2)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['-created_at']


class OrderItem(models.Model):
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
	product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
	product_name = models.CharField(max_length=200)
	quantity = models.PositiveIntegerField(default=1)
	unit_price = models.DecimalField(max_digits=10, decimal_places=2)
