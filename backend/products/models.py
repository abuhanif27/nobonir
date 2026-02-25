from django.db import models


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
	is_active = models.BooleanField(default=True, db_index=True)
	image_url = models.URLField(blank=True)
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
