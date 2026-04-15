from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import quote
from urllib.request import urlopen
from urllib.error import URLError, HTTPError
import re
import sys
from uuid import uuid4
from django.conf import settings
from django.db.models import Q, Sum
import requests

from cart.models import CartItem, WishlistItem
from ai_engine.models import AssistantChatMessage, AssistantChatSession
from orders.models import Order, OrderItem
from products.models import Product
from products.serializers import ProductSerializer
from products.services import get_available_stock

from .recommendation_service import get_personalized_recommendations_for_user
from .search_service import semantic_product_search


@dataclass
class AssistantResult:
    intent: str
    reply: str
    products: list[Product]
    llm_provider: str
    llm_enhanced: bool
    llm_attempts: list[str]


def _is_test_process() -> bool:
    return "test" in sys.argv


def _free_llm_enabled() -> bool:
    return bool(getattr(settings, "AI_FREE_LLM_ENABLED", True)) and not _is_test_process()


def _pollinations_reply(prompt: str) -> str | None:
    base_url = str(getattr(settings, "AI_FREE_LLM_POLLINATIONS_URL", "https://text.pollinations.ai")).rstrip("/")
    timeout = float(getattr(settings, "AI_FREE_LLM_TIMEOUT_SECONDS", 8))
    endpoint = f"{base_url}/{quote(prompt)}"

    try:
        with urlopen(endpoint, timeout=timeout) as response:
            if response.status != 200:
                return None
            text = response.read().decode("utf-8", errors="ignore").strip()
            return text or None
    except (URLError, HTTPError, TimeoutError, ValueError):
        return None


def _huggingface_reply(prompt: str) -> str | None:
    url = str(getattr(settings, "AI_FREE_LLM_HUGGINGFACE_URL", "")).strip()
    if not url:
        return None

    timeout = float(getattr(settings, "AI_FREE_LLM_TIMEOUT_SECONDS", 8))
    token = str(getattr(settings, "AI_FREE_LLM_HUGGINGFACE_TOKEN", "")).strip()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 220,
            "return_full_text": False,
            "temperature": 0.3,
        },
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if response.status_code != 200:
            return None

        data = response.json()
        if isinstance(data, list) and data:
            item = data[0]
            if isinstance(item, dict):
                text = str(item.get("generated_text") or "").strip()
                return text or None

        if isinstance(data, dict):
            text = str(data.get("generated_text") or data.get("text") or "").strip()
            return text or None

        return None
    except (requests.RequestException, ValueError, TypeError):
        return None


def _ollama_reply(prompt: str) -> str | None:
    """Call local Ollama instance running Phi-3 Mini or similar model."""
    ollama_url = str(getattr(settings, "AI_OLLAMA_API_URL", "http://127.0.0.1:11434")).rstrip("/")
    model = str(getattr(settings, "AI_OLLAMA_MODEL", "phi")).strip().lower()
    timeout = float(getattr(settings, "AI_FREE_LLM_TIMEOUT_SECONDS", 20))

    if not ollama_url:
        return None

    # Ollama API endpoint: POST /api/generate
    generate_url = f"{ollama_url}/api/generate"
    headers = {"Content-Type": "application/json"}
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 200,  # max tokens
        },
    }

    try:
        response = requests.post(generate_url, headers=headers, json=payload, timeout=timeout)
        if response.status_code != 200:
            return None

        data = response.json()
        text = str(data.get("response") or "").strip()
        return text or None
    except (requests.RequestException, ValueError, TypeError, TimeoutError):
        return None


