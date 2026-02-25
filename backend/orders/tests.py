from django.contrib.auth import get_user_model
from django.test import TestCase

from cart.models import Cart, CartItem
from orders.services import create_order_from_cart
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
		self.assertEqual(order.items.count(), 1)
		self.assertEqual(self.product.stock, 10)
