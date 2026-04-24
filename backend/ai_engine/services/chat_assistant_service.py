from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from time import monotonic
from urllib.parse import quote
from urllib.request import urlopen
from urllib.error import URLError, HTTPError
import re
import sys
from uuid import uuid4
from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone
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


_PROVIDER_COOLDOWN_UNTIL: dict[str, float] = {}
FAST_FALLBACK_INTENTS = {
    "TOP_SELLING",
    "PRICE_STOCK_LOOKUP",
    "ORDER_STATUS_HELP",
}


def _provider_base_timeout(provider: str) -> float:
    fallback = float(getattr(settings, "AI_FREE_LLM_TIMEOUT_SECONDS", 8))
    if provider == "ollama":
        return float(getattr(settings, "AI_OLLAMA_TIMEOUT_SECONDS", min(fallback, 6)))
    if provider == "pollinations":
        return float(getattr(settings, "AI_POLLINATIONS_TIMEOUT_SECONDS", min(fallback, 4)))
    if provider == "huggingface":
        return float(getattr(settings, "AI_HUGGINGFACE_TIMEOUT_SECONDS", min(fallback, 4)))
    return fallback


def _provider_timeout(provider: str, remaining_budget: float) -> float:
    base = max(_provider_base_timeout(provider), 0.5)
    return max(0.5, min(base, remaining_budget))


def _provider_failure_cooldown(provider: str) -> float:
    if provider == "ollama":
        return float(getattr(settings, "AI_OLLAMA_FAILURE_COOLDOWN_SECONDS", 8))
    return float(getattr(settings, "AI_FREE_LLM_FAILURE_COOLDOWN_SECONDS", 45))


def _provider_cooling_down(provider: str) -> bool:
    until = float(_PROVIDER_COOLDOWN_UNTIL.get(provider, 0.0) or 0.0)
    return monotonic() < until


def _mark_provider_failure(provider: str) -> None:
    _PROVIDER_COOLDOWN_UNTIL[provider] = monotonic() + max(0.0, _provider_failure_cooldown(provider))


def _mark_provider_success(provider: str) -> None:
    if provider in _PROVIDER_COOLDOWN_UNTIL:
        _PROVIDER_COOLDOWN_UNTIL.pop(provider, None)


def _pollinations_reply(prompt: str, timeout_override: float | None = None) -> str | None:
    base_url = str(getattr(settings, "AI_FREE_LLM_POLLINATIONS_URL", "https://text.pollinations.ai")).rstrip("/")
    timeout = float(timeout_override if timeout_override is not None else _provider_base_timeout("pollinations"))
    endpoint = f"{base_url}/{quote(prompt)}"

    try:
        with urlopen(endpoint, timeout=timeout) as response:
            if response.status != 200:
                return None
            text = response.read().decode("utf-8", errors="ignore").strip()
            return text or None
    except (URLError, HTTPError, TimeoutError, ValueError):
        return None


def _huggingface_reply(prompt: str, timeout_override: float | None = None) -> str | None:
    url = str(getattr(settings, "AI_FREE_LLM_HUGGINGFACE_URL", "")).strip()
    if not url:
        return None

    timeout = float(timeout_override if timeout_override is not None else _provider_base_timeout("huggingface"))
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


def _ollama_reply(prompt: str, timeout_override: float | None = None) -> str | None:
    """Call local Ollama instance running Phi-3 Mini or similar model."""
    ollama_url = str(getattr(settings, "AI_OLLAMA_API_URL", "http://127.0.0.1:11434")).rstrip("/")
    model = str(getattr(settings, "AI_OLLAMA_MODEL", "phi")).strip().lower()
    timeout = float(timeout_override if timeout_override is not None else _provider_base_timeout("ollama"))

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


def _build_ollama_prompt(intent: str, message: str, products: list[Product], fallback_reply: str, is_authenticated: bool, history: list[dict] | None = None) -> str:
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

    history_text = ""
    if history:
        history_lines = []
        for msg in history[-4:]:
            role = "User" if msg["role"] == "user" else "Assistant"
            history_lines.append(f"{role}: {msg['text']}")
        history_text = "Recent Conversation History:\n" + "\n".join(history_lines) + "\n\n"

    return (
        "You are Nobonir Assistant, a friendly shopping helper.\n"
        f"Intent: {intent}\n"
        f"{history_text}"
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
    "support_email": "admin@nobonir.com",
}