def _build_ollama_prompt(intent: str, message: str, products: list[Product], fallback_reply: str, is_authenticated: bool) -> str:
    product_lines = []
    for product in products[:3]:
        stock = get_available_stock(product)
        if is_authenticated:
            stock_info = f"Stock {stock}"
            price_info = f"Price {product.price}"
        else:
            stock_info = "In Stock" if stock > 0 else "Out of Stock"
            price_info = f"Price {product.price}"
        product_lines.append(f"{product.name} | {price_info} | {stock_info}")

    product_context = "\n".join(product_lines) if product_lines else "No product matches found."
    auth_rule = (
        "If the user is signed in, you may mention exact stock numbers."
        if is_authenticated
        else "If the user is a guest, do not reveal exact stock numbers. Use only In Stock or Out of Stock."
    )

    return (
        "You are Nobonir Assistant, a friendly shopping helper.\n"
        f"Intent: {intent}\n"
        f"User message: {message}\n"
        f"Product context:\n{product_context}\n"
        f"Draft reply: {fallback_reply}\n"
        f"Rule: {auth_rule}\n"
        "Write a natural reply in 1 to 2 short sentences. Keep it human, direct, and helpful. "
        "Do not sound scripted."
    )


def _configured_provider_chain() -> list[str]:
    configured = list(getattr(settings, "AI_FREE_LLM_PROVIDERS", []))
    normalized = [str(item).strip().lower() for item in configured if str(item).strip()]
    if normalized:
        return normalized

    single = str(getattr(settings, "AI_FREE_LLM_PROVIDER", "pollinations")).strip().lower()
    return [single] if single else ["pollinations"]


def get_llm_runtime_status() -> dict:
    return {
        "enabled": _free_llm_enabled(),
        "providers": _configured_provider_chain(),
        "timeout_seconds": float(getattr(settings, "AI_FREE_LLM_TIMEOUT_SECONDS", 8)),
        "huggingface_token_configured": bool(
            str(getattr(settings, "AI_FREE_LLM_HUGGINGFACE_TOKEN", "")).strip()
        ),
        "test_mode": _is_test_process(),
    }


# General store knowledge to provide to the LLM
STORE_KNOWLEDGE = {
    "shipping_policy": "We offer standard shipping across Bangladesh (2-3 days in Dhaka, 5-7 days outside).",
    "return_policy": "7-day easy return policy for unused items in original packaging.",
    "payment_methods": "We accept Cash on Delivery, bKash, Nagad, and all major Credit/Debit cards.",
    "customer_support": "Available 10 AM - 10 PM daily via phone or email.",
}


def _build_llm_prompt(intent: str, message: str, products: list[Product], fallback_reply: str, is_authenticated: bool, history: list[dict] | None = None) -> str:
    product_lines = []
    for product in products[:5]:
        stock = get_available_stock(product)
        # Information Disclosure Limit for Guest vs Member
        if is_authenticated:
            stock_info = f"Exact Stock: {stock}"
            price_info = f"Member Price: {product.price}"
        else:
            stock_info = "Status: In Stock" if stock > 0 else "Status: Out of Stock"
            price_info = f"Price: {product.price}"
            
        desc = (product.description or "").strip()
        if len(desc) > 100:
            desc = desc[:97] + "..."
        
        product_lines.append(
            f"- {product.name} | Category: {product.category.name} | {price_info} | {stock_info} | Info: {desc or 'N/A'}"
        )

    context = "\n".join(product_lines) if product_lines else "- No specific products found matching the request."
    auth_status = "Premium Member (Full Access)" if is_authenticated else "Guest Shopper (Limited Access)"

    history_text = ""
    if history:
        history_lines = []
        for msg in history[-4:]:
            role = "User" if msg["role"] == "user" else "Nobonir Assistant"
            history_lines.append(f"{role}: {msg['text']}")
        history_text = "Recent Conversation History:\n" + "\n".join(history_lines) + "\n\n"

    # Define strict rules for information disclosure based on auth status
    disclosure_rules = (
        "Member-Specific Guidelines (User is Authenticated):\n"
        "- Share exact stock numbers and specific inventory status.\n"
        "- Provide highly personalized shopping advice based on their history.\n"
        "- Use a familiar, welcoming tone that acknowledges their membership.\n\n"
        "Guest-Specific Guidelines (User is GUEST):\n"
        "- DO NOT share exact stock quantities (only use 'In Stock' or 'Out of Stock').\n"
        "- Provide general, professional product information only.\n"
        "- Politely mention that signing in unlocks detailed availability and personalized rewards.\n"
        "- Keep responses helpful but professional and less familiar.\n"
    )

    store_facts = "\n".join([f"- {k.replace('_', ' ').title()}: {v}" for k, v in STORE_KNOWLEDGE.items()])

    return (
        "You are the 'Nobonir AI Assistant', a highly professional shopping consultant. "
        "Your goal is to provide a conversational, knowledgeable, and proactive experience.\n\n"
        f"{disclosure_rules}\n"
        f"Store Context: Nobonir is Bangladesh's leading premium e-commerce platform.\n"
        f"Store Policies & Knowledge:\n{store_facts}\n"
        f"User Profile: {auth_status}\n"
        f"{history_text}"
        f"Current Intent: {intent}\n"
        f"User's Query: {message}\n\n"
        "Available Product Catalog Context (use these for specific details):\n"
        f"{context}\n\n"
        f"Initial Draft (for guidance): {fallback_reply}\n\n"
        "Guidelines for Response:\n"
        "1. Be concise but human-like (3-5 sentences).\n"
        "2. If products are available, highlight their key benefits/prices naturally.\n"
        "3. STRICTLY follow the disclosure rules for the current User Profile.\n"
        "4. Use 'Store Policies & Knowledge' to answer general questions about shipping, returns, etc.\n"
        "5. End with a helpful follow-up question.\n"
        "Now, generate your super professional response:"
    )


