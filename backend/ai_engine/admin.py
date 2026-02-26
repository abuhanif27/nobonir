from django.contrib import admin
from .models import EmbeddingCache, UserPreference


admin.site.register(EmbeddingCache)
admin.site.register(UserPreference)
