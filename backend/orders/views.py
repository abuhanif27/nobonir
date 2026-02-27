from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from decimal import Decimal, ROUND_HALF_UP
from ipaddress import ip_address
from pathlib import Path
from django.db.models import Q
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

from common.permissions import IsAdminRole, IsCustomerRole
from analytics.services import track_analytics_event
from .models import Coupon, Order
from .serializers import AdminCouponSerializer, AdminOrderSerializer, CheckoutSerializer, CouponValidateSerializer, OrderSerializer
from .services import create_order_from_cart, get_coupon_preview


CURRENCY_BY_COUNTRY = {
	"BD": "BDT",
	"IN": "INR",
	"PK": "PKR",
	"NP": "NPR",
	"LK": "LKR",
	"US": "USD",
	"CA": "CAD",
	"GB": "GBP",
	"AU": "AUD",
	"NZ": "NZD",
	"SG": "SGD",
	"MY": "MYR",
	"AE": "AED",
	"SA": "SAR",
	"QA": "QAR",
	"KW": "KWD",
	"EU": "EUR",
	"FR": "EUR",
	"DE": "EUR",
	"IT": "EUR",
	"ES": "EUR",
	"NL": "EUR",
	"BE": "EUR",
	"SE": "SEK",
	"NO": "NOK",
	"DK": "DKK",
	"CH": "CHF",
	"JP": "JPY",
	"KR": "KRW",
	"CN": "CNY",
	"HK": "HKD",
	"TH": "THB",
	"VN": "VND",
	"BR": "BRL",
	"MX": "MXN",
	"ZA": "ZAR",
}

CURRENCY_SYMBOLS = {
	"BDT": "৳",
	"INR": "₹",
	"PKR": "₨",
	"NPR": "₨",
	"LKR": "Rs",
	"USD": "$",
	"CAD": "C$",
	"GBP": "£",
	"AUD": "A$",
	"NZD": "NZ$",
	"SGD": "S$",
	"MYR": "RM",
	"AED": "AED",
	"SAR": "SAR",
	"QAR": "QAR",
	"KWD": "KWD",
	"EUR": "€",
	"SEK": "kr",
	"NOK": "kr",
	"DKK": "kr",
	"CHF": "CHF",
	"JPY": "¥",
	"KRW": "₩",
	"CNY": "¥",
	"HKD": "HK$",
	"THB": "฿",
	"VND": "₫",
	"BRL": "R$",
	"MXN": "MX$",
	"ZAR": "R",
}


def get_client_ip(request):
	forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
	if forwarded:
		first = forwarded.split(",")[0].strip()
		if first:
			return first

	for key in ["HTTP_X_REAL_IP", "HTTP_CF_CONNECTING_IP", "REMOTE_ADDR"]:
		value = (request.META.get(key) or "").strip()
		if value:
			return value

	return ""


def infer_country_code(request, client_ip: str):
	for key in [
		"HTTP_CF_IPCOUNTRY",
		"HTTP_X_COUNTRY_CODE",
		"HTTP_X_APPENGINE_COUNTRY",
		"GEOIP_COUNTRY_CODE",
	]:
		raw = (request.META.get(key) or "").strip().upper()
		if len(raw) == 2 and raw.isalpha():
			return raw

	accept_language = (request.META.get("HTTP_ACCEPT_LANGUAGE") or "").strip()
	if accept_language:
		primary = accept_language.split(",")[0].strip()
		if "-" in primary:
			region = primary.split("-")[-1].upper()
			if len(region) == 2 and region.isalpha():
				return region

	if client_ip:
		try:
			parsed = ip_address(client_ip)
			if parsed.is_private or parsed.is_loopback:
				return "BD"
		except ValueError:
			pass

	return "US"


def money_string(amount, currency_code: str):
	value = Decimal(amount)
	decimals = 0 if currency_code in {"JPY", "KRW", "VND"} else 2
	quant = Decimal("1") if decimals == 0 else Decimal("0.01")
	rounded = value.quantize(quant, rounding=ROUND_HALF_UP)
	symbol = CURRENCY_SYMBOLS.get(currency_code, currency_code)

	if decimals == 0:
		formatted = f"{rounded:,.0f}"
	else:
		formatted = f"{rounded:,.2f}"

	if symbol == currency_code:
		return f"{formatted} {currency_code}"
	return f"{symbol}{formatted}"