CATEGORY_HINTS: dict[str, list[str]] = {
    "fashion": ["clothes", "clothing", "apparel", "wear", "outfit", "fashion", "dress", "shirt", "shirts", "pants", "jeans", "jacket", "shoes", "bag", "bags"],
    "electronics": ["electronics", "electronic", "phone", "phones", "mobile", "smartphone", "laptop", "computer", "headphone", "headphones", "earbuds", "buds", "camera", "charger", "tech"],
    "home": ["home", "kitchen", "furniture", "lamp", "fan", "cushion", "organizer", "decor", "sofa", "chair", "table"],
    "grocery": ["grocery", "groceries", "food", "rice", "fruit", "fruits", "snack", "snacks", "drink", "drinks", "beverage"],
    "beauty": ["beauty", "cosmetic", "cosmetics", "makeup", "skincare", "skin", "hair", "perfume"],
    "sports": ["sports", "sport", "fitness", "gym", "workout"],
    "books": ["book", "books", "novel", "reading", "stationery"],
}


def _category_hint_terms(normalized_message: str) -> list[str]:
    msg = normalized_message.lower()
    hint_terms: list[str] = []
    for terms in CATEGORY_HINTS.values():
        if any(term in msg for term in terms):
            hint_terms.extend(terms)
    return hint_terms


def _category_hint_names(normalized_message: str) -> list[str]:
    msg = normalized_message.lower()
    matched: list[str] = []
    for category_name, terms in CATEGORY_HINTS.items():
        if any(term in msg for term in terms):
            matched.append(category_name)
    return matched


def _build_catalog_candidates(normalized_message: str, limit: int = 24) -> list[Product]:
    hint_terms = _category_hint_terms(normalized_message)
    expanded_query = normalized_message
    if hint_terms:
        expanded_query = f"{normalized_message} {' '.join(dict.fromkeys(hint_terms))}"

    semantic_results = _filter_real_catalog_products(semantic_product_search(expanded_query, limit=max(12, limit)))

    category_names = _category_hint_names(normalized_message)
    category_results: list[Product] = []
    if category_names:
        category_query = Q()
        for category_name in category_names:
            category_query |= Q(category__name__icontains=category_name) | Q(category__slug__icontains=category_name)

        category_results = list(
            Product.objects.filter(is_active=True, stock__gt=0)
            .select_related("category")
            .prefetch_related("media", "variants__media")
            .filter(category_query)
            .order_by("-updated_at")[: max(8, limit)]
        )

    fallback_results = _fallback_products(limit=max(8, limit))
    return _dedupe_products(semantic_results + category_results + fallback_results, limit=limit)


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


