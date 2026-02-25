import uuid

from django.db import transaction

from orders.models import Order
from products.models import Product
from .models import Payment


@transaction.atomic
def process_payment(order: Order, method: str, success: bool) -> Payment:
    if order.status not in [Order.Status.PENDING, Order.Status.CANCELLED]:
        raise ValueError("Order is not payable in current state")

    status = Payment.Status.SUCCESS if success else Payment.Status.FAILED
    payment = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        method=method,
        status=status,
        transaction_id=f"TXN-{uuid.uuid4().hex[:18]}",
    )

    if success:
        for order_item in order.items.select_related("product").all():
            product = Product.objects.select_for_update().get(pk=order_item.product_id)
            if product.stock < order_item.quantity:
                order.status = Order.Status.CANCELLED
                order.save(update_fields=["status", "updated_at"])
                raise ValueError(f"Insufficient stock for {product.name}")
            product.stock -= order_item.quantity
            product.save(update_fields=["stock", "updated_at"])

        order.status = Order.Status.PAID
        order.save(update_fields=["status", "updated_at"])
    else:
        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status", "updated_at"])

    return payment