def build_invoice_context(request):
	client_ip = get_client_ip(request)
	country_code = infer_country_code(request, client_ip)
	currency_code = CURRENCY_BY_COUNTRY.get(country_code, "USD")
	region = "Local" if country_code == "BD" and (client_ip.startswith("127.") or client_ip.startswith("10.") or client_ip.startswith("192.168.")) else country_code

	return {
		"ip": client_ip or "Unknown",
		"country": country_code,
		"region": region,
		"currency": currency_code,
	}


def get_customer_name(order: Order):
	full_name = f"{order.user.first_name} {order.user.last_name}".strip()
	if full_name:
		return full_name
	return order.user.username or order.user.email


def format_payment_method(method: str):
	lookup = {
		"COD": "Cash on Delivery",
		"STRIPE": "Card (Stripe)",
		"SIM": "Simulation",
		"SIMULATED": "Simulation",
	}
	clean = (method or "").strip().upper()
	if not clean:
		return "Not available"
	return lookup.get(clean, clean.replace("_", " ").title())


def get_order_payment_method(order: Order):
	latest_payment = order.payments.order_by("-created_at").first()
	if not latest_payment:
		return "Not available"
	return format_payment_method(latest_payment.method)


def build_invoice_lines(order: Order, context: dict):
	currency_code = context["currency"]
	customer_name = get_customer_name(order)
	payment_method = get_order_payment_method(order)
	invoice_lines = [
		"Nobonir Invoice",
		f"Invoice Date: {timezone.localtime(timezone.now()).strftime('%b %d, %Y, %I:%M %p')}",
		f"Order ID: #{order.id}",
		f"Customer: {customer_name}",
		f"Customer Email: {order.user.email}",
		f"Payment Method: {payment_method}",
		f"Order Status: {order.get_status_display()}",
		f"Placed On: {timezone.localtime(order.created_at).strftime('%b %d, %Y, %I:%M %p')}",
		f"Region: {context['region']} ({context['country']})",
		f"Client IP: {context['ip']}",
		f"Currency: {currency_code}",
		"",
		"Items:",
	]

	for item in order.items.all():
		subtotal = Decimal(item.unit_price) * item.quantity
		invoice_lines.append(
			f"- {item.product_name} | Qty: {item.quantity} | Unit: {money_string(item.unit_price, currency_code)} | Subtotal: {money_string(subtotal, currency_code)}"
		)

	invoice_lines.extend(
		[
			"",
			f"Subtotal: {money_string(order.subtotal_amount, currency_code)}",
			f"Discount: -{money_string(order.discount_amount, currency_code)}",
			f"Total: {money_string(order.total_amount, currency_code)}",
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


def draw_brand_logo(pdf, x: float, y: float, size: float):
	logo_path = Path(settings.BASE_DIR) / "frontend" / "public" / "nobonir-favicon.svg"
	if not logo_path.exists():
		return False
	try:
		drawing = svg2rlg(str(logo_path))
		if not drawing:
			return False
		scale_x = size / drawing.width
		scale_y = size / drawing.height
		drawing.scale(scale_x, scale_y)
		renderPDF.draw(drawing, pdf, x, y - size)
		return True
	except Exception:
		return False


def build_invoice_pdf_response(order: Order, request):
	context = build_invoice_context(request)
	currency_code = context["currency"]
	customer_name = get_customer_name(order)
	payment_method = get_order_payment_method(order)
	response = HttpResponse(content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="invoice-order-{order.id}.pdf"'

	pdf = canvas.Canvas(response, pagesize=A4)
	width, height = A4
	left = 36
	right = width - 36
	y = height - 40

	for font_name in ["Helvetica", "Helvetica-Bold"]:
		if font_name not in pdfmetrics.getRegisteredFontNames():
			try:
				pdfmetrics.registerFont(TTFont(font_name, f"{font_name}.ttf"))
			except Exception:
				pass

	def write_line(text: str, size: int = 10, leading: int = 16):
		nonlocal y
		if y < 60:
			pdf.showPage()
			y = height - 40
		pdf.setFont("Helvetica", size)
		pdf.setFillColor(colors.HexColor("#0f172a"))
		pdf.drawString(left + 6, y, text)
		y -= leading

	def draw_rect_block(x, top_y, block_width, block_height, fill_hex, stroke_hex=None, radius=8):
		pdf.setFillColor(colors.HexColor(fill_hex))
		if stroke_hex:
			pdf.setStrokeColor(colors.HexColor(stroke_hex))
			pdf.roundRect(x, top_y - block_height, block_width, block_height, radius, stroke=1, fill=1)
		else:
			pdf.roundRect(x, top_y - block_height, block_width, block_height, radius, stroke=0, fill=1)

	def draw_label_value(label, value, x, top_y, width_box):
		draw_rect_block(x, top_y, width_box, 44, "#f8fafc", "#dbeafe", 8)
		pdf.setFillColor(colors.HexColor("#475569"))
		pdf.setFont("Helvetica", 8)
		pdf.drawString(x + 10, top_y - 15, label)
		pdf.setFillColor(colors.HexColor("#0f172a"))
		pdf.setFont("Helvetica-Bold", 11)
		pdf.drawString(x + 10, top_y - 30, value)

	pdf.setTitle(f"Invoice Order #{order.id}")
	draw_rect_block(left, y, right - left, 102, "#0f172a", radius=14)
	logo_drawn = draw_brand_logo(pdf, left + 14, y - 14, 40)
	if not logo_drawn:
		draw_rect_block(left + 14, y - 10, 40, 40, "#0ea5e9", None, 10)
		pdf.setFillColor(colors.white)
		pdf.setFont("Helvetica-Bold", 18)
		pdf.drawCentredString(left + 34, y - 38, "N")

	pdf.setFillColor(colors.white)
	pdf.setFont("Helvetica-Bold", 19)
	pdf.drawString(left + 64, y - 24, "Nobonir")
	pdf.setFont("Helvetica", 10)
	pdf.setFillColor(colors.HexColor("#cbd5e1"))
	pdf.drawString(left + 64, y - 42, "Premium Branded Invoice")

	pdf.setFont("Helvetica", 10)
	pdf.setFillColor(colors.HexColor("#e2e8f0"))
	pdf.drawRightString(right - 12, y - 24, f"Invoice #{order.id}")
	pdf.drawRightString(right - 12, y - 40, timezone.localtime(timezone.now()).strftime('%b %d, %Y, %I:%M %p'))

	y -= 122
	box_w = (right - left - 12) / 2
	draw_label_value("Region", f"{context['region']} ({context['country']})", left, y, box_w)
	draw_label_value("Currency", currency_code, left + box_w + 12, y, box_w)
	y -= 56
	draw_label_value("Customer", customer_name[:34], left, y, box_w)
	draw_label_value("Payment", payment_method[:34], left + box_w + 12, y, box_w)
	y -= 56

	draw_rect_block(left, y, right - left, 72, "#f8fafc", "#e2e8f0", 10)
	pdf.setFillColor(colors.HexColor("#334155"))
	pdf.setFont("Helvetica", 9)
	pdf.drawString(left + 12, y - 16, "Order Status")
	pdf.drawString(left + 210, y - 16, "Placed On")
	pdf.drawString(left + 430, y - 16, "Client IP")
	pdf.setFillColor(colors.HexColor("#0f172a"))
	pdf.setFont("Helvetica-Bold", 11)
	pdf.drawString(left + 12, y - 36, order.get_status_display())
	pdf.drawString(left + 210, y - 36, timezone.localtime(order.created_at).strftime('%b %d, %Y %I:%M %p'))
	pdf.drawString(left + 430, y - 36, context["ip"][:20])
	pdf.setFont("Helvetica", 9)
	pdf.setFillColor(colors.HexColor("#475569"))
	pdf.drawString(left + 12, y - 54, f"Email: {order.user.email[:44]}")
	y -= 88

	draw_rect_block(left, y, right - left, 24, "#0ea5e9", None, 7)
	pdf.setFillColor(colors.white)
	pdf.setFont("Helvetica-Bold", 10)
	pdf.drawString(left + 10, y - 16, "ITEM")
	pdf.drawString(left + 300, y - 16, "QTY")
	pdf.drawString(left + 355, y - 16, "UNIT")
	pdf.drawString(left + 455, y - 16, "SUBTOTAL")
	y -= 28

	for item in order.items.all():
		if y < 145:
			pdf.showPage()
			y = height - 40
		draw_rect_block(left, y, right - left, 24, "#ffffff", "#e2e8f0", 4)
		subtotal = Decimal(item.unit_price) * item.quantity
		pdf.setFillColor(colors.HexColor("#0f172a"))
		pdf.setFont("Helvetica", 9)
		pdf.drawString(left + 10, y - 16, item.product_name[:48])
		pdf.drawString(left + 300, y - 16, str(item.quantity))
		pdf.drawString(left + 355, y - 16, money_string(item.unit_price, currency_code))
		pdf.drawString(left + 455, y - 16, money_string(subtotal, currency_code))
		y -= 26

	y -= 4
	draw_rect_block(left + 310, y, right - left - 310, 82, "#eff6ff", "#bfdbfe", 10)
	pdf.setFillColor(colors.HexColor("#334155"))
	pdf.setFont("Helvetica", 10)
	pdf.drawString(left + 322, y - 18, "Subtotal")
	pdf.drawString(left + 322, y - 36, "Discount")
	pdf.setFont("Helvetica-Bold", 11)
	pdf.drawString(left + 322, y - 58, "Total")
	pdf.setFont("Helvetica", 10)
	pdf.drawRightString(right - 10, y - 18, money_string(order.subtotal_amount, currency_code))
	pdf.drawRightString(right - 10, y - 36, f"-{money_string(order.discount_amount, currency_code)}")
	pdf.setFont("Helvetica-Bold", 11)
	pdf.drawRightString(right - 10, y - 58, money_string(order.total_amount, currency_code))
	y -= 96

	draw_rect_block(left, y, (right - left - 12) / 2, 90, "#f8fafc", "#e2e8f0", 8)
	draw_rect_block(left + (right - left + 12) / 2, y, (right - left - 12) / 2, 90, "#f8fafc", "#e2e8f0", 8)

	pdf.setFillColor(colors.HexColor("#0f172a"))
	pdf.setFont("Helvetica-Bold", 10)
	pdf.drawString(left + 10, y - 16, "Shipping Address")
	pdf.drawString(left + (right - left + 12) / 2 + 10, y - 16, "Billing Address")

	pdf.setFont("Helvetica", 9)
	pdf.setFillColor(colors.HexColor("#334155"))
	shipping_lines = (order.shipping_address.strip() or "Not provided").splitlines() or ["Not provided"]
	billing_lines = (order.billing_address.strip() or "Not provided").splitlines() or ["Not provided"]
	for index, text in enumerate(shipping_lines[:4]):
		pdf.drawString(left + 10, y - 34 - (index * 14), text[:40])
	for index, text in enumerate(billing_lines[:4]):
		pdf.drawString(left + (right - left + 12) / 2 + 10, y - 34 - (index * 14), text[:40])

	pdf.setFont("Helvetica", 8)
	pdf.setFillColor(colors.HexColor("#64748b"))
	pdf.drawCentredString(width / 2, 24, "Thank you for shopping with Nobonir • Elegant commerce, trusted delivery")

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
			Order.objects.select_related("user")
			.filter(user=request.user, id=order_id)
			.prefetch_related("items", "payments")
			.first()
		)
		if not order:
			return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

		context = build_invoice_context(request)
		response = HttpResponse("\n".join(build_invoice_lines(order, context)), content_type="text/plain; charset=utf-8")
		response["Content-Disposition"] = f'attachment; filename="invoice-order-{order.id}.txt"'
		return response


class MyOrderInvoicePDFAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request, order_id: int):
		order = (
			Order.objects.select_related("user")
			.filter(user=request.user, id=order_id)
			.prefetch_related("items", "payments")
			.first()
		)
		if not order:
			return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
		return build_invoice_pdf_response(order, request)


class AdminOrderInvoicePDFAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]

	def get(self, request, order_id: int):
		order = (
			Order.objects.select_related("user")
			.filter(id=order_id)
			.prefetch_related("items", "payments")
			.first()
		)
		if not order:
			return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
		return build_invoice_pdf_response(order, request)


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
