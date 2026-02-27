from decimal import Decimal

from django.db import transaction

from cart.models import Cart
from .models import Order, OrderItem


@transaction.atomic
def create_order_from_cart(user, shipping_address: str, billing_address: str = "") -> Order:
    cart = Cart.objects.select_related("user").prefetch_related("items__product").get(user=user)
    if not cart.items.exists():
        raise ValueError("Cart is empty")

    order = Order.objects.create(
        user=user,
        shipping_address=shipping_address,
        billing_address=billing_address,
        status=Order.Status.PENDING,
    )
    total = Decimal("0.00")

    for item in cart.items.select_related("product"):
        product = item.product
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            unit_price=product.price,
            quantity=item.quantity,
        )
        total += product.price * item.quantity

    order.total_amount = total
    order.save(update_fields=["total_amount"])
    cart.items.all().delete()
    return order
