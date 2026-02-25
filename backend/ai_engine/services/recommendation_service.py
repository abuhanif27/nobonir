import numpy as np
from django.db.models import Avg
from sklearn.metrics.pairwise import cosine_similarity

from cart.models import WishlistItem
from orders.models import OrderItem
from products.models import Product

from .embedding_service import encode_texts


def _product_text(product: Product) -> str:
    return f"{product.name} {product.category.name} {product.description}"


def get_recommendations_for_user(user, limit: int = 8):
    products = list(Product.objects.filter(is_active=True).select_related("category"))
    if not products:
        return []

    product_texts = [_product_text(p) for p in products]
    product_vectors = encode_texts(product_texts)

    history_product_ids = list(
        OrderItem.objects.filter(order__user=user).values_list("product_id", flat=True)
    )
    history_product_ids += list(WishlistItem.objects.filter(user=user).values_list("product_id", flat=True))

    if not history_product_ids:
        return products[:limit]

    id_to_index = {p.id: i for i, p in enumerate(products)}
    history_indices = [id_to_index[pid] for pid in history_product_ids if pid in id_to_index]
    if not history_indices:
        return products[:limit]

    user_profile = np.mean(product_vectors[history_indices], axis=0).reshape(1, -1)
    similarities = cosine_similarity(user_profile, product_vectors).flatten()

    ranked = sorted(range(len(products)), key=lambda idx: similarities[idx], reverse=True)
    result = [products[i] for i in ranked if products[i].id not in history_product_ids]

    if result:
        return result[:limit]

    fallback = Product.objects.filter(is_active=True).annotate(avg=Avg("reviews__rating")).order_by("-avg")
    return list(fallback[:limit])
