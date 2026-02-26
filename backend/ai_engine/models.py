from django.db import models
from django.conf import settings

from products.models import Category


class EmbeddingCache(models.Model):
	text_hash = models.CharField(max_length=64, unique=True)
	vector_json = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)


class UserPreference(models.Model):
	class InferredSegment(models.TextChoices):
		MALE = "male", "Male"
		FEMALE = "female", "Female"
		NEUTRAL = "neutral", "Neutral"

	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_preference")
	age = models.PositiveIntegerField(null=True, blank=True)
	location = models.CharField(max_length=120, blank=True)
	continent = models.CharField(max_length=40, blank=True)
	preferred_categories = models.ManyToManyField(Category, blank=True, related_name="preferred_by_users")
	trained_category_weights = models.JSONField(default=dict, blank=True)
	inferred_segment = models.CharField(
		max_length=10,
		choices=InferredSegment.choices,
		default=InferredSegment.NEUTRAL,
	)
	inferred_segment_confidence = models.FloatField(default=0.0)
	last_trained_at = models.DateTimeField(null=True, blank=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-updated_at"]

	def __str__(self):
		return f"Preference<{self.user.email}>"
