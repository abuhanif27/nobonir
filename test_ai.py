import os
import sys
import django

def main():
    # Set DJANGO_SETTINGS_MODULE
    os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

    # Add backend to PYTHONPATH
    sys.path.append(os.path.join(os.getcwd(), 'backend'))

    django.setup()

    print("Django setup OK")

    from ai_engine.services.embedding_service import get_encoder
    encoder = get_encoder()
    print(f"Encoder: {encoder}")

    from ai_engine.services.search_service import semantic_product_search
    print("Testing search...")
    results = semantic_product_search("air fryer", limit=3)
    print(f"Found {len(results)} results")
    for r in results:
        print(f" - {r.name}")


if __name__ == "__main__":
    main()
