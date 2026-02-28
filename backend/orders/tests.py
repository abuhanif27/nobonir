from copy import deepcopy

from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from cart.models import Cart, CartItem
from payments.services import process_payment
from payments.models import Payment
from orders.services import create_order_from_cart
from orders.models import Coupon, Order, OrderItem
from products.models import Category, Product
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APITestCase

User = get_user_model()


class OrderServiceTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="customer1", email="c1@example.com", password="Secret123!")
		category = Category.objects.create(name="Electronics", slug="electronics")
		self.product = Product.objects.create(
			category=category,
			name="Phone",
			slug="phone",
			description="smart phone",
			price=100,
			stock=10,
			is_active=True,
		)
		cart = Cart.objects.create(user=self.user)
		CartItem.objects.create(cart=cart, product=self.product, quantity=2)

	def test_checkout_creates_pending_order_without_reducing_stock(self):
		order = create_order_from_cart(self.user, "Dhaka")

		self.product.refresh_from_db()
		self.assertEqual(order.status, "PENDING")
		self.assertEqual(order.billing_address, "")
		self.assertEqual(order.items.count(), 1)
		self.assertEqual(self.product.stock, 10)

	def test_checkout_saves_billing_address(self):
		order = create_order_from_cart(self.user, "Dhaka", "Baridhara, Dhaka")
		self.assertEqual(order.billing_address, "Baridhara, Dhaka")

	def test_coupon_first_use_applies_ten_percent_discount(self):
		Coupon.objects.update_or_create(
			code="NOBONIR",
			defaults={
				"discount_percent": 10,
				"expires_at": timezone.now() + timedelta(days=30),
				"is_active": True,
			},
		)

		order = create_order_from_cart(self.user, "Dhaka", "Baridhara", "NOBONIR")

		self.assertEqual(order.subtotal_amount, 200)
		self.assertEqual(order.discount_amount, 20)
		self.assertEqual(order.total_amount, 180)
		self.assertEqual(order.coupon_code, "NOBONIR")

	def test_coupon_second_use_is_rejected(self):
		Coupon.objects.update_or_create(
			code="NOBONIR",
			defaults={
				"discount_percent": 10,
				"expires_at": timezone.now() + timedelta(days=30),
				"is_active": True,
			},
		)

		first_order = create_order_from_cart(self.user, "Dhaka", "Baridhara", "NOBONIR")
		process_payment(first_order, method="SIM", success=True)

		cart = Cart.objects.get(user=self.user)
		CartItem.objects.create(cart=cart, product=self.product, quantity=1)

		with self.assertRaisesMessage(ValueError, "already been used"):
			create_order_from_cart(self.user, "Dhaka", "Baridhara", "NOBONIR")

	def test_expired_coupon_is_rejected(self):
		Coupon.objects.update_or_create(
			code="NOBONIR",
			defaults={
				"discount_percent": 10,
				"expires_at": timezone.now() - timedelta(days=1),
				"is_active": True,
			},
		)

		with self.assertRaisesMessage(ValueError, "has expired"):
			create_order_from_cart(self.user, "Dhaka", "Baridhara", "NOBONIR")


