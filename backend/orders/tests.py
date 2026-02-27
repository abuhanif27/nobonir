from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from cart.models import Cart, CartItem
from orders.services import create_order_from_cart
from orders.models import Coupon
from products.models import Category, Product

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

		create_order_from_cart(self.user, "Dhaka", "Baridhara", "NOBONIR")

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
