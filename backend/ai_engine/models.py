from django.db import models


class EmbeddingCache(models.Model):
	text_hash = models.CharField(max_length=64, unique=True)
	vector_json = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)
