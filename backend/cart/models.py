from django.db import models
from django.conf import settings

from products.models import Product, ProductVariant


class Cart(models.Model):
	user = models.OneToOneField(
		settings.AUTH_USER_MODEL, 
		on_delete=models.CASCADE, 
		related_name="cart",
		null=True,
		blank=True,
	)
	session_key = models.CharField(max_length=40, null=True, blank=True, db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		constraints = [
			models.CheckConstraint(
				condition=models.Q(user__isnull=False) | models.Q(session_key__isnull=False),
				name="cart_must_have_user_or_session"
			),
		]

	def __str__(self):
		if self.user:
			return f"Cart for {self.user.email}"
		return f"Guest cart {self.session_key}"


class CartItem(models.Model):
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
	variant = models.ForeignKey(
		ProductVariant,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="cart_items",
	)
	quantity = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["cart", "product", "variant"], name="unique_cart_product_variant"),
		]


class WishlistItem(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist_items")
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="wishlisted_items")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["user", "product"], name="unique_user_wishlist_product"),
		]
