import numpy as np
from django.utils import timezone
from django.db.models import Avg
from sklearn.metrics.pairwise import cosine_similarity

from cart.models import CartItem
from cart.models import WishlistItem
from orders.models import OrderItem
from products.models import Category, Product
from ai_engine.models import UserPreference

from .embedding_service import encode_texts


PROFILE_SEGMENTS = ("male", "female", "neutral")

SEGMENT_PROTOTYPES = {
    "male": (
        "male customer profile interested in electronics, gadgets, sports, fitness, tools, "
        "gaming, watches, sneakers, and technology products"
    ),
    "female": (
        "female customer profile interested in fashion, beauty, skincare, home decor, "
        "kitchen, accessories, jewelry, wellness, and lifestyle products"
    ),
}

SEGMENT_CATEGORY_HINTS = {
    "male": {
        "electronics": 0.7,
        "sports": 0.65,
        "fitness": 0.65,
        "automotive": 0.6,
        "gaming": 0.6,
        "tools": 0.55,
    },
    "female": {
        "fashion": 0.7,
        "beauty": 0.7,
        "home": 0.55,
        "kitchen": 0.55,
        "accessories": 0.6,
        "jewelry": 0.65,
    },
}


def _product_text(product: Product) -> str:
    return f"{product.name} {product.category.name} {product.description}"


def _build_profile_text(user, preference: UserPreference) -> str:
    preferred_category_names = list(
        preference.preferred_categories.values_list("name", flat=True)
    )
    interaction_texts = []

    for item in OrderItem.objects.filter(order__user=user).select_related("product__category")[:20]:
        interaction_texts.append(_product_text(item.product))

    for item in WishlistItem.objects.filter(user=user).select_related("product__category")[:20]:
        interaction_texts.append(_product_text(item.product))

    for item in CartItem.objects.filter(cart__user=user).select_related("product__category")[:20]:
        interaction_texts.append(_product_text(item.product))

    email_local_part = (getattr(user, "email", "") or "").split("@", 1)[0]

    profile_parts = [
        getattr(user, "first_name", "") or "",
        getattr(user, "last_name", "") or "",
        email_local_part,
        preference.location or "",
        preference.continent or "",
        " ".join(preferred_category_names),
        " ".join(interaction_texts),
    ]

    return " ".join(part for part in profile_parts if part).strip()


def infer_profile_segment(user, preference: UserPreference):
    profile_text = _build_profile_text(user, preference)
    if not profile_text:
        return "neutral", 0.0

    vectors = encode_texts(
        [profile_text, SEGMENT_PROTOTYPES["male"], SEGMENT_PROTOTYPES["female"]]
    )

    profile_vector = vectors[0].reshape(1, -1)
    male_similarity = float(
        cosine_similarity(profile_vector, vectors[1].reshape(1, -1)).flatten()[0]
    )
    female_similarity = float(
        cosine_similarity(profile_vector, vectors[2].reshape(1, -1)).flatten()[0]
    )

    confidence = abs(male_similarity - female_similarity)
    if confidence < 0.045:
        return "neutral", confidence

    segment = "male" if male_similarity > female_similarity else "female"
    return segment, confidence


def _segment_category_boost(segment: str, category_name: str) -> float:
    if segment not in SEGMENT_CATEGORY_HINTS:
        return 0.0

    normalized = (category_name or "").lower()
    if not normalized:
        return 0.0

    boost = 0.0
    for keyword, value in SEGMENT_CATEGORY_HINTS[segment].items():
        if keyword in normalized:
            boost = max(boost, value)

    return boost


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

    inferred_segment, confidence = infer_profile_segment(user, preference)
    if inferred_segment in ("male", "female"):
        for category in Category.objects.all():
            segment_boost = _segment_category_boost(inferred_segment, category.name)
            if segment_boost > 0:
                add_weight(category.id, segment_boost)

    demographic_boost = 0.5
    if preference.age is not None:
        if preference.age < 24:
            for category in preference.preferred_categories.all():
                add_weight(category.id, demographic_boost)
        elif preference.age >= 45:
            for category in preference.preferred_categories.all():
                add_weight(category.id, demographic_boost)

    preference.trained_category_weights = category_weights
    preference.inferred_segment = (
        inferred_segment if inferred_segment in PROFILE_SEGMENTS else "neutral"
    )
    preference.inferred_segment_confidence = confidence
    preference.last_trained_at = timezone.now()
    preference.save(
        update_fields=[
            "trained_category_weights",
            "inferred_segment",
            "inferred_segment_confidence",
            "last_trained_at",
            "updated_at",
        ]
    )
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