SMALL_TALK_KEYWORDS = {
    "hi",
    "hello",
    "hey",
    "yo",
    "good morning",
    "good evening",
    "good afternoon",
    "how are you",
    "how's it going",
    "sup",
    "hi there",
    "hello there",
    "hey there",
    "who are you",
    "what is your name",
    "what's your name",
    "your name",
}


TERM_STOPWORDS = {
    "what",
    "your",
    "today",
    "personal",
    "recommendation",
    "recommendations",
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "show",
    "find",
    "want",
    "need",
    "best",
    "price",
    "stock",
    "product",
    "products",
    "under",
    "below",
}


ASSISTANT_ARTIFACT_PREFIXES = (
    "test",
    "tmp",
    "perf",
    "demo",
    "sample",
    "dummy",
)


def _is_catalog_artifact(product: Product) -> bool:
    name = (product.name or "").strip().lower()
    slug = (product.slug or "").strip().lower()
    return any(name.startswith(prefix) or slug.startswith(prefix) for prefix in ASSISTANT_ARTIFACT_PREFIXES)


def _filter_real_catalog_products(products: list[Product], limit: int | None = None) -> list[Product]:
    filtered = [product for product in products if not _is_catalog_artifact(product)]
    if limit is None:
        return filtered
    return filtered[:limit]


def _dedupe_products(products: list[Product], limit: int | None = None) -> list[Product]:
    seen_ids: set[int] = set()
    deduped: list[Product] = []
    for product in products:
        if product.id in seen_ids:
            continue
        seen_ids.add(product.id)
        deduped.append(product)
        if limit is not None and len(deduped) >= limit:
            break
    return deduped


def _diversify_by_category(products: list[Product], limit: int = 8, per_category_cap: int = 2) -> list[Product]:
    if not products:
        return []

    # First pass: maximize category coverage.
    used_categories: set[int] = set()
    category_counts: dict[int, int] = defaultdict(int)
    picked: list[Product] = []
    remaining: list[Product] = []

    for product in products:
        category_id = int(product.category_id or 0)
        if category_id not in used_categories:
            used_categories.add(category_id)
            category_counts[category_id] += 1
            picked.append(product)
            if len(picked) >= limit:
                return picked
        else:
            remaining.append(product)

    # Second pass: fill while limiting dominance of one category.
    for product in remaining:
        category_id = int(product.category_id or 0)
        if category_counts[category_id] >= per_category_cap:
            continue
        category_counts[category_id] += 1
        picked.append(product)
        if len(picked) >= limit:
            break

    return picked[:limit]


