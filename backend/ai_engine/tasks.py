from celery import shared_task
from django.apps import apps
from .services.embedding_service import encode_text

@shared_task
def generate_product_embedding_task(product_id: int):
    """
    Background task to generate AI embedding for a product.
    Updates the product.embedding field.
    """
    try:
        # Use apps.get_model to avoid circular import issues
        Product = apps.get_model('products', 'Product')
        product = Product.objects.get(pk=product_id)
        
        # Combine relevant text fields
        text_content = f"{product.name} {product.description} {product.category.name}"
        
        # Generate embedding
        vector = encode_text(text_content)
        
        # Save to DB
        product.embedding = vector
        # Only update the embedding field to avoid race conditions with other updates
        product.save(update_fields=['embedding'])
        
        print(f"SUCCESS: Generated embedding for Product ID {product_id}")
        
    except Product.DoesNotExist:
        print(f"ERROR: Product ID {product_id} not found.")
    except Exception as e:
        print(f"ERROR generating embedding for Product ID {product_id}: {e}")
