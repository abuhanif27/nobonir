from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from cart.models import Cart
from products.services import attach_cart_reservations_to_order
from .models import Coupon, CouponUsage, Order, OrderItem


def _calculate_cart_subtotal(cart: Cart) -> Decimal:
    subtotal = Decimal("0.00")
    for item in cart.items.select_related("product"):
        subtotal += item.product.price * item.quantity
    return subtotal


def validate_coupon_for_user(user, coupon_code: str):
    normalized = (coupon_code or "").strip().upper()
    if not normalized:
        raise ValueError("Please enter a coupon code.")

    coupon = Coupon.objects.filter(code=normalized, is_active=True).first()
    if not coupon:
        raise ValueError("Invalid coupon code.")

    if coupon.is_expired:
        raise ValueError("This coupon has expired.")

    already_used = CouponUsage.objects.filter(user=user, coupon=coupon).exists()
    if already_used:
        raise ValueError("This coupon has already been used by you.")

    return coupon


def get_coupon_preview(user, coupon_code: str):
    cart, _ = Cart.objects.get_or_create(user=user)
    cart = Cart.objects.select_related("user").prefetch_related("items__product").get(pk=cart.pk)
    if not cart.items.exists():
        raise ValueError("Cart is empty")

    coupon = validate_coupon_for_user(user, coupon_code)
    subtotal = _calculate_cart_subtotal(cart)
    discount = (subtotal * Decimal(coupon.discount_percent) / Decimal("100")).quantize(Decimal("0.01"))
    total = (subtotal - discount).quantize(Decimal("0.01"))

    return {
        "code": coupon.code,
        "discount_percent": coupon.discount_percent,
        "subtotal": subtotal,
        "discount": discount,
        "total": total,
        "expires_at": timezone.localtime(coupon.expires_at).isoformat(),
    }


@transaction.atomic
def create_order_from_cart(user, shipping_address: str, billing_address: str = "", coupon_code: str = "") -> Order:
    cart, _ = Cart.objects.get_or_create(user=user)
    cart = Cart.objects.select_related("user").prefetch_related("items__product").get(pk=cart.pk)
    if not cart.items.exists():
        raise ValueError("Cart is empty")

    coupon = None
    if coupon_code and coupon_code.strip():
        coupon = validate_coupon_for_user(user, coupon_code)

    order = Order.objects.create(
        user=user,
        shipping_address=shipping_address,
        billing_address=billing_address,
        status=Order.Status.PENDING,
    )
    subtotal = Decimal("0.00")

    for item in cart.items.select_related("product"):
        product = item.product
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            unit_price=product.price,
            quantity=item.quantity,
        )
        subtotal += product.price * item.quantity

    discount_amount = Decimal("0.00")
    applied_coupon_code = ""
    if coupon:
        discount_amount = (subtotal * Decimal(coupon.discount_percent) / Decimal("100")).quantize(Decimal("0.01"))
        applied_coupon_code = coupon.code

    total = (subtotal - discount_amount).quantize(Decimal("0.01"))

    order.subtotal_amount = subtotal
    order.discount_amount = discount_amount
    order.coupon_code = applied_coupon_code
    order.total_amount = total
    order.save(update_fields=["subtotal_amount", "discount_amount", "coupon_code", "total_amount"])

    attach_cart_reservations_to_order(cart=cart, order=order)
    cart.items.all().delete()
    return order