def _user_category_weights(user) -> dict[int, float]:
    if not _is_authenticated_user(user):
        return {}

    weights: dict[int, float] = defaultdict(float)

    for item in (
        OrderItem.objects.filter(order__user=user)
        .select_related("product")
        .only("product__category_id", "quantity")[:120]
    ):
        category_id = int(getattr(item.product, "category_id", 0) or 0)
        if category_id:
            weights[category_id] += float(item.quantity or 1) * 4.0

    for item in (
        WishlistItem.objects.filter(user=user)
        .select_related("product")
        .only("product__category_id")[:80]
    ):
        category_id = int(getattr(item.product, "category_id", 0) or 0)
        if category_id:
            weights[category_id] += 2.0

    for item in (
        CartItem.objects.filter(cart__user=user)
        .select_related("product")
        .only("product__category_id", "quantity")[:80]
    ):
        category_id = int(getattr(item.product, "category_id", 0) or 0)
        if category_id:
            weights[category_id] += float(item.quantity or 1) * 1.5

    return dict(weights)


def _rank_products_with_user_signal(products: list[Product], user) -> list[Product]:
    weights = _user_category_weights(user)
    if not weights:
        return products

    scored: list[tuple[float, int, Product]] = []
    for index, product in enumerate(products):
        category_weight = float(weights.get(int(product.category_id or 0), 0.0))
        scored.append((category_weight, -index, product))

    scored.sort(reverse=True)
    return [product for _, _, product in scored]


def _is_small_talk(normalized_message: str) -> bool:
    compact = normalized_message.strip().lower()
    # Direct match in keywords
    if compact in SMALL_TALK_KEYWORDS:
        return True

    # Phrase-based matching avoids false positives such as "shirt" matching "hi".
    msg_clean = re.sub(r"[^a-z\s]", " ", compact)
    msg_clean = f" {' '.join(msg_clean.split())} "
    if any(f" {k} " in msg_clean for k in SMALL_TALK_KEYWORDS):
        return True
        
    # If it's just a greeting and nothing else
    words = compact.split()
    if len(words) <= 1 and words and words[0] in {"hi", "hey", "hello", "yo"}:
        return True
    return False


def _is_help_query(normalized_message: str) -> bool:
    msg = normalized_message.lower()
    return any(k in msg for k in ["help", "support", "what can you do", "capabilities", "features"])


def _query_terms(normalized_message: str) -> list[str]:
    terms = re.findall(r"[a-z0-9]+", normalized_message)
    return [term for term in terms if len(term) >= 3 and term not in TERM_STOPWORDS]


def _filter_relevant_products(products: list[Product], normalized_message: str, limit: int = 4) -> list[Product]:
    terms = _query_terms(normalized_message)
    if not terms:
        return products[:limit]

    scored: list[tuple[int, Product]] = []
    for product in products:
        text = f"{product.name} {product.category.name} {product.description or ''}".lower()
        score = sum(1 for term in terms if term in text)
        if score > 0:
            scored.append((score, product))

    # For broad asks (e.g., "personal recommendation"), keep curated candidates
    # instead of returning an empty list and a "no matches" reply.
    if not scored:
        return products[:limit]

    scored.sort(key=lambda item: item[0], reverse=True)
    return [product for _, product in scored[:limit]]


def _enhance_reply_with_free_llm(intent: str, message: str, products: list[Product], fallback_reply: str, user, history: list[dict] | None = None) -> str:
    if not _free_llm_enabled():
        return fallback_reply, "local", False, ["local"]

    prompt = _build_llm_prompt(
        intent=intent,
        message=message,
        products=products,
        fallback_reply=fallback_reply,
        is_authenticated=_is_authenticated_user(user),
        history=history,
    )
    ollama_prompt = _build_ollama_prompt(
        intent=intent,
        message=message,
        products=products,
        fallback_reply=fallback_reply,
        is_authenticated=_is_authenticated_user(user),
    )

    attempts: list[str] = []
    for provider in _configured_provider_chain():
        llm_reply: str | None = None
        if provider == "pollinations":
            llm_reply = _pollinations_reply(prompt)
        elif provider == "huggingface":
            llm_reply = _huggingface_reply(prompt)
        elif provider == "ollama":
            llm_reply = _ollama_reply(ollama_prompt)
        else:
            continue

        attempts.append(provider)
        if llm_reply and len(llm_reply) >= 20:
            return llm_reply, provider, True, attempts

    attempts.append("local")
    return fallback_reply, "local", False, attempts


