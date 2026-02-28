from copy import deepcopy

from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APITestCase

from products.models import Category, Product


User = get_user_model()


class CartHardeningTests(APITestCase):
	def setUp(self):
		cache.clear()
		self._old_throttle_rates = deepcopy(ScopedRateThrottle.THROTTLE_RATES)
		ScopedRateThrottle.THROTTLE_RATES = {
			**ScopedRateThrottle.THROTTLE_RATES,
			"cart_write": "2/min",
		}
		self.user = User.objects.create_user(
			username="cart-user",
			email="cart@example.com",
			password="Secret123!",
			role="CUSTOMER",
		)
		category = Category.objects.create(name="Accessories", slug="accessories")
		self.product = Product.objects.create(
			category=category,
			name="Headphone",
			slug="headphone",
			description="Noise cancelling",
			price=50,
			stock=20,
			is_active=True,
		)

	def tearDown(self):
		ScopedRateThrottle.THROTTLE_RATES = self._old_throttle_rates
		cache.clear()

	def test_patch_rejects_non_numeric_quantity(self):
		create_response = self.client.post(
			"/api/cart/items/",
			{"product_id": self.product.id, "quantity": 1},
			format="json",
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		item_id = create_response.data["id"]

		response = self.client.patch(
			f"/api/cart/items/{item_id}/",
			{"quantity": "abc"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("quantity", response.data)

	def test_cart_write_requests_are_throttled(self):
		for _ in range(2):
			response = self.client.post(
				"/api/cart/items/",
				{"product_id": self.product.id, "quantity": 1},
				format="json",
			)
			self.assertEqual(response.status_code, status.HTTP_201_CREATED)

		throttled = self.client.post(
			"/api/cart/items/",
			{"product_id": self.product.id, "quantity": 1},
			format="json",
		)

		self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