SYSTEM_QUERY_KEYWORDS = {
    "order",
    "checkout",
    "register",
    "signup",
    "sign up",
    "account",
    "login",
    "log in",
    "password",
    "return",
    "refund",
    "exchange",
    "policy",
    "shipping",
    "delivery",
    "track",
    "tracking",
    "payment",
    "cod",
    "bkash",
    "nagad",
    "card",
    "coupon",
    "discount",
    "promo",
    "cancel",
    "contact",
    "support",
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
    now = timezone.now()

    scored: list[tuple[float, int, Product]] = []
    for index, product in enumerate(products):
        category_weight = float(weights.get(int(product.category_id or 0), 0.0))
        score = category_weight * 10.0

        if getattr(product, "created_at", None):
            age_days = max((now - product.created_at).days, 0)
            score += max(0.0, 3.0 - min(age_days, 30) / 10.0)

        available_stock = int(get_available_stock(product))
        if available_stock <= 0:
            score -= 100.0
        elif available_stock <= 2:
            score -= 3.0
        elif available_stock <= 5:
            score -= 1.0

        score += max(0.0, (len(products) - index)) * 0.01
        scored.append((score, -index, product))

    scored.sort(reverse=True)
    return [product for _, _, product in scored]


def _apply_recent_history_boost(products: list[Product], history_terms: set[str]) -> list[Product]:
    if not history_terms:
        return products

    scored: list[tuple[float, int, Product]] = []
    for index, product in enumerate(products):
        text = f"{product.name} {product.category.name} {product.description or ''}".lower()
        matches = float(sum(1 for term in history_terms if term in text))
        scored.append((matches, -index, product))

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
    return _has_word(msg, ["help", "support", "what can you do", "capabilities", "features"])


def _has_word(msg: str, words: list[str]) -> bool:
    return any(re.search(rf"\b{k}\b", msg) for k in words)

def _is_system_query(normalized_message: str) -> bool:
    msg = normalized_message.lower()
    return _has_word(msg, list(SYSTEM_QUERY_KEYWORDS))


def _query_terms(normalized_message: str) -> list[str]:
    terms = re.findall(r"[a-z0-9]+", normalized_message)
    return [term for term in terms if len(term) >= 3 and term not in TERM_STOPWORDS]


def _recent_history_terms(history: list[dict] | None) -> set[str]:
    if not history:
        return set()

    terms: set[str] = set()
    for message in history[-8:]:
        if str(message.get("role") or "") != "user":
            continue
        text = str(message.get("text") or "").lower()
        terms.update(_query_terms(text))
    return terms


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


def _enhance_reply_with_free_llm(
    intent: str,
    message: str,
    products: list[Product],
    fallback_reply: str,
    user,
    history: list[dict] | None = None,
) -> tuple[str, str, bool, list[str]]:
    if not _free_llm_enabled():
        return fallback_reply, "local", False, ["local"]

    if bool(getattr(settings, "AI_FREE_LLM_SKIP_FOR_FAST_INTENTS", True)) and intent in FAST_FALLBACK_INTENTS:
        return fallback_reply, "local", False, []

    budget_seconds = float(getattr(settings, "AI_FREE_LLM_MAX_BUDGET_SECONDS", 4.5))
    started_at = monotonic()

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
        history=history,
    )

    attempts: list[str] = []
    for provider in _configured_provider_chain():
        if _provider_cooling_down(provider):
            continue

        elapsed = monotonic() - started_at
        remaining_budget = budget_seconds - elapsed
        if remaining_budget <= 0:
            break

        timeout_override = _provider_timeout(provider, remaining_budget)
        llm_reply: str | None = None
        if provider == "pollinations":
            llm_reply = _pollinations_reply(prompt, timeout_override=timeout_override)
        elif provider == "huggingface":
            llm_reply = _huggingface_reply(prompt, timeout_override=timeout_override)
        elif provider == "ollama":
            llm_reply = _ollama_reply(ollama_prompt, timeout_override=timeout_override)
        else:
            continue

        attempts.append(provider)
        if llm_reply and len(llm_reply) >= 20:
            _mark_provider_success(provider)
            return llm_reply, provider, True, attempts
        _mark_provider_failure(provider)

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

    # Normalize wording variants like "make order" / "making an order".
    msg = re.sub(r"\bmake(?:\s+an?)?\s+order\b", "place order", msg)
    
    if _has_word(msg, ["top selling", "best selling", "popular", "trending", "best product", "most popular"]):
        return "TOP_SELLING"

    if _has_word(msg, ["login", "log in", "sign in", "sign up", "signup", "register", "create account", "password", "account"]):
        return "LOGIN_HELP"

    if _has_word(msg, ["refund", "return", "exchange"]):
        return "REFUND_HELP"

    if _has_word(msg, ["policy", "policies", "terms", "conditions", "contact", "email", "support"]):
        return "POLICY_HELP"

    if _has_word(msg, ["where is my", "track", "tracking", "delivery status", "shipping status", "package status", "order status"]):
        return "ORDER_STATUS_HELP"

    if _has_word(msg, [
        "how to order",
        "place order",
        "checkout",
        "buy",
        "purchase",
        "add to cart",
        "order product",
        "order now",
        "how do i order",
        "how can i order",
        "how to make an order",
        "make order",
        "making an order",
    ]):
        return "ORDER_HELP"

    if _has_word(msg, ["delivery", "shipping", "package"]):
        return "ORDER_STATUS_HELP"

    if _has_word(msg, ["stock", "available", "availability", "have it", "ready to"]):
        return "PRICE_STOCK_LOOKUP"

    if _has_word(msg, ["budget", "cheap", "under", "price", "cost", "how much", "range", "low price"]):
        return "BUDGET_SEARCH"

    if _has_word(msg, ["size", "fit", "fitting", "wear", "small", "large", "xl", "medium"]):
        return "FIT_HELP"

    if _has_word(msg, ["recommend", "suggest", "find", "looking for", "need", "show me", "help with", "gift"]):
        return "RECOMMENDATION"

    if _has_word(msg, ["clothes", "clothing", "apparel", "wear", "outfit", "fashion", "dress", "shirt", "pants", "jeans", "jacket", "shoes", "bag"]):
        return "RECOMMENDATION"

    return "GENERAL"