def _result_with_enhancement(intent: str, message: str, products: list[Product], fallback_reply: str, user, history: list[dict] | None = None) -> AssistantResult:
    final_reply, llm_provider, llm_enhanced, llm_attempts = _enhance_reply_with_free_llm(
        intent=intent,
        message=message,
        products=products,
        fallback_reply=fallback_reply,
        user=user,
        history=history,
    )
    return AssistantResult(
        intent=intent,
        reply=final_reply,
        products=products,
        llm_provider=llm_provider,
        llm_enhanced=llm_enhanced,
        llm_attempts=llm_attempts,
    )


def _safe_session_key(candidate: str | None) -> str:
    normalized = (candidate or "").strip()
    if not normalized:
        return str(uuid4())
    return normalized[:80]


def _is_authenticated_user(user) -> bool:
    return bool(getattr(user, "is_authenticated", False))


def _pick_variant(options: list[str], seed_text: str) -> str:
    """Pick a variant from options based on seed text hash."""
    if not options:
        return ""
    seed = sum(ord(ch) for ch in (seed_text or ""))
    return options[seed % len(options)]


def _user_prefix(user) -> str:
    """Get personalized prefix with user first name if authenticated."""
    if not _is_authenticated_user(user):
        return ""
    first_name = (getattr(user, "first_name", "") or "").strip()
    if not first_name:
        return ""
    return f"{first_name}, "


def get_or_create_chat_session(user, session_key: str | None = None) -> AssistantChatSession:
    key = _safe_session_key(session_key)
    if _is_authenticated_user(user):
        session = AssistantChatSession.objects.filter(session_key=key).first()
        if session is None:
            return AssistantChatSession.objects.create(session_key=key, user=user)

        if session.user_id and session.user_id != user.id:
            return AssistantChatSession.objects.create(session_key=str(uuid4()), user=user)

        if session.user_id is None:
            session.user = user
            session.save(update_fields=["user", "updated_at"])
        return session

    return AssistantChatSession.objects.get_or_create(
        session_key=key,
        defaults={"user": None},
    )[0]


def _fallback_products(limit: int = 4) -> list[Product]:
    return list(
        Product.objects.filter(is_active=True, stock__gt=0)
        .exclude(name__istartswith="test")
        .exclude(name__istartswith="tmp")
        .exclude(name__istartswith="perf")
        .exclude(name__istartswith="demo")
        .exclude(name__istartswith="sample")
        .exclude(name__istartswith="dummy")
        .exclude(slug__istartswith="test")
        .exclude(slug__istartswith="tmp")
        .exclude(slug__istartswith="perf")
        .exclude(slug__istartswith="demo")
        .exclude(slug__istartswith="sample")
        .exclude(slug__istartswith="dummy")
        .select_related("category")
        .order_by("-updated_at")[:limit]
    )


def _normalize_message(message: str) -> str:
    return " ".join((message or "").strip().split()).lower()


def _detect_intent(normalized_message: str) -> str:
    # Use keywords to detect intent - expanded for more professional coverage
    msg = normalized_message.lower()
    
    if any(k in msg for k in ["top selling", "best selling", "popular", "trending", "best product", "most popular"]):
        return "TOP_SELLING"

    if any(k in msg for k in ["order", "delivery", "shipping", "track", "status", "where is my", "package"]):
        return "ORDER_HELP"

    if any(k in msg for k in ["stock", "available", "availability", "have it", "ready to"]):
        return "PRICE_STOCK_LOOKUP"

    if any(k in msg for k in ["budget", "cheap", "under", "price", "cost", "how much", "range", "low price"]):
        return "BUDGET_SEARCH"

    if any(k in msg for k in ["size", "fit", "fitting", "wear", "small", "large", "xl", "medium"]):
        return "FIT_HELP"

    if any(k in msg for k in ["recommend", "suggest", "find", "looking for", "need", "show me", "help with", "gift"]):
        return "RECOMMENDATION"

    return "GENERAL"


