from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import re
from uuid import uuid4
from django.db.models import Q, Sum

from cart.models import CartItem, WishlistItem
from ai_engine.models import AssistantChatMessage, AssistantChatSession
from orders.models import Order
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


def _safe_session_key(candidate: str | None) -> str:
    normalized = (candidate or "").strip()
    if not normalized:
        return str(uuid4())
    return normalized[:80]


def _is_authenticated_user(user) -> bool:
    return bool(getattr(user, "is_authenticated", False))


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
        .select_related("category")
        .order_by("-updated_at")[:limit]
    )


def _normalize_message(message: str) -> str:
    return " ".join((message or "").strip().split()).lower()


def _detect_intent(normalized_message: str) -> str:
    if any(
        keyword in normalized_message
        for keyword in [
            "top selling",
            "best selling",
            "most sold",
            "popular",
            "trending",
            "best product",
        ]
    ):
        return "TOP_SELLING"

    if any(keyword in normalized_message for keyword in ["order", "delivery", "shipping", "status", "track"]):
        return "ORDER_HELP"

    if any(keyword in normalized_message for keyword in ["stock", "available", "availability", "price", "cost"]):
        return "PRICE_STOCK_LOOKUP"

    if any(keyword in normalized_message for keyword in ["budget", "cheap", "under", "price", "cost"]):
        return "BUDGET_SEARCH"

    if any(keyword in normalized_message for keyword in ["size", "fit", "fitting", "wear"]):
        return "FIT_HELP"

    if any(keyword in normalized_message for keyword in ["recommend", "suggest", "best", "find", "looking for", "need"]):
        return "RECOMMENDATION"

    return "GENERAL"


def _serialize_products(products: list[Product], request) -> list[dict]:
    serialized = ProductSerializer(products, many=True, context={"request": request}).data
    result = []
    for item in serialized:
        result.append(
            {
                "id": int(item.get("id") or 0),
                "name": str(item.get("name") or ""),
                "slug": str(item.get("slug") or ""),
                "price": Decimal(str(item.get("price") or "0")),
                "image": str(item.get("primary_image") or item.get("image_url") or ""),
                "category": str((item.get("category") or {}).get("name") or ""),
                "availability_status": str(item.get("availability_status") or "IN_STOCK"),
                "available_stock": int(item.get("available_stock") or 0),
            }
        )
    return result


def _recommend_products_for_message(user, normalized_message: str) -> list[Product]:
    search_results = semantic_product_search(normalized_message, limit=4)
    if search_results:
        return search_results
    if _is_authenticated_user(user):
        return get_personalized_recommendations_for_user(user, limit=4)
    return _fallback_products(limit=4)


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

    products = [item for item in queryset[: max(1, min(limit, 12))] if int(get_available_stock(item)) > 0]
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
        lines.append(f"- {product.name}: ৳{product.price} ({stock_label})")
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


def generate_assistant_response(user, message: str) -> AssistantResult:
    normalized_message = _normalize_message(message)
    if not normalized_message:
        products = (
            get_personalized_recommendations_for_user(user, limit=4)
            if _is_authenticated_user(user)
            else _fallback_products(limit=4)
        )
        guest_hint = " Sign in for personalized picks and order support." if not _is_authenticated_user(user) else ""
        return AssistantResult(
            intent="GENERAL",
            reply=f"Share what you are shopping for, and I will suggest products that match your needs.{guest_hint}",
            products=products,
        )

    intent = _detect_intent(normalized_message)
    budget_cap = _extract_budget_cap(normalized_message)

    if intent == "TOP_SELLING":
        products = _apply_budget_filter(_top_selling_products(limit=6), budget_cap, limit=4)
        reply = "These are currently top-selling products based on recent paid orders."
        if budget_cap is not None:
            reply += f" Filtered to budget under ৳{budget_cap}."
        return AssistantResult(intent=intent, reply=reply, products=products)

    if intent == "ORDER_HELP":
        if not _is_authenticated_user(user):
            return AssistantResult(
                intent=intent,
                reply="Order tracking needs sign-in so I can securely access your account orders.",
                products=_fallback_products(limit=4),
            )

        latest_order = (
            Order.objects.filter(user=user)
            .only("id", "status", "updated_at")
            .order_by("-updated_at")
            .first()
        )

        if latest_order:
            reply = (
                f"Your latest order #{latest_order.id} is currently {latest_order.status}. "
                "I also included a few recommendations while you wait."
            )
        else:
            reply = "I could not find an order yet. I added some recommendations to help you get started."

        products = get_personalized_recommendations_for_user(user, limit=4)
        return AssistantResult(intent=intent, reply=reply, products=products)

    if intent == "PRICE_STOCK_LOOKUP":
        products = _apply_budget_filter(semantic_product_search(normalized_message, limit=6), budget_cap, limit=4)
        reply = _build_price_stock_reply(products)
        if not products:
            products = (
                get_personalized_recommendations_for_user(user, limit=4)
                if _is_authenticated_user(user)
                else _fallback_products(limit=4)
            )
        return AssistantResult(intent=intent, reply=reply, products=products)

    if intent == "FIT_HELP":
        products = _apply_budget_filter(_recommend_products_for_message(user, normalized_message), budget_cap, limit=4)
        return AssistantResult(
            intent=intent,
            reply="For better fit, compare size guides on product pages and check recent reviews before checkout.",
            products=products,
        )

    if intent in {"BUDGET_SEARCH", "RECOMMENDATION"}:
        products = _apply_budget_filter(_recommend_products_for_message(user, normalized_message), budget_cap, limit=4)
        if products:
            reply = "Here are matching products based on your message and shopping intent."
            if budget_cap is not None:
                reply += f" I applied your budget limit under ৳{budget_cap}."
        else:
            reply = "I could not find strong matches right now. Try a more specific query like category, color, or budget."
        return AssistantResult(intent=intent, reply=reply, products=products)

    products = (
        get_personalized_recommendations_for_user(user, limit=4)
        if _is_authenticated_user(user)
        else _fallback_products(limit=4)
    )
    guest_hint = " Sign in to unlock personalized recommendations and order help." if not _is_authenticated_user(user) else ""
    return AssistantResult(
        intent="GENERAL",
        reply=f"I can help with recommendations, order tracking, and fit guidance. Tell me what you need.{guest_hint}",
        products=products,
    )


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

    assistant_result = generate_assistant_response(user=user, message=message)
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
        "suggested_products": _serialize_products(assistant_result.products, request=request),
    }
