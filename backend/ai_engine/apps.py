from django.apps import AppConfig


class AiEngineConfig(AppConfig):
    name = 'ai_engine'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        from .services.embedding_service import get_encoder

        get_encoder()
