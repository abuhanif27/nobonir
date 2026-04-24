import stripe
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCustomerRole
from orders.models import Order
from .serializers import PaymentSerializer, PaymentSimulationSerializer, StripeCheckoutSessionSerializer
from .services import (
	create_cod_payment,
	create_stripe_checkout_session,
	get_live_stripe_secret_key,
	get_live_stripe_webhook_secret,
	handle_stripe_checkout_completed,
	handle_stripe_checkout_expired,
	process_payment,
)


class PaymentSimulationAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = PaymentSimulationSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		order = get_object_or_404(Order, pk=serializer.validated_data["order_id"], user=request.user)
		try:
			payment = process_payment(
				order=order,
				method=serializer.validated_data["method"],
				success=serializer.validated_data["success"],
			)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class StripeCheckoutSessionAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = StripeCheckoutSessionSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		order = get_object_or_404(
			Order.objects.prefetch_related("items"),
			pk=serializer.validated_data["order_id"],
			user=request.user,
		)

		frontend_base = settings.FRONTEND_BASE_URL.rstrip("/")
		success_url = f"{frontend_base}/orders?payment=success"
		cancel_url = f"{frontend_base}/cart?payment=cancelled&order_id={order.id}"

		try:
			session = create_stripe_checkout_session(
				order=order,
				success_url=success_url,
				cancel_url=cancel_url,
			)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		except Exception as exc:
			return Response({"detail": f"Payment service error: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)

		return Response({"checkout_url": session.url}, status=status.HTTP_201_CREATED)


class StripeWebhookAPIView(APIView):
	permission_classes = [permissions.AllowAny]
	authentication_classes = []

	def post(self, request):
		stripe_secret_key = get_live_stripe_secret_key()
		webhook_secret = get_live_stripe_webhook_secret()

		if not stripe_secret_key or not webhook_secret:
			return Response({"detail": "Stripe webhook is not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

		payload = request.body
		signature = request.META.get("HTTP_STRIPE_SIGNATURE")

		if not signature:
			return Response({"detail": "Missing stripe signature"}, status=status.HTTP_400_BAD_REQUEST)

		stripe.api_key = stripe_secret_key

		try:
			event = stripe.Webhook.construct_event(
				payload=payload,
				sig_header=signature,
				secret=webhook_secret,
			)
		except (ValueError, stripe.error.SignatureVerificationError):
			return Response({"detail": "Invalid webhook payload"}, status=status.HTTP_400_BAD_REQUEST)

		event_type = event.get("type")
		event_data = event.get("data", {}).get("object", {})

		try:
			if event_type == "checkout.session.completed":
				handle_stripe_checkout_completed(event_data)
			elif event_type in {"checkout.session.expired", "checkout.session.async_payment_failed"}:
				handle_stripe_checkout_expired(event_data)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

		return Response({"received": True})


class CODPaymentAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = StripeCheckoutSessionSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		order = get_object_or_404(
			Order,
			pk=serializer.validated_data["order_id"],
			user=request.user,
		)

		try:
			payment = create_cod_payment(order)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

		return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class StripeCancelPaymentAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = StripeCheckoutSessionSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		order = get_object_or_404(
			Order,
			pk=serializer.validated_data["order_id"],
			user=request.user,
		)

		if order.status == Order.Status.PAID:
			return Response({"detail": "Order already paid."}, status=status.HTTP_400_BAD_REQUEST)

		if order.status == Order.Status.CANCELLED:
			return Response({"detail": "Order already cancelled."}, status=status.HTTP_200_OK)

		try:
			payment = process_payment(
				order=order,
				method="STRIPE",
				success=False,
				transaction_id=f"STRIPE-CANCEL-{order.id}",
			)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

		return Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)
