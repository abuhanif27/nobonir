from django.db import models
from django.conf import settings

from products.models import Product


class Review(models.Model):
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
	product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
	rating = models.PositiveSmallIntegerField(default=5)
	comment = models.TextField(blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["user", "product"], name="unique_user_product_review"),
		]
		ordering = ["-created_at"]
