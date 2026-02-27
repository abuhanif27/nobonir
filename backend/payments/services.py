import uuid
import os
from pathlib import Path

import stripe
from django.conf import settings
from django.db import transaction
from dotenv import load_dotenv

from orders.models import Order
from products.models import Product
from .models import Payment


ENV_PATH = Path(__file__).resolve().parents[1].parent / ".env"


def get_live_stripe_secret_key() -> str:
    load_dotenv(ENV_PATH, override=True)
    return (os.getenv("STRIPE_SECRET_KEY") or settings.STRIPE_SECRET_KEY or "").strip()


def get_live_stripe_webhook_secret() -> str:
    load_dotenv(ENV_PATH, override=True)
    return (os.getenv("STRIPE_WEBHOOK_SECRET") or settings.STRIPE_WEBHOOK_SECRET or "").strip()


@transaction.atomic
def process_payment(order: Order, method: str, success: bool, transaction_id: str | None = None) -> Payment:
    if order.status not in [Order.Status.PENDING, Order.Status.CANCELLED]:
        raise ValueError("Order is not payable in current state")

    status = Payment.Status.SUCCESS if success else Payment.Status.FAILED
    payment = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        method=method,
        status=status,
        transaction_id=transaction_id or f"TXN-{uuid.uuid4().hex[:18]}",
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


def create_stripe_checkout_session(order: Order, success_url: str, cancel_url: str):
    stripe_secret_key = get_live_stripe_secret_key()
    if not stripe_secret_key:
        raise ValueError("Stripe is not configured")

    if order.status not in [Order.Status.PENDING, Order.Status.CANCELLED]:
        raise ValueError("Order is not payable in current state")

    stripe.api_key = stripe_secret_key

    line_items = [
        {
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": item.product_name,
                },
                "unit_amount": int(item.unit_price * 100),
            },
            "quantity": item.quantity,
        }
        for item in order.items.all()
    ]

    if not line_items:
        raise ValueError("Order has no items")

    return stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=line_items,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": str(order.id),
            "user_id": str(order.user_id),
        },
    )


@transaction.atomic
def handle_stripe_checkout_completed(session):
    metadata = session.get("metadata") or {}
    order_id = metadata.get("order_id")
    if not order_id:
        raise ValueError("Missing order metadata")

    try:
        parsed_order_id = int(order_id)
    except (TypeError, ValueError):
        raise ValueError("Invalid order metadata")

    order = Order.objects.select_for_update().prefetch_related("items").filter(pk=parsed_order_id).first()
    if not order:
        raise ValueError("Order not found")

    transaction_id = session.get("payment_intent") or session.get("id")
    if Payment.objects.filter(transaction_id=transaction_id).exists():
        return

    if order.status == Order.Status.PAID:
        return

    process_payment(
        order=order,
        method="STRIPE",
        success=True,
        transaction_id=transaction_id,
    )


@transaction.atomic
def handle_stripe_checkout_expired(session):
    metadata = session.get("metadata") or {}
    order_id = metadata.get("order_id")
    if not order_id:
        return

    try:
        parsed_order_id = int(order_id)
    except (TypeError, ValueError):
        return

    order = Order.objects.select_for_update().filter(pk=parsed_order_id).first()
    if not order or order.status not in [Order.Status.PENDING, Order.Status.CANCELLED]:
        return

    transaction_id = f"STRIPE-EXPIRED-{session.get('id')}"
    if Payment.objects.filter(transaction_id=transaction_id).exists():
        return

    process_payment(
        order=order,
        method="STRIPE",
        success=False,
        transaction_id=transaction_id,
    )


@transaction.atomic
def create_cod_payment(order: Order) -> Payment:
    if order.status not in [Order.Status.PENDING, Order.Status.CANCELLED]:
        raise ValueError("Order is not payable in current state")

    transaction_id = f"COD-{uuid.uuid4().hex[:18]}"
    payment = Payment.objects.create(
        order=order,
        amount=order.total_amount,
        method="COD",
        status=Payment.Status.PENDING,
        transaction_id=transaction_id,
    )
    return payment
