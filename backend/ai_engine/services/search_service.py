from sklearn.metrics.pairwise import cosine_similarity

from products.models import Product

from .embedding_service import encode_texts


def semantic_product_search(query: str, limit: int = 12):
    normalized_query = (query or "").strip()
    if not normalized_query:
        return []

    products = list(Product.objects.filter(is_active=True).select_related("category"))
    if not products:
        return []

    corpus = [f"{item.name} {item.category.name} {item.description}" for item in products]
    vectors = encode_texts(corpus + [normalized_query])
    semantic_scores = cosine_similarity([vectors[-1]], vectors[:-1]).flatten()

    query_terms = [term for term in normalized_query.lower().split() if term]

    def keyword_score(product):
        if not query_terms:
            return 0.0

        name = product.name.lower()
        category = product.category.name.lower()
        description = (product.description or "").lower()

        score = 0.0
        for term in query_terms:
            if term in name:
                score += 2.0
            if term in category:
                score += 1.25
            if term in description:
                score += 1.0
        return score / len(query_terms)

    ranked_indices = sorted(
        range(len(products)),
        key=lambda idx: (semantic_scores[idx] * 0.8) + (keyword_score(products[idx]) * 0.2),
        reverse=True,
    )

    safe_limit = max(1, min(int(limit or 12), 50))
    return [products[index] for index in ranked_indices[:safe_limit]]
