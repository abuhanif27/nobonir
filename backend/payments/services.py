import uuid
import os
from pathlib import Path
from decimal import Decimal

import stripe
from django.conf import settings
from django.db import transaction
from dotenv import load_dotenv

from orders.models import Order
from orders.models import Coupon, CouponUsage
from products.models import InventoryMovement
from products.services import adjust_product_stock
from products.services import consume_order_reservations, release_order_reservations
from analytics.services import track_analytics_event
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
        consume_order_reservations(order)

        if order.coupon_code:
            coupon = Coupon.objects.select_for_update().filter(code=order.coupon_code, is_active=True).first()
            if not coupon:
                raise ValueError("Applied coupon is no longer valid")

            already_used = CouponUsage.objects.filter(user=order.user, coupon=coupon).exclude(order=order).exists()
            if already_used:
                raise ValueError("This coupon has already been used by you")

            CouponUsage.objects.get_or_create(user=order.user, coupon=coupon, order=order)

        for order_item in order.items.select_related("product").all():
            try:
                adjust_product_stock(
                    product_id=order_item.product_id,
                    quantity_delta=-int(order_item.quantity),
                    movement_type=InventoryMovement.MovementType.SALE,
                    reference_type="ORDER",
                    reference_id=str(order.id),
                    note="Stock deducted after successful payment",
                )
            except ValueError as exc:
                order.status = Order.Status.CANCELLED
                order.save(update_fields=["status", "updated_at"])
                raise ValueError(str(exc)) from exc

        order.status = Order.Status.PAID
        order.save(update_fields=["status", "updated_at"])

        track_analytics_event(
            event_name="payment_success",
            source="backend",
            user=order.user,
            metadata={
                "order_id": order.id,
                "payment_method": method,
                "payment_id": payment.id,
                "amount": str(payment.amount),
                "transaction_id": payment.transaction_id,
            },
        )
    else:
        release_order_reservations(order)
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

    order_items = list(order.items.all())
    if not order_items:
        raise ValueError("Order has no items")

    amount_cents = int((order.total_amount * Decimal("100")).quantize(Decimal("1")))
    if amount_cents <= 0:
        raise ValueError("Order total must be greater than zero")

    line_items = [
        {
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": f"Order #{order.id}",
                    "description": f"{len(order_items)} item(s)" + (f" • Coupon: {order.coupon_code}" if order.coupon_code else ""),
                },
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }
    ]

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
    if not order or order.status != Order.Status.PENDING:
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
