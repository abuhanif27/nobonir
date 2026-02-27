from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from common.permissions import IsAdminRole, IsCustomerRole
from analytics.services import track_analytics_event
from .models import Coupon, Order
from .serializers import AdminCouponSerializer, AdminOrderSerializer, CheckoutSerializer, CouponValidateSerializer, OrderSerializer
from .services import create_order_from_cart, get_coupon_preview


def build_invoice_lines(order: Order):
	invoice_lines = [
		"Nobonir Invoice",
		f"Invoice Date: {timezone.localtime(timezone.now()).strftime('%b %d, %Y, %I:%M %p')}",
		f"Order ID: #{order.id}",
		f"Order Status: {order.get_status_display()}",
		f"Placed On: {timezone.localtime(order.created_at).strftime('%b %d, %Y, %I:%M %p')}",
		"",
		"Items:",
	]

	for item in order.items.all():
		subtotal = item.unit_price * item.quantity
		invoice_lines.append(
			f"- {item.product_name} | Qty: {item.quantity} | Unit: {item.unit_price} | Subtotal: {subtotal}"
		)

	invoice_lines.extend(
		[
			"",
			f"Subtotal: {order.subtotal_amount}",
			f"Discount: -{order.discount_amount}",
			f"Total: {order.total_amount}",
			f"Coupon: {order.coupon_code or 'None'}",
			"",
			"Shipping Address:",
			order.shipping_address.strip() or "Not provided",
			"",
			"Billing Address:",
			order.billing_address.strip() or "Not provided",
		]
	)

	return invoice_lines


def build_invoice_pdf_response(order: Order):
	response = HttpResponse(content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="invoice-order-{order.id}.pdf"'

	pdf = canvas.Canvas(response, pagesize=A4)
	width, height = A4
	y = height - 48

	def write_line(text: str, size: int = 10, leading: int = 16):
		nonlocal y
		if y < 60:
			pdf.showPage()
			y = height - 48
		pdf.setFont("Helvetica", size)
		pdf.drawString(48, y, text)
		y -= leading

	pdf.setTitle(f"Invoice Order #{order.id}")
	write_line("Nobonir Invoice", size=16, leading=22)
	write_line(f"Invoice Date: {timezone.localtime(timezone.now()).strftime('%b %d, %Y, %I:%M %p')}")
	write_line(f"Order ID: #{order.id}")
	write_line(f"Order Status: {order.get_status_display()}")
	write_line(f"Placed On: {timezone.localtime(order.created_at).strftime('%b %d, %Y, %I:%M %p')}")
	write_line("")
	write_line("Items:", size=12)

	for item in order.items.all():
		subtotal = item.unit_price * item.quantity
		write_line(
			f"- {item.product_name} | Qty: {item.quantity} | Unit: {item.unit_price} | Subtotal: {subtotal}"
		)

	write_line("")
	write_line(f"Subtotal: {order.subtotal_amount}")
	write_line(f"Discount: -{order.discount_amount}")
	write_line(f"Total: {order.total_amount}")
	write_line(f"Coupon: {order.coupon_code or 'None'}")
	write_line("")
	write_line("Shipping Address:", size=12)
	for part in (order.shipping_address.strip() or "Not provided").splitlines() or ["Not provided"]:
		write_line(part)
	write_line("")
	write_line("Billing Address:", size=12)
	for part in (order.billing_address.strip() or "Not provided").splitlines() or ["Not provided"]:
		write_line(part)

	pdf.showPage()
	pdf.save()
	return response


class CheckoutAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = CheckoutSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			order = create_order_from_cart(
				request.user,
				serializer.validated_data["shipping_address"],
				serializer.validated_data.get("billing_address", ""),
				serializer.validated_data.get("coupon_code", ""),
			)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		track_analytics_event(
			event_name="order_created",
			source="backend",
			request=request,
			user=request.user,
			metadata={
				"order_id": order.id,
				"payment_method": serializer.validated_data.get("payment_method", "CARD"),
				"coupon_code": serializer.validated_data.get("coupon_code", ""),
				"total_amount": str(order.total_amount),
			},
		)
		return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CouponValidateAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = CouponValidateSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			preview = get_coupon_preview(request.user, serializer.validated_data["coupon_code"])
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		return Response(preview, status=status.HTTP_200_OK)


class MyOrderListAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request):
		queryset = (
			Order.objects.filter(user=request.user)
			.prefetch_related("items")
			.order_by("-created_at")
		)
		return Response(OrderSerializer(queryset, many=True).data)


class MyOrderInvoiceAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request, order_id: int):
		order = (
			Order.objects.filter(user=request.user, id=order_id)
			.prefetch_related("items")
			.first()
		)
		if not order:
			return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

		response = HttpResponse("\n".join(build_invoice_lines(order)), content_type="text/plain; charset=utf-8")
		response["Content-Disposition"] = f'attachment; filename="invoice-order-{order.id}.txt"'
		return response


class MyOrderInvoicePDFAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request, order_id: int):
		order = (
			Order.objects.filter(user=request.user, id=order_id)
			.prefetch_related("items")
			.first()
		)
		if not order:
			return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
		return build_invoice_pdf_response(order)


class AdminOrderInvoicePDFAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]

	def get(self, request, order_id: int):
		order = Order.objects.filter(id=order_id).prefetch_related("items").first()
		if not order:
			return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
		return build_invoice_pdf_response(order)


class AdminOrderViewSet(viewsets.ModelViewSet):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = Order.objects.select_related("user").prefetch_related("items").all()
	serializer_class = AdminOrderSerializer
	http_method_names = ["get", "patch", "head", "options"]

	def get_queryset(self):
		queryset = self.queryset.order_by("-created_at")
		status_filter = self.request.query_params.get("status", "").strip().upper()
		date_from = self.request.query_params.get("date_from", "").strip()
		date_to = self.request.query_params.get("date_to", "").strip()
		search = self.request.query_params.get("search", "").strip()

		if status_filter and status_filter != "ALL":
			queryset = queryset.filter(status=status_filter)

		parsed_from = parse_date(date_from) if date_from else None
		if parsed_from:
			queryset = queryset.filter(created_at__date__gte=parsed_from)

		parsed_to = parse_date(date_to) if date_to else None
		if parsed_to:
			queryset = queryset.filter(created_at__date__lte=parsed_to)

		if search:
			search_query = (
				Q(user__email__icontains=search)
				| Q(user__first_name__icontains=search)
				| Q(user__last_name__icontains=search)
			)
			if search.isdigit():
				search_query = search_query | Q(id=int(search))
			queryset = queryset.filter(search_query)

		return queryset

	def partial_update(self, request, *args, **kwargs):
		instance = self.get_object()
		next_status = request.data.get("status")
		valid_statuses = {item[0] for item in Order.Status.choices}
		if next_status not in valid_statuses:
			return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
		instance.status = next_status
		instance.save(update_fields=["status", "updated_at"])
		return Response(self.get_serializer(instance).data)


class AdminCouponViewSet(viewsets.ModelViewSet):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = Coupon.objects.all().order_by("-created_at")
	serializer_class = AdminCouponSerializer
	http_method_names = ["get", "post", "patch", "delete", "head", "options"]

	def get_queryset(self):
		queryset = self.queryset
		status_filter = self.request.query_params.get("status", "").strip().lower()
		search = self.request.query_params.get("search", "").strip()

		if status_filter == "active":
			queryset = queryset.filter(is_active=True)
		elif status_filter == "inactive":
			queryset = queryset.filter(is_active=False)

		if search:
			queryset = queryset.filter(code__icontains=search)

		return queryset
