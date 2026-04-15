from copy import deepcopy

from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APITestCase

from cart.models import Cart, CartItem
from cart.utils import merge_guest_cart_to_user
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


class GuestCartMergeIntegrationTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="merge-user",
			email="merge@example.com",
			password="Secret123!",
			role="CUSTOMER",
		)
		category = Category.objects.create(name="Audio", slug="audio")
		self.product = Product.objects.create(
			category=category,
			name="Speaker",
			slug="speaker",
			description="Portable speaker",
			price=99,
			stock=30,
			is_active=True,
		)

	def test_guest_cart_items_merge_into_user_cart_on_login(self):
		guest_add = self.client.post(
			"/api/cart/items/",
			{"product_id": self.product.id, "quantity": 2},
			format="json",
		)
		self.assertEqual(guest_add.status_code, status.HTTP_201_CREATED)

		session_key = self.client.session.session_key
		self.assertTrue(session_key)

		guest_cart = Cart.objects.get(session_key=session_key, user__isnull=True)
		guest_item = CartItem.objects.get(cart=guest_cart, product=self.product)
		self.assertEqual(guest_item.quantity, 2)

		user_cart = Cart.objects.create(user=self.user)
		CartItem.objects.create(cart=user_cart, product=self.product, quantity=1)

		merge_guest_cart_to_user(session_key=session_key, user=self.user)

		self.assertFalse(Cart.objects.filter(session_key=session_key, user__isnull=True).exists())
		merged_item = CartItem.objects.get(cart__user=self.user, product=self.product)
		self.assertEqual(merged_item.quantity, 3)

	def test_guest_cart_persists_and_accumulates_with_same_session(self):
		first = self.client.post(
			"/api/cart/items/",
			{"product_id": self.product.id, "quantity": 1},
			format="json",
		)
		self.assertEqual(first.status_code, status.HTTP_201_CREATED)

		second = self.client.post(
			"/api/cart/items/",
			{"product_id": self.product.id, "quantity": 2},
			format="json",
		)
		self.assertEqual(second.status_code, status.HTTP_201_CREATED)

		list_response = self.client.get("/api/cart/")
		self.assertEqual(list_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(list_response.data), 1)
		self.assertEqual(list_response.data[0]["quantity"], 3)