def _serialize_products(products: list[Product], user, request) -> list[dict]:
    serialized = ProductSerializer(products, many=True, context={"request": request}).data
    result = []
    product_ids = [int(item.get("id") or 0) for item in serialized if int(item.get("id") or 0) > 0]
    live_products = {
        product.id: product
        for product in Product.objects.filter(id__in=product_ids).select_related("category")
    }
    
    for item in serialized:
        product_id = int(item.get("id") or 0)
        live_product = live_products.get(product_id)
        stock_val = int(get_available_stock(live_product)) if live_product else int(item.get("available_stock") or 0)
        if stock_val <= 0:
            availability_status = "OUT_OF_STOCK"
        elif stock_val <= 5:
            availability_status = "ALMOST_GONE"
        else:
            availability_status = "IN_STOCK"
        
        product_data = {
            "id": int(item.get("id") or 0),
            "name": str(item.get("name") or ""),
            "slug": str(item.get("slug") or ""),
            "price": Decimal(str(item.get("price") or "0")),
            "image": str(item.get("primary_image") or item.get("image_url") or ""),
            "category": str((item.get("category") or {}).get("name") or ""),
            "availability_status": availability_status,
            "available_stock": stock_val,
        }

        result.append(product_data)
    return result


def _recommend_products_for_message(user, normalized_message: str, history: list[dict] | None = None) -> list[Product]:
    # Pull a wider candidate pool, then rerank/diversify.
    semantic_results = _build_catalog_candidates(normalized_message, limit=16)
    history_terms = _recent_history_terms(history)

    if _is_authenticated_user(user):
        personalized = _filter_real_catalog_products(get_personalized_recommendations_for_user(user, limit=12))
        trending = _top_selling_products(limit=10)

        merged = _dedupe_products(semantic_results + personalized + trending, limit=24)
        ranked = _rank_products_with_user_signal(merged, user)
        ranked = _apply_recent_history_boost(ranked, history_terms)
        relevant = _filter_relevant_products(ranked, normalized_message, limit=12)
        diversified = _diversify_by_category(relevant, limit=8, per_category_cap=2)
        if diversified:
            return diversified

        return _diversify_by_category(ranked, limit=8, per_category_cap=2)

    # Guest: emphasize trending items with diversity while still honoring semantic hits.
    trending = _top_selling_products(limit=12)
    merged_guest = _dedupe_products(semantic_results + trending + _fallback_products(limit=10), limit=24)
    merged_guest = _apply_recent_history_boost(merged_guest, history_terms)
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


def _parse_budget_amount(value: str, suffix: str = "") -> Decimal | None:
    try:
        base = Decimal(value.replace(",", ""))
    except Exception:
        return None

    multiplier = {
        "k": Decimal("1000"),
        "m": Decimal("1000000"),
        "b": Decimal("1000000000"),
    }.get((suffix or "").lower()[:1], Decimal("1"))
    return base * multiplier


