from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from cart.models import Cart, CartItem
from payments.services import process_payment
from orders.services import create_order_from_cart
from orders.models import Coupon, Order, OrderItem
from products.models import Category, Product
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
		self.user = User.objects.create_user(username="invoice-user", email="invoice@example.com", password="Secret123!")
		self.other_user = User.objects.create_user(username="other-user", email="other@example.com", password="Secret123!")
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

	def test_owner_can_download_invoice(self):
		self.client.force_authenticate(user=self.user)
		response = self.client.get(f"/api/orders/my/{self.order.id}/invoice/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
		self.assertIn(
			f'attachment; filename="invoice-order-{self.order.id}.txt"',
			response["Content-Disposition"],
		)
		self.assertIn(f"Order ID: #{self.order.id}", response.content.decode("utf-8"))

	def test_non_owner_cannot_download_invoice(self):
		self.client.force_authenticate(user=self.other_user)
		response = self.client.get(f"/api/orders/my/{self.order.id}/invoice/")

		self.assertEqual(response.status_code, 404)
