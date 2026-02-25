from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
	class Role(models.TextChoices):
		ADMIN = "ADMIN", "Admin"
		CUSTOMER = "CUSTOMER", "Customer"

	email = models.EmailField(unique=True)
	role = models.CharField(max_length=16, choices=Role.choices, default=Role.CUSTOMER, db_index=True)

	REQUIRED_FIELDS = ["email"]

	def __str__(self):
		return f"{self.username} ({self.role})"
