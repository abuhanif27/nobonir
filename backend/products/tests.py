from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from orders.models import Order, OrderItem
from products.models import Category, Product

User = get_user_model()


class TopSellingProductsTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="customer-top",
			email="top@example.com",
			password="Secret123!",
		)
		self.category = Category.objects.create(name="Electronics", slug="electronics")
		self.phone = Product.objects.create(
			category=self.category,
			name="Phone",
			slug="phone",
			description="Smartphone",
			price=100,
			stock=50,
			is_active=True,
		)
		self.earbuds = Product.objects.create(
			category=self.category,
			name="Earbuds",
			slug="earbuds",
			description="Wireless earbuds",
			price=60,
			stock=50,
			is_active=True,
		)
		self.lamp = Product.objects.create(
			category=self.category,
			name="Lamp",
			slug="lamp",
			description="Desk lamp",
			price=30,
			stock=50,
			is_active=True,
		)

	def _add_order_item(self, product, quantity, status):
		order = Order.objects.create(
			user=self.user,
			status=status,
			total_amount=quantity * product.price,
			shipping_address="Dhaka",
		)
		OrderItem.objects.create(
			order=order,
			product=product,
			product_name=product.name,
			unit_price=product.price,
			quantity=quantity,
		)
		return order

	def test_top_selling_orders_by_total_sold(self):
		self._add_order_item(self.phone, quantity=2, status=Order.Status.PAID)
		self._add_order_item(self.earbuds, quantity=5, status=Order.Status.DELIVERED)
		self._add_order_item(self.phone, quantity=1, status=Order.Status.SHIPPED)

		response = self.client.get(reverse("product-top-selling"))

		self.assertEqual(response.status_code, 200)
		names = [item["name"] for item in response.data["results"]]
		self.assertEqual(names[0], "Earbuds")
		self.assertEqual(names[1], "Phone")

	def test_top_selling_excludes_pending_and_cancelled(self):
		self._add_order_item(self.phone, quantity=10, status=Order.Status.PENDING)
		self._add_order_item(self.earbuds, quantity=7, status=Order.Status.CANCELLED)
		self._add_order_item(self.lamp, quantity=2, status=Order.Status.PAID)

		response = self.client.get(reverse("product-top-selling"))

		self.assertEqual(response.status_code, 200)
		names = [item["name"] for item in response.data["results"]]
		self.assertEqual(names[0], "Lamp")

	def test_top_selling_only_uses_last_30_days(self):
		recent_order = self._add_order_item(
			self.phone,
			quantity=2,
			status=Order.Status.DELIVERED,
		)
		old_order = self._add_order_item(
			self.earbuds,
			quantity=20,
			status=Order.Status.DELIVERED,
		)

		Order.objects.filter(id=old_order.id).update(
			created_at=timezone.now() - timezone.timedelta(days=45),
		)
		Order.objects.filter(id=recent_order.id).update(
			created_at=timezone.now() - timezone.timedelta(days=5),
		)

		response = self.client.get(reverse("product-top-selling"))

		self.assertEqual(response.status_code, 200)
		names = [item["name"] for item in response.data["results"]]
		self.assertEqual(names[0], "Phone")

	def test_top_selling_returns_active_products_even_without_sales(self):
		response = self.client.get(reverse("product-top-selling"))

		self.assertEqual(response.status_code, 200)
		self.assertGreaterEqual(len(response.data["results"]), 3)