def _extract_budget_bounds(normalized_message: str) -> tuple[Decimal | None, Decimal | None]:
    range_patterns = [
        re.compile(
            r"(?:between|from)\s*(?:[₦₹$€£]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([kKmMbB]))?\s*(?:and|to|-)\s*(?:[₦₹$€£]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([kKmMbB]))?"
        ),
        re.compile(
            r"(?:[₦₹$€£]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([kKmMbB]))\s*[-–]\s*(?:[₦₹$€£]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([kKmMbB]))"
        ),
    ]

    for pattern in range_patterns:
        match = pattern.search(normalized_message)
        if not match:
            continue

        left = _parse_budget_amount(match.group(1), match.group(2) or "")
        right = _parse_budget_amount(match.group(3), match.group(4) or "")
        if left is None or right is None:
            continue
        return (left, right) if left <= right else (right, left)

    cap_patterns = [
        re.compile(
            r"(?:under|below|less than|max|within|budget(?:\s+is|\s+of|:)?)\s*(?:[₦₹$€£]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([kKmMbB]))?"
        ),
        re.compile(r"(?:[₦₹$€£]\s*)?(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*([kKmMbB]))\b"),
    ]

    for pattern in cap_patterns:
        match = pattern.search(normalized_message)
        if not match:
            continue
        cap = _parse_budget_amount(match.group(1), match.group(2) or "")
        if cap is not None:
            return None, cap

    return None, None


def _extract_budget_cap(normalized_message: str) -> Decimal | None:
    _, budget_cap = _extract_budget_bounds(normalized_message)
    return budget_cap


def _budget_bounds_in_base_currency(
    budget_min: Decimal | None,
    budget_cap: Decimal | None,
    currency_code: str | None,
    currency_rate: Decimal | None,
) -> tuple[Decimal | None, Decimal | None]:
    """
    Convert user budget from local display currency back to DB/base currency.
    Frontend displays local = base * currency_rate (rates fetched with USD base).
    Therefore base = local / currency_rate.
    """
    normalized_code = str(currency_code or "").upper().strip()
    if not normalized_code or normalized_code == "USD" or currency_rate is None:
        return budget_min, budget_cap

    try:
        if currency_rate <= 0:
            return budget_min, budget_cap
        converted_min = (budget_min / currency_rate) if budget_min is not None else None
        converted_cap = (budget_cap / currency_rate) if budget_cap is not None else None
    except Exception:
        return budget_min, budget_cap

    return converted_min, converted_cap


def _apply_budget_filter(
    products: list[Product],
    budget_cap: Decimal | None,
    limit: int = 4,
    budget_min: Decimal | None = None,
) -> list[Product]:
    if budget_cap is None and budget_min is None:
        return products[:limit]

    filtered = [
        product
        for product in products
        if (budget_min is None or Decimal(product.price) >= budget_min)
        and (budget_cap is None or Decimal(product.price) <= budget_cap)
    ]
    if filtered:
        return filtered[:limit]
    return []


def _budget_friendly_products_for_message(
    user,
    normalized_message: str,
    budget_cap: Decimal,
    budget_min: Decimal | None = None,
    history: list[dict] | None = None,
    limit: int = 8,
) -> list[Product]:
    if budget_cap <= 0 or (budget_min is not None and budget_min > budget_cap):
        return []

    queryset = Product.objects.filter(is_active=True, stock__gt=0, price__lte=budget_cap)
    if budget_min is not None:
        queryset = queryset.filter(price__gte=budget_min)

    candidates = _filter_real_catalog_products(
        list(
            queryset
            .select_related("category")
            .prefetch_related("media", "variants__media")
            .order_by("price", "-updated_at")[:120]
        )
    )
    if not candidates:
        return []

    query_terms = _query_terms(normalized_message)
    history_terms = _recent_history_terms(history)
    category_density: dict[int, int] = defaultdict(int)
    for product in candidates:
        category_density[int(product.category_id or 0)] += 1

    user_weights = _user_category_weights(user)
    scored: list[tuple[float, float, int, Product]] = []
    for index, product in enumerate(candidates):
        price_value = Decimal(product.price)
        budget_span = budget_cap - (budget_min or Decimal("0"))
        cheapness_score = float((budget_cap - price_value) / budget_span) if budget_span > 0 else 0.0
        text = f"{product.name} {product.category.name} {product.description or ''}".lower()
        term_score = float(sum(1 for term in query_terms if term in text))
        density_score = float(category_density[int(product.category_id or 0)])
        user_score = float(user_weights.get(int(product.category_id or 0), 0.0)) if _is_authenticated_user(user) else 0.0

        score = (term_score * 3.0) + (density_score * 0.6) + (cheapness_score * 2.5) + (user_score * 0.2)
        scored.append((score, -float(price_value), -index, product))

    scored.sort(reverse=True)
    ranked = [product for _, _, _, product in scored]
    ranked = _apply_recent_history_boost(ranked, history_terms)
    relevant = _filter_relevant_products(ranked, normalized_message, limit=max(limit, 8))
    diversified = _diversify_by_category(relevant, limit=limit, per_category_cap=2)
    return diversified or ranked[:limit]


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


