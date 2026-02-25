from sklearn.metrics.pairwise import cosine_similarity

from products.models import Product

from .embedding_service import encode_texts


def semantic_product_search(query: str, limit: int = 12):
    products = list(Product.objects.filter(is_active=True).select_related("category"))
    if not products:
        return []

    corpus = [f"{item.name} {item.category.name} {item.description}" for item in products]
    vectors = encode_texts(corpus + [query])
    scores = cosine_similarity([vectors[-1]], vectors[:-1]).flatten()

    ranked_indices = sorted(range(len(products)), key=lambda idx: scores[idx], reverse=True)
    return [products[index] for index in ranked_indices[:limit]]