def _serialize_products(products: list[Product], request) -> list[dict]:
    serialized = ProductSerializer(products, many=True, context={"request": request}).data
    result = []
    
    for item in serialized:
        stock_val = int(item.get("available_stock") or 0)
        
        product_data = {
            "id": int(item.get("id") or 0),
            "name": str(item.get("name") or ""),
            "slug": str(item.get("slug") or ""),
            "price": Decimal(str(item.get("price") or "0")),
            "image": str(item.get("primary_image") or item.get("image_url") or ""),
            "category": str((item.get("category") or {}).get("name") or ""),
            "availability_status": str(item.get("availability_status") or "IN_STOCK"),
            "available_stock": stock_val,
        }

        result.append(product_data)
    return result


def _recommend_products_for_message(user, normalized_message: str) -> list[Product]:
    # Pull a wider candidate pool, then rerank/diversify.
    semantic_results = _filter_real_catalog_products(semantic_product_search(normalized_message, limit=12))

    if _is_authenticated_user(user):
        personalized = _filter_real_catalog_products(get_personalized_recommendations_for_user(user, limit=12))
        trending = _top_selling_products(limit=10)

        merged = _dedupe_products(semantic_results + personalized + trending, limit=24)
        ranked = _rank_products_with_user_signal(merged, user)
        relevant = _filter_relevant_products(ranked, normalized_message, limit=12)
        diversified = _diversify_by_category(relevant, limit=8, per_category_cap=2)
        if diversified:
            return diversified

        return _diversify_by_category(ranked, limit=8, per_category_cap=2)

    # Guest: emphasize trending items with diversity while still honoring semantic hits.
    trending = _top_selling_products(limit=12)
    merged_guest = _dedupe_products(semantic_results + trending + _fallback_products(limit=10), limit=24)
    relevant_guest = _filter_relevant_products(merged_guest, normalized_message, limit=12)
    diversified_guest = _diversify_by_category(relevant_guest, limit=8, per_category_cap=2)
    if diversified_guest:
        return diversified_guest

    return _diversify_by_category(merged_guest, limit=8, per_category_cap=2)


def _top_selling_products(limit: int = 4) -> list[Product]:
    paid_like_statuses = [
        Order.Status.PAID,
        Order.Status.PROCESSING,
        Order.Status.SHIPPED,
        Order.Status.DELIVERED,
    ]

    queryset = (
        Product.objects.filter(is_active=True)
        .select_related("category")
        .annotate(
            total_sold=Sum(
                "order_items__quantity",
                filter=Q(order_items__order__status__in=paid_like_statuses),
            )
        )
        .order_by("-total_sold", "-updated_at")
    )

    products = [
        item
        for item in queryset[: max(1, min(limit, 12))]
        if int(get_available_stock(item)) > 0 and not _is_catalog_artifact(item)
    ]
    if products:
        return products[:limit]
    return _fallback_products(limit=limit)


def _extract_budget_cap(normalized_message: str) -> Decimal | None:
    pattern = re.compile(r"(?:under|below|less than|max|within)\s*(\d+(?:\.\d+)?)")
    match = pattern.search(normalized_message)
    if not match:
        return None

    try:
        return Decimal(match.group(1))
    except Exception:
        return None


def _apply_budget_filter(products: list[Product], budget_cap: Decimal | None, limit: int = 4) -> list[Product]:
    if budget_cap is None:
        return products[:limit]

    filtered = [product for product in products if Decimal(product.price) <= budget_cap]
    if filtered:
        return filtered[:limit]
    return products[:limit]


