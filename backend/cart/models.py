from django.db import models
from django.conf import settings

from products.models import Product


class Cart(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart")
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)


class CartItem(models.Model):
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="cart_items")
	quantity = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["cart", "product"], name="unique_cart_product"),
		]


class WishlistItem(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist_items")
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="wishlisted_items")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["user", "product"], name="unique_user_wishlist_product"),
		]