def _build_support_reply(intent: str) -> str:
    support_email = str(STORE_KNOWLEDGE.get("support_email") or "admin@nobonir.com")
    if intent == "ORDER_HELP":
        return (
            "You can place an order in 4 quick steps: open a product, choose size/variant and quantity, add it to cart, then complete checkout with your payment method. "
            f"If anything fails, contact {support_email}. Do you want a quick checkout checklist?"
        )

    if intent == "ORDER_STATUS_HELP":
        return (
            "For order updates, sign in and open My Orders to see status and timeline. You can also share your order number here and I will guide you. "
            f"If anything looks wrong, contact {support_email}. Want help understanding each status label?"
        )

    if intent == "LOGIN_HELP":
        return (
            "To register, use Sign Up with your name, phone/email, and password. To access your account later, use Sign In. If you forget the password, use Forgot Password on the login page. "
            f"For account help, contact {support_email}. Do you want registration or login steps based on your current screen?"
        )

    if intent == "REFUND_HELP":
        return (
            "We support a 7-day easy return for unused items in original packaging. To start, share your order ID, reason, and product condition with support. "
            f"Contact {support_email} to open the request. Do you want the exact return eligibility checklist?"
        )

    if intent == "POLICY_HELP":
        return (
            "Nobonir supports Cash on Delivery, bKash, Nagad, and major cards. Shipping is usually 2-3 days in Dhaka and 5-7 days outside Dhaka, and returns are available within 7 days for unused items in original packaging. "
            f"For support, contact {support_email}. Which policy do you want in detail: shipping, payment, or returns?"
        )

    return f"For help, contact {support_email}."


def _build_system_help_reply(normalized_message: str, user) -> str:
    msg = normalized_message.lower()
    support_email = str(STORE_KNOWLEDGE.get("support_email") or "admin@nobonir.com")
    shipping_policy = str(STORE_KNOWLEDGE.get("shipping_policy") or "")
    return_policy = str(STORE_KNOWLEDGE.get("return_policy") or "")
    payment_methods = str(STORE_KNOWLEDGE.get("payment_methods") or "")

    if _has_word(msg, ["register", "signup", "sign up", "create account"]):
        return (
            "Open Sign Up, enter your name, phone/email, and password, then submit to create your account. "
            "After registration, sign in to track orders, save wishlist items, and get personalized recommendations. "
            "Do you want me to guide you through each registration field?"
        )

    if _has_word(msg, ["login", "log in", "password", "forgot password", "reset password"]):
        return (
            "Use Sign In with your account credentials. If you forgot your password, use Forgot Password on the login page and follow the reset steps. "
            "Are you trying to recover password or just sign in normally?"
        )

    if _has_word(msg, ["how to order", "place order", "make an order", "checkout", "buy", "purchase", "add to cart"]):
        return (
            "Browse products, open an item, choose options, add to cart, then complete checkout with address and payment confirmation. "
            f"Need live help while ordering? Contact {support_email}. Do you want checkout steps for guest mode or signed-in mode?"
        )

    if _has_word(msg, ["return", "refund", "exchange", "return policy"]):
        return (
            f"{return_policy} To start a return or refund, share your order ID, issue reason, and product condition with support at {support_email}. "
            "Do you want a quick eligibility check before you submit?"
        )

    if _has_word(msg, ["shipping", "delivery", "track", "tracking", "order status"]):
        base = shipping_policy or "Standard shipping is available across Bangladesh."
        if _is_authenticated_user(user):
            return f"{base} You can also check live progress in My Orders. Do you want help interpreting current status (pending, processing, shipped, delivered)?"
        return f"{base} Sign in to view order tracking and status updates. Want the fastest way to track once you sign in?"

    if _has_word(msg, ["payment", "cod", "bkash", "nagad", "card", "coupon", "discount", "promo"]):
        return f"{payment_methods} We occasionally offer promo/coupon codes which you can apply at checkout. Do you want a recommendation on which payment method is best for your case?"

    if _has_word(msg, ["policy", "terms", "conditions", "contact", "support"]):
        return (
            f"Shipping: {shipping_policy} Returns: {return_policy} Payments: {payment_methods} "
            f"For anything specific, contact {support_email}. Which one should I break down first?"
        )

    return (
        "I can help with ordering, account access, shipping, returns, payments, and product suggestions. "
        "Tell me your exact question and I will guide you step by step. What are you trying to do right now?"
    )