def _build_price_stock_reply(products: list[Product]) -> str:
    if not products:
        return (
            "I could not find a strong product match for that query. "
            "Try a specific product name to check exact price and stock."
        )

    lines: list[str] = ["Here are the latest product price and stock details:"]
    for product in products[:3]:
        available_stock = get_available_stock(product)
        stock_label = "Out of stock" if available_stock <= 0 else f"Stock: {available_stock}"
        lines.append(f"- {product.name}: {product.price} ({stock_label})")
    return "\n".join(lines)


def list_chat_history(user, session_key: str | None = None, limit: int = 60) -> tuple[str, list[dict]]:
    session = get_or_create_chat_session(user=user, session_key=session_key)
    messages = list(
        session.messages.order_by("created_at", "id")
        .values("role", "text", "intent", "created_at")[: max(1, min(limit, 200))]
    )
    return session.session_key, messages


def clear_chat_history(user, session_key: str | None = None) -> str:
    key = (session_key or "").strip()
    if not key:
        return get_or_create_chat_session(user=user, session_key=None).session_key

    session = AssistantChatSession.objects.filter(session_key=key).first()
    if session is None:
        return get_or_create_chat_session(user=user, session_key=None).session_key

    if _is_authenticated_user(user):
        if session.user_id and session.user_id != user.id:
            return get_or_create_chat_session(user=user, session_key=None).session_key
    else:
        if session.user_id is not None:
            return get_or_create_chat_session(user=user, session_key=None).session_key

    session.delete()
    return get_or_create_chat_session(user=user, session_key=None).session_key


def generate_assistant_response(user, message: str, session_key: str | None = None) -> AssistantResult:
    normalized_message = _normalize_message(message)

    # Fetch history if session_key is provided
    history = None
    if session_key:
        _, history = list_chat_history(user=user, session_key=session_key, limit=10)

    if not normalized_message:
        products = (
            get_personalized_recommendations_for_user(user, limit=4)
            if _is_authenticated_user(user)
            else _fallback_products(limit=4)
        )
        guest_hint = " log in anytime for your order history and personalized picks." if not _is_authenticated_user(user) else ""
        prefix = _user_prefix(user)
        reply = f"{prefix}what are you looking for today?{guest_hint}"
        return _result_with_enhancement("GENERAL", normalized_message, products, reply, user, history=history)

    if _is_small_talk(normalized_message):
        prefix = _user_prefix(user)
        reply = _pick_variant(
            [
                f"{prefix}hey! what can i help you find?",
                f"{prefix}what's up? tell me what you're looking for.",
                f"{prefix}hi there. what do you need today?",
            ],
            normalized_message,
        )
        products = _recommend_products_for_message(user, normalized_message)
        return _result_with_enhancement("GENERAL", normalized_message, products, reply, user, history=history)

    if _is_help_query(normalized_message):
        reply = (
            "i can help with product search, budget picks, stock checks, and order tracking. what do you need?"
        )
        products = _fallback_products(limit=4)
        return _result_with_enhancement("HELP", normalized_message, products, reply, user, history=history)

    intent = _detect_intent(normalized_message)
    budget_cap = _extract_budget_cap(normalized_message)

    if intent == "TOP_SELLING":
        products = _apply_budget_filter(_top_selling_products(limit=8), budget_cap, limit=6)
        reply = "here are the bestsellers right now."
        if budget_cap is not None:
            reply += f" all under {budget_cap} in your local currency."
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent == "ORDER_HELP":
        if not _is_authenticated_user(user):
            guest_reply = "you'd need to log in to see your orders. that keeps your info safe and lets me pull up shipping details fast."
            products = _fallback_products(limit=4)
            return _result_with_enhancement(intent, normalized_message, products, guest_reply, user, history=history)

        latest_order = (
            Order.objects.filter(user=user)
            .only("id", "status", "updated_at")
            .order_by("-updated_at")
            .first()
        )

        if latest_order:
            reply = (
                f"your latest order #{latest_order.id} is {latest_order.status.lower()}. want suggestions while you wait?"
            )
        else:
            reply = "no orders yet. let me help you find something great to start with."

        products = get_personalized_recommendations_for_user(user, limit=4)
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent == "PRICE_STOCK_LOOKUP":
        # Broaden search to give more context to LLM
        products = _apply_budget_filter(semantic_product_search(normalized_message, limit=12), budget_cap, limit=8)
        products = _filter_relevant_products(products, normalized_message, limit=5)
        reply = _build_price_stock_reply(products)
        if not products:
            products = (
                get_personalized_recommendations_for_user(user, limit=4)
                if _is_authenticated_user(user)
                else _fallback_products(limit=4)
            )
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent == "FIT_HELP":
        products = _apply_budget_filter(_recommend_products_for_message(user, normalized_message), budget_cap, limit=8)
        products = _filter_relevant_products(products, normalized_message, limit=4)
        reply = "Finding the perfect fit is key! I recommend checking our detailed size guides on the product pages. "
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent in {"BUDGET_SEARCH", "RECOMMENDATION"}:
        products = _apply_budget_filter(_recommend_products_for_message(user, normalized_message), budget_cap, limit=10)
        products = _filter_relevant_products(products, normalized_message, limit=5)
        if products:
            reply = "found some solid matches for you."
            if budget_cap is not None:
                reply += f" all within {budget_cap} in your local currency."
        else:
            reply = (
                "couldn't find exact matches on that. try a different term or be more specific?"
            )
            products = _fallback_products(limit=4)
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    # General catch-all: proactive product search
    products = _recommend_products_for_message(user, normalized_message)
    guest_hint = " (logged in members get tailored picks.)" if not _is_authenticated_user(user) else ""
    reply = f"help me narrow that down. what's your budget or style?{guest_hint}"
    if not products:
        reply = "nothing on that one. try a different search term?"
    return _result_with_enhancement("GENERAL", normalized_message, products, reply, user, history=history)


