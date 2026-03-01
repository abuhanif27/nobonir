import os
from django.apps import AppConfig


class AiEngineConfig(AppConfig):
    name = 'ai_engine'
    default_auto_field = 'django.db.models.BigAutoField'
    path = os.path.dirname(os.path.abspath(__file__))

    def ready(self):
        from .services.embedding_service import get_encoder
        get_encoder()
