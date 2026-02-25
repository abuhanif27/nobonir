import numpy as np
from django.db.models import Avg, Count

from .models import CartItem, Product, Review, WishlistItem


def _build_feature_matrix(products):
    category_ids = sorted({p.category_id for p in products})
    category_map = {category_id: index for index, category_id in enumerate(category_ids)}

    prices = np.array([float(p.price) for p in products], dtype=float)
    max_price = prices.max() if len(prices) else 1

    matrix = []
    for product in products:
        vec = np.zeros(len(category_ids) + 2, dtype=float)
        vec[category_map[product.category_id]] = 1.0
        vec[-2] = float(product.offer_percent) / 100.0
        vec[-1] = float(product.price) / max_price if max_price else 0
        matrix.append(vec)

    return np.array(matrix)


def recommend_products(customer_id: str, limit: int = 6):
    products = list(Product.objects.filter(is_active=True).select_related('category'))
    if len(products) < 2:
        return products

    index_map = {product.id: idx for idx, product in enumerate(products)}
    features = _build_feature_matrix(products)

    history_ids = set(
        CartItem.objects.filter(customer_id=customer_id).values_list('product_id', flat=True)
    )
    history_ids.update(
        WishlistItem.objects.filter(customer_id=customer_id).values_list('product_id', flat=True)
    )

    if history_ids:
        user_vectors = np.array([features[index_map[item_id]] for item_id in history_ids if item_id in index_map])
        if len(user_vectors) > 0:
            user_profile = user_vectors.mean(axis=0)
            sims = features @ user_profile / (
                np.linalg.norm(features, axis=1) * np.linalg.norm(user_profile) + 1e-10
            )
            ranked = np.argsort(-sims)
            result = [products[idx] for idx in ranked if products[idx].id not in history_ids]
            if result:
                return result[:limit]

    popular_ids = list(
        Review.objects.values('product_id')
        .annotate(score=Avg('rating'), total=Count('id'))
        .order_by('-score', '-total')
        .values_list('product_id', flat=True)
    )
    popular_products = [product for product in products if product.id in popular_ids]
    if popular_products:
        return popular_products[:limit]

    return products[:limit]
