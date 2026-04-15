from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
	class Role(models.TextChoices):
		ADMIN = "ADMIN", "Admin"
		CUSTOMER = "CUSTOMER", "Customer"

	class Gender(models.TextChoices):
		MALE = "MALE", "Male"
		FEMALE = "FEMALE", "Female"
		OTHER = "OTHER", "Other"

	email = models.EmailField(unique=True)
	role = models.CharField(max_length=16, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
	profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
	phone_number = models.CharField(max_length=20, blank=True, null=True)
	address = models.TextField(blank=True, null=True)
	date_of_birth = models.DateField(blank=True, null=True)
	gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)

	REQUIRED_FIELDS = ["email"]

	def __str__(self):
		return f"{self.username} ({self.role})"
