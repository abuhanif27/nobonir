from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Product
from ai_engine.tasks import generate_product_embedding_task

@receiver(post_save, sender=Product)
def trigger_embedding_generation(sender, instance, created, update_fields, **kwargs):
    """
    Trigger AI embedding generation whenever a product is created or updated.
    Checks if relevant fields (name, description) changed to avoid unnecessary re-calculation.
    """
    # If update_fields is specified, only trigger if relevant fields changed
    relevant_fields = {'name', 'description', 'category'}
    
    should_run = False
    
    if created:
        should_run = True
    elif update_fields:
        # Check if any relevant field is in the update_fields set
        if any(field in relevant_fields for field in update_fields):
            should_run = True
    else:
        # If update_fields is None (default save), assume something important might have changed
        # Unless we are only saving the embedding itself (to avoid infinite loops!)
        # But we can't easily check that here without 'update_fields'.
        # So we trust the task.save(update_fields=['embedding']) logic in tasks.py
        should_run = True

    if should_run:
        # Use .delay() to send to Celery worker
        # On_commit ensures transaction is committed before worker tries to read it
        from django.db import transaction
        transaction.on_commit(lambda: generate_product_embedding_task.delay(instance.id))
