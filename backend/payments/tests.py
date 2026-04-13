from django.contrib.auth import get_user_model
from django.test import TestCase
from unittest.mock import patch
import stripe

from orders.models import Order, OrderItem
from payments.services import create_stripe_checkout_session, process_payment
from products.models import Category, Product

User = get_user_model()


class PaymentServiceTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="customer2", email="c2@example.com", password="Secret123!")
		category = Category.objects.create(name="Fashion", slug="fashion")
		self.product = Product.objects.create(
			category=category,
			name="Jacket",
			slug="jacket",
			description="winter jacket",
			price=50,
			stock=5,
			is_active=True,
		)
		self.order = Order.objects.create(user=self.user, shipping_address="Dhaka", total_amount=100)
		OrderItem.objects.create(order=self.order, product=self.product, product_name="Jacket", unit_price=50, quantity=2)

	def test_success_payment_reduces_stock_and_marks_paid(self):
		payment = process_payment(self.order, method="SIM", success=True)
		self.product.refresh_from_db()
		self.order.refresh_from_db()
		self.assertEqual(payment.status, "SUCCESS")
		self.assertEqual(self.product.stock, 3)
		self.assertEqual(self.order.status, "PAID")

	def test_failed_payment_cancels_order_and_does_not_reduce_stock(self):
		payment = process_payment(self.order, method="SIM", success=False)
		self.product.refresh_from_db()
		self.order.refresh_from_db()
		self.assertEqual(payment.status, "FAILED")
		self.assertEqual(self.product.stock, 5)
		self.assertEqual(self.order.status, "CANCELLED")

	@patch("payments.services.get_live_stripe_secret_key", return_value="sk_test_dummy")
	@patch("payments.services.stripe.checkout.Session.create")
	def test_create_stripe_checkout_session_converts_stripe_errors_to_value_error(
		self,
		mock_create_session,
		_mock_secret_key,
	):
		mock_create_session.side_effect = stripe.error.InvalidRequestError(
			message="Invalid success URL",
			param="success_url",
		)

		with self.assertRaisesMessage(ValueError, "Invalid success URL"):
			create_stripe_checkout_session(
				order=self.order,
				success_url="http://localhost:5173/orders?payment=success",
				cancel_url="http://localhost:5173/cart?payment=cancelled",
			)