def build_notification_insights(user) -> list[dict]:
    insights: list[dict] = []

    pending_orders = Order.objects.filter(user=user, status__in=[Order.Status.PENDING, Order.Status.PROCESSING]).count()
    if pending_orders > 0:
        insights.append(
            {
                "term": "AI Assistant",
                "message": f"You have {pending_orders} active order(s). Ask assistant for quick status help.",
                "tone": "info",
                "sectionKey": "ai_assistant:orders",
            }
        )

    cart_items = CartItem.objects.filter(cart__user=user).select_related("product")[:3]
    if cart_items:
        names = ", ".join(item.product.name for item in cart_items)
        insights.append(
            {
                "term": "AI Assistant",
                "message": f"Cart reminder: {names}. Ask for similar picks or alternatives.",
                "tone": "warning",
                "sectionKey": "ai_assistant:cart",
            }
        )

    wishlist_count = WishlistItem.objects.filter(user=user).count()
    if wishlist_count > 0:
        insights.append(
            {
                "term": "AI Assistant",
                "message": f"Wishlist has {wishlist_count} item(s). Ask assistant for best-value choices.",
                "tone": "success",
                "sectionKey": "ai_assistant:wishlist",
            }
        )

    return insights[:3]


def build_assistant_response_payload(user, message: str, request) -> dict:
    session = get_or_create_chat_session(user=user, session_key=request.data.get("session_key"))
    AssistantChatMessage.objects.create(
        session=session,
        role=AssistantChatMessage.Role.USER,
        text=message,
    )

    assistant_result = generate_assistant_response(user=user, message=message, session_key=session.session_key)
    AssistantChatMessage.objects.create(
        session=session,
        role=AssistantChatMessage.Role.ASSISTANT,
        text=assistant_result.reply,
        intent=assistant_result.intent,
    )

    return {
        "reply": assistant_result.reply,
        "intent": assistant_result.intent,
        "session_key": session.session_key,
        "llm_provider": assistant_result.llm_provider,
        "llm_enhanced": assistant_result.llm_enhanced,
        "suggested_products": _serialize_products(assistant_result.products, request=request),
    }