def list_chat_history(
    user,
    session_key: str | None = None,
    limit: int = 30,
    before_id: int | None = None,
) -> tuple[str, list[dict], bool, int | None]:
    session = get_or_create_chat_session(user=user, session_key=session_key)

    bounded_limit = max(1, min(int(limit or 30), 100))
    queryset = session.messages.order_by("-id")
    if before_id:
        queryset = queryset.filter(id__lt=before_id)

    rows = list(
        queryset.values("id", "role", "text", "intent", "created_at")[: bounded_limit + 1]
    )
    has_more = len(rows) > bounded_limit
    rows = rows[:bounded_limit]
    next_before_id = int(rows[-1]["id"]) if has_more and rows else None

    rows.reverse()
    return session.session_key, rows, has_more, next_before_id


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


def generate_assistant_response(
    user,
    message: str,
    session_key: str | None = None,
    currency_code: str | None = None,
    currency_rate: Decimal | None = None,
) -> AssistantResult:
    normalized_message = _normalize_message(message)

    # Fetch history if session_key is provided
    history = None
    if session_key:
        _, history, _, _ = list_chat_history(user=user, session_key=session_key, limit=10)

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
        products = _recommend_products_for_message(user, normalized_message, history=history)
        return _result_with_enhancement("GENERAL", normalized_message, products, reply, user, history=history)

    intent = _detect_intent(normalized_message)

    if _is_help_query(normalized_message) and intent == "GENERAL":
        reply = _build_system_help_reply(normalized_message, user)
        products = _fallback_products(limit=4)
        return _result_with_enhancement("HELP", normalized_message, products, reply, user, history=history)

    budget_min, budget_cap = _extract_budget_bounds(normalized_message)
    budget_min, budget_cap = _budget_bounds_in_base_currency(
        budget_min,
        budget_cap,
        currency_code,
        currency_rate,
    )

    def _budget_window_text() -> str:
        if budget_cap is None:
            return ""
        if budget_min is not None:
            return f"{budget_min} to {budget_cap}"
        return f"up to {budget_cap}"

    if intent == "TOP_SELLING":
        products = _apply_budget_filter(
            _top_selling_products(limit=8),
            budget_cap,
            limit=6,
            budget_min=budget_min,
        )
        if budget_cap is not None and not products:
            products = _budget_friendly_products_for_message(
                user,
                normalized_message,
                budget_cap,
                budget_min=budget_min,
                history=history,
                limit=6,
            )
        reply = "here are our top-selling products right now."
        if budget_cap is not None and not products:
            reply = f"i couldn't find products in your budget range ({_budget_window_text()}) right now."
        elif budget_cap is not None:
            if budget_min is not None:
                reply += f" all within {budget_min} to {budget_cap} in your local currency."
            else:
                reply += f" all under {budget_cap} in your local currency."
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent in {"LOGIN_HELP", "REFUND_HELP", "POLICY_HELP"}:
        reply = _build_support_reply(intent)
        products = _fallback_products(limit=3)
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent == "ORDER_HELP":
        reply = _build_support_reply(intent)
        products = _fallback_products(limit=3)
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent == "ORDER_STATUS_HELP":
        if not _is_authenticated_user(user):
            guest_reply = (
                "Please sign in first to view your order status and tracking updates securely. "
                "Once you sign in, open My Orders and I can help you interpret each status."
            )
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
            reply = _build_support_reply(intent)

        products = get_personalized_recommendations_for_user(user, limit=4)
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent == "PRICE_STOCK_LOOKUP":
        # Broaden search to give more context to LLM
        products = _apply_budget_filter(
            semantic_product_search(normalized_message, limit=12),
            budget_cap,
            limit=8,
            budget_min=budget_min,
        )
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
        products = _apply_budget_filter(
            _recommend_products_for_message(user, normalized_message, history=history),
            budget_cap,
            limit=8,
            budget_min=budget_min,
        )
        products = _filter_relevant_products(products, normalized_message, limit=4)
        reply = "Finding the perfect fit is key! I recommend checking our detailed size guides on the product pages. "
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    if intent in {"BUDGET_SEARCH", "RECOMMENDATION"}:
        products = _apply_budget_filter(
            _recommend_products_for_message(user, normalized_message, history=history),
            budget_cap,
            limit=10,
            budget_min=budget_min,
        )
        products = _filter_relevant_products(products, normalized_message, limit=5)
        if budget_cap is not None and not products:
            products = _budget_friendly_products_for_message(
                user,
                normalized_message,
                budget_cap,
                budget_min=budget_min,
                history=history,
                limit=10,
            )
            products = _filter_relevant_products(products, normalized_message, limit=5)
        if products:
            reply = "found some solid matches for you."
            if budget_cap is not None:
                if budget_min is not None:
                    reply += f" all within {budget_min} to {budget_cap} in your local currency."
                else:
                    reply += f" all within {budget_cap} in your local currency."
        else:
            if budget_cap is not None:
                reply = f"i couldn't find products in your budget range ({_budget_window_text()}) right now."
                products = []
            else:
                reply = (
                    "couldn't find exact matches on that. try a different term or be more specific?"
                )
                products = _fallback_products(limit=4)
        return _result_with_enhancement(intent, normalized_message, products, reply, user, history=history)

    # General system questions should not be forced into product-budget fallback text.
    if _is_system_query(normalized_message):
        reply = _build_system_help_reply(normalized_message, user)
        products = _fallback_products(limit=3)
        return _result_with_enhancement("HELP", normalized_message, products, reply, user, history=history)

    # General catch-all: proactive product search
    products = _recommend_products_for_message(user, normalized_message, history=history)
    guest_hint = " (logged in members get tailored picks.)" if not _is_authenticated_user(user) else ""
    reply = _pick_variant(
        [
            f"tell me what you want to buy and your budget, then i can suggest better matches.{guest_hint}",
            f"i can help with better picks if you share category, budget, or preferred brand.{guest_hint}",
            f"share your target price or product type, and i'll narrow this down for you.{guest_hint}",
        ],
        normalized_message,
    )
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

    raw_currency_code = str(request.data.get("currency_code") or "").strip().upper()
    raw_currency_rate = request.data.get("currency_rate")
    parsed_currency_rate: Decimal | None = None
    if raw_currency_rate is not None:
        try:
            parsed_currency_rate = Decimal(str(raw_currency_rate))
        except Exception:
            parsed_currency_rate = None

    normalized_message = _normalize_message(message)
    original_budget_min, original_budget_cap = _extract_budget_bounds(normalized_message)
    budget_min_base, budget_cap_base = _budget_bounds_in_base_currency(
        original_budget_min,
        original_budget_cap,
        raw_currency_code,
        parsed_currency_rate,
    )

    debug_budget_window_base = None
    if budget_min_base is not None or budget_cap_base is not None:
        debug_budget_window_base = {
            "currency": "USD",
            "min": str(budget_min_base) if budget_min_base is not None else None,
            "max": str(budget_cap_base) if budget_cap_base is not None else None,
            "source_currency": raw_currency_code or "USD",
            "source_rate": str(parsed_currency_rate) if parsed_currency_rate is not None else None,
        }

    assistant_result = generate_assistant_response(
        user=user,
        message=message,
        session_key=session.session_key,
        currency_code=raw_currency_code,
        currency_rate=parsed_currency_rate,
    )
    AssistantChatMessage.objects.create(
        session=session,
        role=AssistantChatMessage.Role.ASSISTANT,
        text=assistant_result.reply,
        intent=assistant_result.intent,
    )

    payload = {
        "reply": assistant_result.reply,
        "intent": assistant_result.intent,
        "session_key": session.session_key,
        "llm_provider": assistant_result.llm_provider,
        "llm_enhanced": assistant_result.llm_enhanced,
        "suggested_products": _serialize_products(assistant_result.products, user=user, request=request),
    }

    if debug_budget_window_base is not None:
        payload["debug_budget_window_base"] = debug_budget_window_base

    return payload
