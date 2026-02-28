from datetime import timedelta

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from .models import InventoryMovement, Product, ProductVariant, StockNotificationSubscription, StockReservation


RESERVATION_TTL_MINUTES = 20


def cleanup_expired_reservations():
    now = timezone.now()
    return StockReservation.objects.filter(
        status=StockReservation.Status.ACTIVE,
        expires_at__lt=now,
    ).update(status=StockReservation.Status.EXPIRED, updated_at=now)


def get_reserved_quantity(
    product_id: int,
    exclude_cart_id: int | None = None,
    variant_id: int | None = None,
    include_all_variants: bool = False,
) -> int:
    cleanup_expired_reservations()
    queryset = StockReservation.objects.filter(
        product_id=product_id,
        status=StockReservation.Status.ACTIVE,
        expires_at__gte=timezone.now(),
    )
    if variant_id is not None:
        queryset = queryset.filter(variant_id=variant_id)
    elif not include_all_variants:
        queryset = queryset.filter(variant__isnull=True)

    if exclude_cart_id:
        queryset = queryset.exclude(cart_id=exclude_cart_id)

    total = queryset.aggregate(total_reserved=Sum("quantity")).get("total_reserved")
    return int(total or 0)


def get_available_stock(product: Product, exclude_cart_id: int | None = None) -> int:
    reserved = get_reserved_quantity(
        product.id,
        exclude_cart_id=exclude_cart_id,
        include_all_variants=True,
    )
    return max(int(product.stock) - reserved, 0)


def get_available_variant_stock(variant: ProductVariant, exclude_cart_id: int | None = None) -> int:
    if variant.stock_override is None:
        return max(int(variant.product.stock), 0)

    reserved = get_reserved_quantity(
        variant.product_id,
        exclude_cart_id=exclude_cart_id,
        variant_id=variant.id,
    )
    return max(int(variant.stock_override) - reserved, 0)


def _create_inventory_movement(
    *,
    product: Product,
    movement_type: str,
    quantity_delta: int,
    quantity_before: int,
    quantity_after: int,
    reference_type: str = "",
    reference_id: str = "",
    note: str = "",
):
    InventoryMovement.objects.create(
        product=product,
        movement_type=movement_type,
        quantity_delta=quantity_delta,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
    )


def _notify_back_in_stock(product: Product):
    now = timezone.now()
    StockNotificationSubscription.objects.filter(
        product=product,
        is_active=True,
        notified_at__isnull=True,
    ).update(notified_at=now, updated_at=now)


@transaction.atomic
def adjust_product_stock(
    *,
    product_id: int,
    quantity_delta: int,
    movement_type: str,
    reference_type: str = "",
    reference_id: str = "",
    note: str = "",
) -> Product:
    product = Product.objects.select_for_update().get(pk=product_id)
    before = int(product.stock)
    after = before + int(quantity_delta)
    if after < 0:
        raise ValueError(f"Insufficient stock for {product.name}")

    now = timezone.now()
    update_fields = ["stock", "updated_at", "last_stock_movement_at"]
    product.stock = after
    product.last_stock_movement_at = now

    if before == 0 and after > 0:
        product.last_restocked_at = now
        update_fields.append("last_restocked_at")
        if not product.is_active:
            product.is_active = True
            update_fields.append("is_active")
        _notify_back_in_stock(product)

    if after == 0 and before > 0:
        product.last_out_of_stock_at = now
        update_fields.append("last_out_of_stock_at")

    if quantity_delta > 0 and before > 0:
        product.last_restocked_at = now
        if "last_restocked_at" not in update_fields:
            update_fields.append("last_restocked_at")

    product.save(update_fields=update_fields)

    _create_inventory_movement(
        product=product,
        movement_type=movement_type,
        quantity_delta=int(quantity_delta),
        quantity_before=before,
        quantity_after=after,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
    )

    return product


@transaction.atomic
def set_product_stock(
    *,
    product_id: int,
    new_stock: int,
    reference_type: str = "ADMIN",
    reference_id: str = "",
    note: str = "",
) -> Product:
    product = Product.objects.select_for_update().get(pk=product_id)
    before = int(product.stock)
    normalized_stock = max(int(new_stock), 0)
    delta = normalized_stock - before
    if delta == 0:
        return product

    movement_type = (
        InventoryMovement.MovementType.RESTOCK
        if delta > 0
        else InventoryMovement.MovementType.ADJUSTMENT
    )
    return adjust_product_stock(
        product_id=product.id,
        quantity_delta=delta,
        movement_type=movement_type,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
    )


