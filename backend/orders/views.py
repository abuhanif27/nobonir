from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from decimal import Decimal, ROUND_HALF_UP
import json
import time
from ipaddress import ip_address
from pathlib import Path
from django.db.models import Q
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
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
from rest_framework_simplejwt.authentication import JWTAuthentication
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
	"BDT": "BDT",
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

def get_invoice_rate_table():
	rates = {"USD": Decimal("1")}
	raw_rates = getattr(settings, "INVOICE_USD_TO_RATES", {}) or {}
	for code, value in raw_rates.items():
		try:
			rates[str(code).strip().upper()] = Decimal(str(value).strip())
		except Exception:
			continue
	return rates


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

	if client_ip:
		try:
			parsed = ip_address(client_ip)
			if parsed.is_private or parsed.is_loopback:
				return "BD"
		except ValueError:
			pass

	default_country = (getattr(settings, "DEFAULT_INVOICE_COUNTRY", "BD") or "BD").strip().upper()
	if len(default_country) == 2 and default_country.isalpha():
		return default_country
	return "BD"


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

	if currency_code in {"BDT", "AED", "SAR", "QAR", "KWD", "CHF"}:
		return f"{currency_code} {formatted}"

	if symbol == currency_code:
		return f"{formatted} {currency_code}"
	return f"{symbol}{formatted}"


def build_invoice_context(request):
	client_ip = get_client_ip(request)
	country_code = infer_country_code(request, client_ip)
	currency_code = CURRENCY_BY_COUNTRY.get(country_code, "USD")
	base_currency = (
		(getattr(settings, "INVOICE_BASE_CURRENCY", "USD") or "USD")
		.strip()
		.upper()
	)
	region = country_code
	if client_ip:
		try:
			parsed = ip_address(client_ip)
			if parsed.is_private or parsed.is_loopback:
				region = "Local"
		except ValueError:
			pass

	return {
		"country": country_code,
		"region": region,
		"currency": currency_code,
		"base_currency": base_currency,
	}


