from sklearn.metrics.pairwise import cosine_similarity
from django.core.cache import cache
from hashlib import md5

from common.performance import capture_performance

from products.models import Product

from .embedding_service import encode_texts


def semantic_product_search(query: str, limit: int = 12):
    normalized_query = (query or "").strip()
    if not normalized_query:
        return []

    safe_limit = max(1, min(int(limit or 12), 50))
    query_digest = md5(normalized_query.lower().encode("utf-8")).hexdigest()
    cache_key = f"semantic_search:v1:{query_digest}:{safe_limit}"
    cached_ids = cache.get(cache_key)
    if cached_ids:
        id_to_product = {
            product.id: product
            for product in Product.objects.filter(id__in=cached_ids, is_active=True)
            .select_related("category")
            .prefetch_related("media", "variants__media")
        }
        ordered = [id_to_product[pid] for pid in cached_ids if pid in id_to_product]
        if ordered:
            return ordered

    with capture_performance("semantic_product_search", extra={"query": normalized_query, "limit": safe_limit}):
        products = list(
            Product.objects.filter(is_active=True, stock__gt=0)
            .select_related("category")
            .prefetch_related("media", "variants__media")
            .only("id", "name", "description", "stock", "price", "category__name", "updated_at")
        )
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

    combined_scores = [
        (semantic_scores[idx] * 0.8) + (keyword_score(products[idx]) * 0.2)
        for idx in range(len(products))
    ]

    ranked_indices = sorted(
        range(len(products)),
        key=lambda idx: combined_scores[idx],
        reverse=True,
    )

    if not ranked_indices:
        return []

    top_score = combined_scores[ranked_indices[0]]
    
    # Two-tier threshold system:
    # 1. Absolute minimum: 0.20 (prevents showing very unrelated items)
    # 2. Relative threshold: 50% of top score (allows similar items to show together)
    absolute_min = 0.20
    relative_threshold = top_score * 0.50
    min_relevance = max(absolute_min, relative_threshold)

    filtered_indices = [
        idx for idx in ranked_indices if combined_scores[idx] >= min_relevance
    ]

    result = [products[index] for index in filtered_indices[:safe_limit]]
    cache.set(cache_key, [item.id for item in result], timeout=120)
    return result
