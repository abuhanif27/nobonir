from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from cart.models import CartItem, WishlistItem
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


def _normalize_message(message: str) -> str:
    return " ".join((message or "").strip().split()).lower()


def _detect_intent(normalized_message: str) -> str:
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
    return get_personalized_recommendations_for_user(user, limit=4)


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


def generate_assistant_response(user, message: str) -> AssistantResult:
    normalized_message = _normalize_message(message)
    if not normalized_message:
        return AssistantResult(
            intent="GENERAL",
            reply="Share what you are shopping for, and I will suggest products that match your needs.",
            products=get_personalized_recommendations_for_user(user, limit=4),
        )

    intent = _detect_intent(normalized_message)

    if intent == "ORDER_HELP":
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
        products = semantic_product_search(normalized_message, limit=4)
        reply = _build_price_stock_reply(products)
        if not products:
            products = get_personalized_recommendations_for_user(user, limit=4)
        return AssistantResult(intent=intent, reply=reply, products=products)

    if intent == "FIT_HELP":
        products = _recommend_products_for_message(user, normalized_message)
        return AssistantResult(
            intent=intent,
            reply="For better fit, compare size guides on product pages and check recent reviews before checkout.",
            products=products,
        )

    if intent in {"BUDGET_SEARCH", "RECOMMENDATION"}:
        products = _recommend_products_for_message(user, normalized_message)
        if products:
            reply = "Here are matching products based on your message."
        else:
            reply = "I could not find strong matches right now. Try a more specific query like category, color, or budget."
        return AssistantResult(intent=intent, reply=reply, products=products)

    products = get_personalized_recommendations_for_user(user, limit=4)
    return AssistantResult(
        intent="GENERAL",
        reply="I can help with recommendations, order tracking, and fit guidance. Tell me what you need.",
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
    assistant_result = generate_assistant_response(user=user, message=message)
    return {
        "reply": assistant_result.reply,
        "intent": assistant_result.intent,
        "suggested_products": _serialize_products(assistant_result.products, request=request),
    }