def convert_amount(amount, from_currency: str, to_currency: str):
	value = Decimal(amount)
	from_code = (from_currency or "USD").upper()
	to_code = (to_currency or "USD").upper()

	if from_code == to_code:
		return value

	rate_table = get_invoice_rate_table()
	from_rate = rate_table.get(from_code)
	to_rate = rate_table.get(to_code)
	if not from_rate or not to_rate:
		return value

	usd_value = value / from_rate
	return usd_value * to_rate


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
	base_currency = context["base_currency"]
	customer_name = get_customer_name(order)
	payment_method = get_order_payment_method(order)

	def display_money(amount):
		converted = convert_amount(amount, base_currency, currency_code)
		return money_string(converted, currency_code)

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
		f"Currency: {currency_code} (converted from {base_currency})",
		"",
		"Items:",
	]

	for item in order.items.all():
		subtotal = Decimal(item.unit_price) * item.quantity
		invoice_lines.append(
			f"- {item.product_name} | Qty: {item.quantity} | Unit: {display_money(item.unit_price)} | Subtotal: {display_money(subtotal)}"
		)

	invoice_lines.extend(
		[
			"",
			f"Subtotal: {display_money(order.subtotal_amount)}",
			f"Discount: -{display_money(order.discount_amount)}",
			f"Total: {display_money(order.total_amount)}",
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
	base_currency = context["base_currency"]
	customer_name = get_customer_name(order)
	payment_method = get_order_payment_method(order)
	response = HttpResponse(content_type="application/pdf")
	response["Content-Disposition"] = f'attachment; filename="invoice-order-{order.id}.pdf"'

	pdf = canvas.Canvas(response, pagesize=A4)
	width, height = A4
	left = 40
	right = width - 40
	content_width = right - left
	y = height - 44

	for font_name in ["Helvetica", "Helvetica-Bold"]:
		if font_name not in pdfmetrics.getRegisteredFontNames():
			try:
				pdfmetrics.registerFont(TTFont(font_name, f"{font_name}.ttf"))
			except Exception:
				pass

	def draw_rect_block(x, top_y, block_width, block_height, fill_hex, stroke_hex=None, radius=6):
		pdf.setFillColor(colors.HexColor(fill_hex))
		if stroke_hex:
			pdf.setStrokeColor(colors.HexColor(stroke_hex))
			pdf.roundRect(x, top_y - block_height, block_width, block_height, radius, stroke=1, fill=1)
		else:
			pdf.roundRect(x, top_y - block_height, block_width, block_height, radius, stroke=0, fill=1)

	def draw_label_value(label, value, x, top_y, width_box):
		draw_rect_block(x, top_y, width_box, 42, "#ffffff", "#e5e7eb", 6)
		pdf.setFillColor(colors.HexColor("#6b7280"))
		pdf.setFont("Helvetica", 8)
		pdf.drawString(x + 9, top_y - 14, label)
		pdf.setFillColor(colors.HexColor("#111827"))
		pdf.setFont("Helvetica-Bold", 10)
		pdf.drawString(x + 9, top_y - 28, value)

	def fit_text(text: str, max_chars: int):
		if len(text) <= max_chars:
			return text
		return f"{text[: max_chars - 1]}…"

	def display_money(amount):
		converted = convert_amount(amount, base_currency, currency_code)
		return money_string(converted, currency_code)

	def split_email(email: str):
		clean = (email or "").strip()
		if len(clean) <= 24:
			return clean, ""
		if "@" not in clean:
			return fit_text(clean, 24), ""
		local, domain = clean.split("@", 1)
		first_line = f"{fit_text(local, 17)}@"
		second_line = fit_text(domain, 22)
		return first_line, second_line

	def draw_table_header(current_y):
		pdf.setStrokeColor(colors.HexColor("#22d3ee"))
		pdf.setLineWidth(1)
		pdf.line(left, current_y - 2, right, current_y - 2)
		pdf.setFillColor(colors.HexColor("#0f172a"))
		pdf.setFont("Helvetica-Bold", 9)
		pdf.drawString(left + 2, current_y - 16, "ITEM")
		pdf.drawString(left + 308, current_y - 16, "QTY")
		pdf.drawString(left + 360, current_y - 16, "UNIT")
		pdf.drawRightString(right, current_y - 16, "SUBTOTAL")
		return current_y - 24

	def ensure_space(current_y, needed):
		if current_y - needed >= 52:
			return current_y
		pdf.showPage()
		return height - 44

	pdf.setTitle(f"Invoice Order #{order.id}")
	pdf.setStrokeColor(colors.HexColor("#22d3ee"))
	pdf.setLineWidth(2)
	pdf.line(left, y + 6, right, y + 6)

	logo_drawn = draw_brand_logo(pdf, left, y + 2, 26)
	title_x = left + 34 if logo_drawn else left

	pdf.setFillColor(colors.HexColor("#0f172a"))
	pdf.setFont("Helvetica-Bold", 21)
	pdf.drawString(title_x, y - 12, "Nobonir")
	pdf.setFont("Helvetica", 10)
	pdf.setFillColor(colors.HexColor("#475569"))
	pdf.drawString(title_x, y - 28, "Invoice")

	pdf.setFillColor(colors.HexColor("#111827"))
	pdf.setFont("Helvetica-Bold", 10)
	pdf.drawRightString(right, y - 12, f"Invoice #{order.id}")
	pdf.setFont("Helvetica", 9)
	pdf.setFillColor(colors.HexColor("#6b7280"))
	pdf.drawRightString(right, y - 27, timezone.localtime(timezone.now()).strftime('%b %d, %Y %I:%M %p'))

	y -= 50
	pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
	pdf.setLineWidth(1)
	pdf.line(left, y, right, y)
	y -= 16

	box_w = (content_width - 12) / 2
	draw_label_value("Region", fit_text(f"{context['region']} ({context['country']})", 26), left, y, box_w)
	draw_label_value("Currency", currency_code, left + box_w + 12, y, box_w)
	y -= 50
	draw_label_value("Customer", fit_text(customer_name, 28), left, y, box_w)
	draw_label_value("Payment", fit_text(payment_method, 28), left + box_w + 12, y, box_w)
	y -= 50

	draw_rect_block(left, y, content_width, 66, "#ffffff", "#e5e7eb", 6)
	pdf.setFillColor(colors.HexColor("#6b7280"))
	pdf.setFont("Helvetica", 9)
	pdf.drawString(left + 10, y - 16, "Order Status")
	pdf.drawString(left + 206, y - 16, "Placed On")
	pdf.drawString(left + 418, y - 16, "Email")
	pdf.setFillColor(colors.HexColor("#111827"))
	pdf.setFont("Helvetica-Bold", 11)
	pdf.drawString(left + 10, y - 34, fit_text(order.get_status_display(), 14))
	pdf.drawString(left + 206, y - 34, timezone.localtime(order.created_at).strftime('%b %d, %Y %I:%M %p'))
	email_line1, email_line2 = split_email(order.user.email)
	pdf.drawString(left + 418, y - 32, email_line1)
	if email_line2:
		pdf.setFont("Helvetica", 8)
		pdf.setFillColor(colors.HexColor("#6b7280"))
		pdf.drawString(left + 418, y - 45, email_line2)
	y -= 82

	y = draw_table_header(y)

	for index, item in enumerate(order.items.all()):
		y = ensure_space(y, 30)
		if y > height - 50:
			y = draw_table_header(y - 8)

		if y < 145:
			pdf.showPage()
			y = draw_table_header(height - 48)
		row_bg = "#ffffff" if index % 2 == 0 else "#f9fafb"
		draw_rect_block(left, y, content_width, 24, row_bg, "#e5e7eb", 4)
		subtotal = Decimal(item.unit_price) * item.quantity
		pdf.setFillColor(colors.HexColor("#111827"))
		pdf.setFont("Helvetica", 9)
		pdf.drawString(left + 10, y - 16, fit_text(item.product_name, 44))
		pdf.drawString(left + 308, y - 16, str(item.quantity))
		pdf.drawString(left + 360, y - 16, display_money(item.unit_price))
		pdf.drawRightString(right, y - 16, display_money(subtotal))
		y -= 26

	y -= 10
	y = ensure_space(y, 112)
	if y > height - 50:
		y = height - 50
	draw_rect_block(left + 290, y, content_width - 290, 98, "#ffffff", "#e5e7eb", 6)
	pdf.setFillColor(colors.HexColor("#6b7280"))
	pdf.setFont("Helvetica", 10)
	pdf.drawString(left + 302, y - 20, "Subtotal")
	pdf.drawString(left + 302, y - 40, "Discount")
	pdf.drawString(left + 302, y - 60, "Coupon")
	pdf.setStrokeColor(colors.HexColor("#22d3ee"))
	pdf.line(left + 300, y - 70, right - 10, y - 70)
	pdf.setFillColor(colors.HexColor("#111827"))
	pdf.setFont("Helvetica-Bold", 12)
	pdf.drawString(left + 302, y - 84, "Total")
	pdf.setFont("Helvetica", 10)
	pdf.drawRightString(right - 12, y - 20, display_money(order.subtotal_amount))
	pdf.drawRightString(right - 12, y - 40, f"-{display_money(order.discount_amount)}")
	pdf.drawRightString(right - 12, y - 60, order.coupon_code or "None")
	pdf.setFont("Helvetica-Bold", 12)
	pdf.drawRightString(right - 12, y - 84, display_money(order.total_amount))
	y -= 114

	y = ensure_space(y, 108)
	if y > height - 50:
		y = height - 50
	draw_rect_block(left, y, (content_width - 12) / 2, 96, "#ffffff", "#e5e7eb", 6)
	draw_rect_block(left + (content_width + 12) / 2, y, (content_width - 12) / 2, 96, "#ffffff", "#e5e7eb", 6)

	pdf.setFillColor(colors.HexColor("#111827"))
	pdf.setFont("Helvetica-Bold", 10)
	pdf.drawString(left + 10, y - 16, "Shipping Address")
	pdf.drawString(left + (content_width + 12) / 2 + 10, y - 16, "Billing Address")

	pdf.setFont("Helvetica", 9)
	pdf.setFillColor(colors.HexColor("#4b5563"))
	shipping_lines = (order.shipping_address.strip() or "Not provided").splitlines() or ["Not provided"]
	billing_lines = (order.billing_address.strip() or "Not provided").splitlines() or ["Not provided"]
	for index, text in enumerate(shipping_lines[:4]):
		pdf.drawString(left + 10, y - 34 - (index * 14), fit_text(text, 40))
	for index, text in enumerate(billing_lines[:4]):
		pdf.drawString(left + (content_width + 12) / 2 + 10, y - 34 - (index * 14), fit_text(text, 40))

	pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
	pdf.line(left, 34, right, 34)
	pdf.setFont("Helvetica", 8)
	pdf.setFillColor(colors.HexColor("#6b7280"))
	pdf.drawString(left, 20, f"Generated {timezone.localtime(timezone.now()).strftime('%b %d, %Y %I:%M %p')}")
	pdf.drawRightString(right, 20, f"Currency {currency_code} (from {base_currency})")

	pdf.showPage()
	pdf.save()
	return response


class CheckoutAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]
	throttle_classes = [ScopedRateThrottle]
	throttle_scope = "order_checkout"

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
		except Exception as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
		try:
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
		except Exception:
			pass
		return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CouponValidateAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]
	throttle_classes = [ScopedRateThrottle]
	throttle_scope = "order_coupon_validate"

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