@transaction.atomic
def reserve_stock(
    *,
    cart,
    product: Product,
    quantity: int,
    variant: ProductVariant | None = None,
) -> StockReservation | None:
    cleanup_expired_reservations()
    normalized_quantity = max(int(quantity), 0)

    reservation = StockReservation.objects.select_for_update().filter(
        cart=cart,
        product=product,
        variant=variant,
        status=StockReservation.Status.ACTIVE,
        order__isnull=True,
    ).first()

    if normalized_quantity == 0:
        if reservation:
            reservation.status = StockReservation.Status.RELEASED
            reservation.save(update_fields=["status", "updated_at"])
        return None

    if variant and variant.stock_override is not None:
        available = get_available_variant_stock(variant, exclude_cart_id=cart.id)
    else:
        available = get_available_stock(product, exclude_cart_id=cart.id)
    if normalized_quantity > available:
        target_name = product.name
        if variant:
            label_parts = [piece for piece in [variant.color, variant.size] if piece]
            if label_parts:
                target_name = f"{product.name} ({' / '.join(label_parts)})"
        raise ValueError(f"Only {available} units available for reservation for {target_name}.")

    expires_at = timezone.now() + timedelta(minutes=RESERVATION_TTL_MINUTES)
    if reservation:
        reservation.quantity = normalized_quantity
        reservation.expires_at = expires_at
        reservation.save(update_fields=["quantity", "expires_at", "updated_at"])
        return reservation

    return StockReservation.objects.create(
        product=product,
        variant=variant,
        cart=cart,
        quantity=normalized_quantity,
        status=StockReservation.Status.ACTIVE,
        expires_at=expires_at,
    )


@transaction.atomic
def release_cart_reservations(cart):
    cleanup_expired_reservations()
    StockReservation.objects.filter(
        cart=cart,
        status=StockReservation.Status.ACTIVE,
        order__isnull=True,
    ).update(status=StockReservation.Status.RELEASED, updated_at=timezone.now())


@transaction.atomic
def consume_cart_reservations(cart):
    cleanup_expired_reservations()
    StockReservation.objects.filter(
        cart=cart,
        status=StockReservation.Status.ACTIVE,
        order__isnull=True,
    ).update(status=StockReservation.Status.CONSUMED, updated_at=timezone.now())


@transaction.atomic
def attach_cart_reservations_to_order(*, cart, order):
    cleanup_expired_reservations()
    now = timezone.now()
    return StockReservation.objects.filter(
        cart=cart,
        status=StockReservation.Status.ACTIVE,
        order__isnull=True,
    ).update(order=order, updated_at=now)


@transaction.atomic
def release_order_reservations(order):
    cleanup_expired_reservations()
    return StockReservation.objects.filter(
        order=order,
        status=StockReservation.Status.ACTIVE,
    ).update(status=StockReservation.Status.RELEASED, updated_at=timezone.now())


@transaction.atomic
def consume_order_reservations(order):
    cleanup_expired_reservations()
    return StockReservation.objects.filter(
        order=order,
        status=StockReservation.Status.ACTIVE,
    ).update(status=StockReservation.Status.CONSUMED, updated_at=timezone.now())


def subscribe_back_in_stock(*, product: Product, channel: str, contact_value: str, user=None):
    cleaned_contact = (contact_value or "").strip()
    if not cleaned_contact:
        raise ValueError("Contact value is required.")

    normalized_channel = (channel or "").strip().upper()
    if normalized_channel not in {
        StockNotificationSubscription.Channel.EMAIL,
        StockNotificationSubscription.Channel.WHATSAPP,
    }:
        raise ValueError("Channel must be EMAIL or WHATSAPP.")

    subscription, created = StockNotificationSubscription.objects.get_or_create(
        product=product,
        channel=normalized_channel,
        contact_value=cleaned_contact,
        defaults={"user": user, "is_active": True},
    )

    if not created:
        subscription.user = user or subscription.user
        subscription.is_active = True
        subscription.notified_at = None
        subscription.save(update_fields=["user", "is_active", "notified_at", "updated_at"])

    return subscription
