import numpy as np
from django.utils import timezone
from django.db.models import Avg
from sklearn.metrics.pairwise import cosine_similarity

from cart.models import CartItem
from cart.models import WishlistItem
from orders.models import OrderItem
from products.models import Product
from ai_engine.models import UserPreference

from .embedding_service import encode_texts


def _product_text(product: Product) -> str:
    return f"{product.name} {product.category.name} {product.description}"


def get_recommendations_for_user(user, limit: int = 8):
    products = list(Product.objects.filter(is_active=True, stock__gt=0).select_related("category"))
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

    fallback = Product.objects.filter(is_active=True, stock__gt=0).annotate(avg=Avg("reviews__rating")).order_by("-avg")
    return list(fallback[:limit])


def train_user_preference_model(user):
    preference, _ = UserPreference.objects.get_or_create(user=user)
    category_weights = {}

    def add_weight(category_id, value):
        key = str(category_id)
        category_weights[key] = float(category_weights.get(key, 0.0) + value)

    for category in preference.preferred_categories.all():
        add_weight(category.id, 4.0)

    for item in OrderItem.objects.filter(order__user=user).select_related("product__category"):
        add_weight(item.product.category_id, 2.0 * float(item.quantity))

    for item in WishlistItem.objects.filter(user=user).select_related("product__category"):
        add_weight(item.product.category_id, 1.2)

    for item in CartItem.objects.filter(cart__user=user).select_related("product__category"):
        add_weight(item.product.category_id, 0.8 * float(item.quantity))

    demographic_boost = 0.5
    if preference.age is not None:
        if preference.age < 24:
            for category in preference.preferred_categories.all():
                add_weight(category.id, demographic_boost)
        elif preference.age >= 45:
            for category in preference.preferred_categories.all():
                add_weight(category.id, demographic_boost)

    preference.trained_category_weights = category_weights
    preference.last_trained_at = timezone.now()
    preference.save(update_fields=["trained_category_weights", "last_trained_at", "updated_at"])
    return preference


def get_personalized_recommendations_for_user(user, limit: int = 8):
    products = list(Product.objects.filter(is_active=True, stock__gt=0).select_related("category"))
    if not products:
        return []

    preference, _ = UserPreference.objects.get_or_create(user=user)
    if not preference.trained_category_weights:
        preference = train_user_preference_model(user)

    product_texts = [_product_text(p) for p in products]
    product_vectors = encode_texts(product_texts)

    history_product_ids = list(
        OrderItem.objects.filter(order__user=user).values_list("product_id", flat=True)
    )
    history_product_ids += list(WishlistItem.objects.filter(user=user).values_list("product_id", flat=True))

    id_to_index = {p.id: i for i, p in enumerate(products)}
    history_indices = [id_to_index[pid] for pid in history_product_ids if pid in id_to_index]

    if history_indices:
        user_profile = np.mean(product_vectors[history_indices], axis=0).reshape(1, -1)
        semantic_scores = cosine_similarity(user_profile, product_vectors).flatten()
    else:
        semantic_scores = np.zeros(len(products))

    scored = []
    for index, product in enumerate(products):
        if product.id in history_product_ids:
            continue
        category_score = float(preference.trained_category_weights.get(str(product.category_id), 0.0))
        score = (semantic_scores[index] * 3.0) + category_score
        scored.append((score, product))

    scored.sort(key=lambda row: row[0], reverse=True)
    recommended = [product for _, product in scored[:limit]]

    if recommended:
        return recommended

    fallback = Product.objects.filter(is_active=True, stock__gt=0).annotate(avg=Avg("reviews__rating")).order_by("-avg")
    return list(fallback[:limit])