class MyOrderStatusStreamAPIView(APIView):
	permission_classes = [permissions.AllowAny]

	def _authenticate_from_token(self, request):
		token = (request.query_params.get("token") or "").strip()
		if not token:
			return None

		jwt_auth = JWTAuthentication()
		try:
			validated = jwt_auth.get_validated_token(token)
			return jwt_auth.get_user(validated)
		except Exception:
			return None

	def get(self, request):
		user = self._authenticate_from_token(request)
		if not user or not getattr(user, "is_authenticated", False):
			return Response({"detail": "Unauthorized."}, status=status.HTTP_401_UNAUTHORIZED)

		if getattr(user, "role", "") != "CUSTOMER":
			return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

		def event_stream():
			last_signature = ""
			start = time.time()

			yield "retry: 3000\n\n"

			while time.time() - start < 120:
				rows = list(
					Order.objects.filter(user=user)
					.order_by("-updated_at")
					.values("id", "status", "updated_at")[:30]
				)

				normalized_rows = [
					{
						"id": int(row["id"]),
						"status": str(row["status"]),
						"updated_at": row["updated_at"].isoformat()
						if row.get("updated_at")
						else "",
					}
					for row in rows
				]

				signature = "|".join(
					f"{row['id']}:{row['status']}:{row['updated_at']}" for row in normalized_rows
				)

				if signature != last_signature:
					payload = json.dumps({"orders": normalized_rows})
					yield f"event: order_status\\n"
					yield f"data: {payload}\\n\\n"
					last_signature = signature
				else:
					yield ": keepalive\\n\\n"

				time.sleep(5)

		response = StreamingHttpResponse(
			event_stream(),
			content_type="text/event-stream",
		)
		response["Cache-Control"] = "no-cache"
		response["X-Accel-Buffering"] = "no"
		return response


class MyOrderInvoiceAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]
	throttle_classes = [ScopedRateThrottle]
	throttle_scope = "order_invoice_download"

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
	throttle_classes = [ScopedRateThrottle]
	throttle_scope = "order_invoice_download"

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