class OrderInvoiceAPITests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="invoice-user",
			email="invoice@example.com",
			password="Secret123!",
			first_name="Invoice",
			last_name="Customer",
		)
		self.other_user = User.objects.create_user(username="other-user", email="other@example.com", password="Secret123!")
		self.admin_user = User.objects.create_user(
			username="admin-user",
			email="admin@example.com",
			password="Secret123!",
			role="ADMIN",
			is_staff=True,
		)
		category = Category.objects.create(name="Books", slug="books")
		product = Product.objects.create(
			category=category,
			name="Notebook",
			slug="notebook",
			description="paper notebook",
			price=Decimal("120.00"),
			stock=20,
			is_active=True,
		)
		self.order = Order.objects.create(
			user=self.user,
			status=Order.Status.PAID,
			subtotal_amount=Decimal("240.00"),
			discount_amount=Decimal("20.00"),
			total_amount=Decimal("220.00"),
			coupon_code="NOBONIR",
			shipping_address="Dhaka",
			billing_address="Dhaka",
		)
		OrderItem.objects.create(
			order=self.order,
			product=product,
			product_name=product.name,
			unit_price=Decimal("120.00"),
			quantity=2,
		)
		Payment.objects.create(
			order=self.order,
			amount=self.order.total_amount,
			method="COD",
			status=Payment.Status.SUCCESS,
			transaction_id="inv-test-cod-001",
		)

	def test_owner_can_download_invoice(self):
		self.client.force_authenticate(user=self.user)
		response = self.client.get(f"/api/orders/my/{self.order.id}/invoice/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
		self.assertIn(
			f'attachment; filename="invoice-order-{self.order.id}.txt"',
			response["Content-Disposition"],
		)
		content = response.content.decode("utf-8")
		self.assertIn(f"Order ID: #{self.order.id}", content)
		self.assertIn("Customer: Invoice Customer", content)
		self.assertIn("Customer Email: invoice@example.com", content)
		self.assertIn("Payment Method: Cash on Delivery", content)
		self.assertNotIn("Client IP:", content)
		self.assertIn("Currency: BDT (converted from USD)", content)
		self.assertIn("Total: BDT 26,620.00", content)

	def test_non_owner_cannot_download_invoice(self):
		self.client.force_authenticate(user=self.other_user)
		response = self.client.get(f"/api/orders/my/{self.order.id}/invoice/")

		self.assertEqual(response.status_code, 404)

	def test_invoice_currency_uses_country_header(self):
		self.client.force_authenticate(user=self.user)
		response = self.client.get(
			f"/api/orders/my/{self.order.id}/invoice/",
			HTTP_CF_IPCOUNTRY="JP",
			REMOTE_ADDR="8.8.8.8",
		)

		self.assertEqual(response.status_code, 200)
		content = response.content.decode("utf-8")
		self.assertIn("Currency: JPY", content)
		self.assertIn("Region: JP (JP)", content)

	def test_owner_can_download_invoice_pdf(self):
		self.client.force_authenticate(user=self.user)
		response = self.client.get(f"/api/orders/my/{self.order.id}/invoice.pdf/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "application/pdf")
		self.assertIn(
			f'attachment; filename="invoice-order-{self.order.id}.pdf"',
			response["Content-Disposition"],
		)
		self.assertTrue(response.content.startswith(b"%PDF"))

	def test_non_owner_cannot_download_invoice_pdf(self):
		self.client.force_authenticate(user=self.other_user)
		response = self.client.get(f"/api/orders/my/{self.order.id}/invoice.pdf/")

		self.assertEqual(response.status_code, 404)

	def test_admin_can_download_any_order_invoice_pdf(self):
		self.client.force_authenticate(user=self.admin_user)
		response = self.client.get(f"/api/orders/admin/{self.order.id}/invoice.pdf/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "application/pdf")
		self.assertIn(
			f'attachment; filename="invoice-order-{self.order.id}.pdf"',
			response["Content-Disposition"],
		)
		self.assertTrue(response.content.startswith(b"%PDF"))

	def test_customer_cannot_access_admin_invoice_pdf(self):
		self.client.force_authenticate(user=self.user)
		response = self.client.get(f"/api/orders/admin/{self.order.id}/invoice.pdf/")

		self.assertEqual(response.status_code, 403)

	def test_superuser_can_access_admin_invoice_pdf(self):
		superuser = User.objects.create_superuser(
			username="root-user",
			email="root@example.com",
			password="Secret123!",
		)
		self.client.force_authenticate(user=superuser)
		response = self.client.get(f"/api/orders/admin/{self.order.id}/invoice.pdf/")

		self.assertEqual(response.status_code, 200)


class CheckoutThrottleTests(APITestCase):
	def setUp(self):
		cache.clear()
		self._old_throttle_rates = deepcopy(ScopedRateThrottle.THROTTLE_RATES)
		ScopedRateThrottle.THROTTLE_RATES = {
			**ScopedRateThrottle.THROTTLE_RATES,
			"order_checkout": "1/min",
		}
		self.user = User.objects.create_user(
			username="checkout-throttle",
			email="checkout-throttle@example.com",
			password="Secret123!",
			role="CUSTOMER",
		)
		category = Category.objects.create(name="Gaming", slug="gaming")
		self.product = Product.objects.create(
			category=category,
			name="Mouse",
			slug="mouse",
			description="Gaming mouse",
			price=Decimal("50.00"),
			stock=30,
			is_active=True,
		)
		cart = Cart.objects.create(user=self.user)
		CartItem.objects.create(cart=cart, product=self.product, quantity=1)
		self.client.force_authenticate(user=self.user)

	def tearDown(self):
		ScopedRateThrottle.THROTTLE_RATES = self._old_throttle_rates
		cache.clear()

	def test_checkout_requests_are_throttled(self):
		first = self.client.post(
			"/api/orders/checkout/",
			{"shipping_address": "Dhaka", "billing_address": "Dhaka", "payment_method": "CARD"},
			format="json",
		)
		self.assertEqual(first.status_code, status.HTTP_201_CREATED)

		second = self.client.post(
			"/api/orders/checkout/",
			{"shipping_address": "Dhaka", "billing_address": "Dhaka", "payment_method": "CARD"},
			format="json",
		)

		self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class CheckoutAndStatusTransitionAPITests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="checkout-api-user",
			email="checkout-api@example.com",
			password="Secret123!",
			role="CUSTOMER",
		)
		self.admin_user = User.objects.create_user(
			username="order-admin",
			email="order-admin@example.com",
			password="Secret123!",
			role="ADMIN",
			is_staff=True,
		)
		category = Category.objects.create(name="Accessories", slug="accessories")
		self.product = Product.objects.create(
			category=category,
			name="Wireless Charger",
			slug="wireless-charger",
			description="MagSafe charger",
			price=Decimal("250.00"),
			stock=15,
			is_active=True,
		)

	def _create_cart_item(self, user, quantity=2):
		cart = Cart.objects.get_or_create(user=user)[0]
		CartItem.objects.create(cart=cart, product=self.product, quantity=quantity)

	def test_checkout_creates_pending_order_and_clears_cart(self):
		self._create_cart_item(self.user, quantity=2)
		self.client.force_authenticate(user=self.user)

		response = self.client.post(
			"/api/orders/checkout/",
			{
				"shipping_address": "Dhaka",
				"billing_address": "Dhaka",
				"payment_method": "CARD",
			},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["status"], Order.Status.PENDING)
		self.assertEqual(response.data["total_amount"], "500.00")
		self.assertEqual(len(response.data["items"]), 1)
		self.assertFalse(CartItem.objects.filter(cart__user=self.user).exists())

	def test_checkout_returns_400_when_cart_is_empty(self):
		self.client.force_authenticate(user=self.user)

		response = self.client.post(
			"/api/orders/checkout/",
			{
				"shipping_address": "Dhaka",
				"billing_address": "Dhaka",
				"payment_method": "CARD",
			},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(response.data["detail"], "Cart is empty")

	def test_admin_can_transition_order_statuses(self):
		order = Order.objects.create(
			user=self.user,
			status=Order.Status.PENDING,
			shipping_address="Dhaka",
			billing_address="Dhaka",
			total_amount=Decimal("250.00"),
		)
		self.client.force_authenticate(user=self.admin_user)

		for next_status in [
			Order.Status.PROCESSING,
			Order.Status.SHIPPED,
			Order.Status.DELIVERED,
		]:
			response = self.client.patch(
				f"/api/orders/admin/{order.id}/",
				{"status": next_status},
				format="json",
			)
			self.assertEqual(response.status_code, status.HTTP_200_OK)
			self.assertEqual(response.data["status"], next_status)

		order.refresh_from_db()
		self.assertEqual(order.status, Order.Status.DELIVERED)

	def test_admin_status_transition_rejects_invalid_status(self):
		order = Order.objects.create(
			user=self.user,
			status=Order.Status.PENDING,
			shipping_address="Dhaka",
			billing_address="Dhaka",
			total_amount=Decimal("250.00"),
		)
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.patch(
			f"/api/orders/admin/{order.id}/",
			{"status": "UNKNOWN_STATUS"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(response.data["detail"], "Invalid status.")

	def test_customer_cannot_update_admin_order_status(self):
		order = Order.objects.create(
			user=self.user,
			status=Order.Status.PENDING,
			shipping_address="Dhaka",
			billing_address="Dhaka",
			total_amount=Decimal("250.00"),
		)
		self.client.force_authenticate(user=self.user)

		response = self.client.patch(
			f"/api/orders/admin/{order.id}/",
			{"status": Order.Status.SHIPPED},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
