from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import secrets


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


class PasswordResetToken(models.Model):
	"""Secure password reset tokens sent via email."""
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
	token = models.CharField(max_length=128, unique=True, db_index=True)
	created_at = models.DateTimeField(auto_now_add=True)
	expires_at = models.DateTimeField()
	used = models.BooleanField(default=False)
	used_at = models.DateTimeField(null=True, blank=True)

	def __str__(self):
		return f"Reset token for {self.user.email}"

	@staticmethod
	def generate_token():
		"""Generate a secure random token."""
		return secrets.token_urlsafe(32)

	def is_valid(self):
		"""Check if token is still valid (not expired and not used)."""
		return not self.used and timezone.now() < self.expires_at

	def mark_used(self):
		"""Mark token as used."""
		self.used = True
		self.used_at = timezone.now()
		self.save()
