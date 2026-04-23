import numpy as np
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Avg, Count, Max
from sklearn.metrics.pairwise import cosine_similarity

from common.performance import capture_performance
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


AGE_CATEGORY_HINTS = (
    ((0, 24), {
        "electronics": 0.45,
        "gaming": 0.45,
        "fashion": 0.35,
        "sports": 0.35,
        "beauty": 0.30,
    }),
    ((25, 39), {
        "office": 0.35,
        "home": 0.30,
        "electronics": 0.30,
        "automotive": 0.25,
        "groceries": 0.20,
    }),
    ((40, 150), {
        "home": 0.40,
        "books": 0.35,
        "groceries": 0.30,
        "office": 0.25,
        "beauty": 0.20,
    }),
)


GEO_CONTEXT_HINTS = (
    (("asia", "bangladesh", "india", "pakistan", "nepal", "sri lanka"), {
        "electronics": 0.30,
        "fashion": 0.30,
        "beauty": 0.25,
        "groceries": 0.20,
    }),
    (("europe", "germany", "france", "uk", "italy", "spain"), {
        "home": 0.30,
        "books": 0.30,
        "fashion": 0.25,
        "automotive": 0.20,
    }),
    (("north america", "usa", "canada", "united states"), {
        "electronics": 0.35,
        "sports": 0.30,
        "automotive": 0.30,
        "office": 0.25,
    }),
    (("south america", "brazil", "argentina", "chile", "peru"), {
        "sports": 0.30,
        "fashion": 0.25,
        "groceries": 0.25,
        "beauty": 0.20,
    }),
    (("africa", "nigeria", "kenya", "ghana", "egypt"), {
        "electronics": 0.30,
        "fashion": 0.25,
        "home": 0.20,
        "groceries": 0.20,
    }),
    (("oceania", "australia", "new zealand"), {
        "sports": 0.30,
        "home": 0.25,
        "beauty": 0.20,
        "automotive": 0.20,
    }),
    (("dhaka", "new york", "london", "tokyo", "dubai", "city", "urban"), {
        "electronics": 0.25,
        "office": 0.25,
        "fashion": 0.20,
        "beauty": 0.20,
    }),
    (("village", "rural", "farm", "district", "upazila"), {
        "groceries": 0.30,
        "home": 0.25,
        "automotive": 0.20,
        "tools": 0.20,
    }),
    (("coast", "beach", "coastal", "sea"), {
        "sports": 0.25,
        "beauty": 0.20,
        "fashion": 0.20,
    }),
)


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

    vectors = np.asarray(
        encode_texts(
            [profile_text, SEGMENT_PROTOTYPES["male"], SEGMENT_PROTOTYPES["female"]]
        ),
        dtype=float,
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


def _age_category_boost(age, category_name: str) -> float:
    if age is None:
        return 0.0

    normalized = (category_name or "").lower()
    if not normalized:
        return 0.0

    for (min_age, max_age), hints in AGE_CATEGORY_HINTS:
        if min_age <= age <= max_age:
            boost = 0.0
            for keyword, value in hints.items():
                if keyword in normalized:
                    boost = max(boost, value)
            return boost
    return 0.0


def _collect_location_context(user, preference: UserPreference) -> str:
    location_parts = [
        preference.location or "",
        preference.continent or "",
        getattr(user, "address", "") or "",
    ]

    latest_order = (
        OrderItem.objects.filter(order__user=user)
        .select_related("order")
        .order_by("-order__created_at")
        .first()
    )
    if latest_order and latest_order.order:
        location_parts.append(latest_order.order.shipping_address or "")
        location_parts.append(latest_order.order.billing_address or "")

    return " ".join(part for part in location_parts if part).strip().lower()


def _location_category_boost(location_context: str, category_name: str) -> float:
    if not location_context:
        return 0.0

    normalized_category = (category_name or "").lower()
    if not normalized_category:
        return 0.0

    boost = 0.0
    for geo_keywords, category_hints in GEO_CONTEXT_HINTS:
        if any(keyword in location_context for keyword in geo_keywords):
            for keyword, value in category_hints.items():
                if keyword in normalized_category:
                    boost = max(boost, value)

    return min(boost, 0.8)


def get_recommendations_for_user(user, limit: int = 8):
    products = list(Product.objects.filter(is_active=True, stock__gt=0).select_related("category"))
    if not products:
        return []

    product_texts = [_product_text(p) for p in products]
    product_vectors = np.asarray(encode_texts(product_texts), dtype=float)

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

    user_gender = (getattr(user, "gender", "") or "").lower()
    if user_gender == "male":
        inferred_segment = "male"
        confidence = max(confidence, 0.9)
    elif user_gender == "female":
        inferred_segment = "female"
        confidence = max(confidence, 0.9)
    if inferred_segment in ("male", "female"):
        for category in Category.objects.all():
            segment_boost = _segment_category_boost(inferred_segment, category.name)
            if segment_boost > 0:
                add_weight(category.id, segment_boost)

    location_context = _collect_location_context(user, preference)
    for category in Category.objects.all():
        age_boost = _age_category_boost(preference.age, category.name)
        if age_boost > 0:
            add_weight(category.id, age_boost)

        geo_boost = _location_category_boost(location_context, category.name)
        if geo_boost > 0:
            add_weight(category.id, geo_boost)

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
    with capture_performance("personalized_recommendations", extra={"user_id": user.id, "limit": int(limit or 8)}):
        products = list(
            Product.objects.filter(is_active=True, stock__gt=0)
            .select_related("category")
            .prefetch_related("media", "variants__media")
        )
        if not products:
            return []

        cache_key = _recommendation_cache_key(user.id, limit)
        cached_ids = cache.get(cache_key)
        if cached_ids:
            product_map = {product.id: product for product in products}
            cached_products = [product_map[pid] for pid in cached_ids if pid in product_map]
            if cached_products:
                return cached_products

        preference, _ = UserPreference.objects.get_or_create(user=user)
        if not preference.trained_category_weights:
            preference = train_user_preference_model(user)

        product_texts = [_product_text(p) for p in products]
        product_vectors = np.asarray(encode_texts(product_texts), dtype=float)

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
            cache.set(cache_key, [product.id for product in recommended], timeout=180)
            return recommended

        fallback = Product.objects.filter(is_active=True, stock__gt=0).annotate(avg=Avg("reviews__rating")).order_by("-avg")
        fallback_list = list(fallback[:limit])
        cache.set(cache_key, [product.id for product in fallback_list], timeout=180)
        return fallback_list


def _recommendation_cache_key(user_id: int, limit: int) -> str:
    safe_limit = max(1, min(int(limit or 8), 20))
    version = _recommendation_cache_version(user_id)
    return f"reco:v2:user:{user_id}:limit:{safe_limit}:v:{version}"


def _recommendation_cache_version(user_id: int) -> str:
    order_info = OrderItem.objects.filter(order__user_id=user_id).aggregate(
        max_created=Max("order__created_at"),
        row_count=Count("id"),
    )
    wishlist_info = WishlistItem.objects.filter(user_id=user_id).aggregate(
        max_created=Max("created_at"),
        row_count=Count("id"),
    )
    cart_info = CartItem.objects.filter(cart__user_id=user_id).aggregate(
        max_updated=Max("updated_at"),
        row_count=Count("id"),
    )
    preference_info = UserPreference.objects.filter(user_id=user_id).aggregate(
        max_updated=Max("updated_at"),
        max_trained=Max("last_trained_at"),
    )
    preference_snapshot = UserPreference.objects.filter(user_id=user_id).values(
        "age",
        "location",
        "continent",
        "inferred_segment",
        "trained_category_weights",
    ).first() or {}
    trained_weights = preference_snapshot.get("trained_category_weights") or {}
    preference_fingerprint = "::".join([
        str(preference_snapshot.get("age") or ""),
        str(preference_snapshot.get("location") or "").lower(),
        str(preference_snapshot.get("continent") or "").lower(),
        str(preference_snapshot.get("inferred_segment") or ""),
        str(len(trained_weights)),
    ])

    parts = [
        _fmt_timestamp(order_info.get("max_created")),
        str(order_info.get("row_count") or 0),
        _fmt_timestamp(wishlist_info.get("max_created")),
        str(wishlist_info.get("row_count") or 0),
        _fmt_timestamp(cart_info.get("max_updated")),
        str(cart_info.get("row_count") or 0),
        _fmt_timestamp(preference_info.get("max_updated")),
        _fmt_timestamp(preference_info.get("max_trained")),
        preference_fingerprint,
    ]
    return "|".join(parts)


def _fmt_timestamp(value):
    if not value:
        return "0"
    return str(int(value.timestamp()))
