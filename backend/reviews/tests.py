from copy import deepcopy

from django.core.cache import cache
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APITestCase

from orders.models import Order, OrderItem
from products.models import Category, Product
from reviews.models import Review


User = get_user_model()


class ReviewFlowTests(APITestCase):
	def setUp(self):
		cache.clear()
		self.user = User.objects.create_user(
			username="customer-review",
			email="reviewer@example.com",
			password="StrongPass123!",
			role="CUSTOMER",
		)
		self.other_user = User.objects.create_user(
			username="someone-else",
			email="other@example.com",
			password="StrongPass123!",
			role="CUSTOMER",
		)
		self.category = Category.objects.create(name="Phones", slug="phones")
		self.product = Product.objects.create(
			category=self.category,
			name="Phone X",
			slug="phone-x",
			description="Nice phone",
			price=99,
			stock=10,
			is_active=True,
		)
		self.product_two = Product.objects.create(
			category=self.category,
			name="Phone Y",
			slug="phone-y",
			description="Another phone",
			price=109,
			stock=10,
			is_active=True,
		)

	def tearDown(self):
		cache.clear()

	def _create_order_with_status(self, user, status_value):
		order = Order.objects.create(
			user=user,
			status=status_value,
			shipping_address="Dhaka",
			billing_address="Dhaka",
			total_amount=99,
		)
		OrderItem.objects.create(
			order=order,
			product=self.product,
			product_name=self.product.name,
			unit_price=99,
			quantity=1,
		)

	def test_review_requires_delivered_order(self):
		self._create_order_with_status(self.user, "PAID")
		self.client.force_authenticate(user=self.user)

		response = self.client.post(
			"/api/reviews/",
			{"product": self.product.id, "rating": 5, "comment": "Great"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("delivered", str(response.data).lower())

	def test_review_allowed_for_delivered_order(self):
		self._create_order_with_status(self.user, "DELIVERED")
		self.client.force_authenticate(user=self.user)

		response = self.client.post(
			"/api/reviews/",
			{"product": self.product.id, "rating": 4, "comment": "Good"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Review.objects.filter(user=self.user, product=self.product).count(), 1)

	def test_cannot_review_same_product_twice(self):
		self._create_order_with_status(self.user, "DELIVERED")
		Review.objects.create(user=self.user, product=self.product, rating=5, comment="Nice")
		self.client.force_authenticate(user=self.user)

		response = self.client.post(
			"/api/reviews/",
			{"product": self.product.id, "rating": 3, "comment": "Again"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("already", str(response.data).lower())

	def test_public_list_shows_only_approved_reviews(self):
		approved = Review.objects.create(
			user=self.user,
			product=self.product,
			rating=5,
			comment="Approved",
			is_approved=True,
		)
		Review.objects.create(
			user=self.other_user,
			product=self.product,
			rating=2,
			comment="Hidden",
			is_approved=False,
		)

		response = self.client.get("/api/reviews/", {"product": self.product.id})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		data = response.data.get("results", response.data)
		ids = [item["id"] for item in data]
		self.assertIn(approved.id, ids)
		self.assertEqual(len(ids), 1)

	def test_cannot_change_product_on_review_update(self):
		self._create_order_with_status(self.user, "DELIVERED")
		review = Review.objects.create(user=self.user, product=self.product, rating=5, comment="Great")
		self.client.force_authenticate(user=self.user)

		response = self.client.patch(
			f"/api/reviews/my/{review.id}/",
			{"product": self.product_two.id, "comment": "Updated"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("product", response.data)


class ReviewThrottleTests(APITestCase):
	def setUp(self):
		cache.clear()
		self._old_throttle_rates = deepcopy(ScopedRateThrottle.THROTTLE_RATES)
		ScopedRateThrottle.THROTTLE_RATES = {
			**ScopedRateThrottle.THROTTLE_RATES,
			"review_update": "2/min",
		}
		self.user = User.objects.create_user(
			username="review-throttle",
			email="review-throttle@example.com",
			password="StrongPass123!",
			role="CUSTOMER",
		)
		category = Category.objects.create(name="Laptops", slug="laptops")
		self.product = Product.objects.create(
			category=category,
			name="Laptop Z",
			slug="laptop-z",
			description="Laptop",
			price=200,
			stock=5,
			is_active=True,
		)
		order = Order.objects.create(
			user=self.user,
			status=Order.Status.DELIVERED,
			shipping_address="Dhaka",
			billing_address="Dhaka",
			total_amount=200,
		)
		OrderItem.objects.create(
			order=order,
			product=self.product,
			product_name=self.product.name,
			unit_price=200,
			quantity=1,
		)
		self.review = Review.objects.create(user=self.user, product=self.product, rating=5, comment="Nice")
		self.client.force_authenticate(user=self.user)

	def tearDown(self):
		ScopedRateThrottle.THROTTLE_RATES = self._old_throttle_rates
		cache.clear()

	def test_review_update_requests_are_throttled(self):
		for index in range(2):
			response = self.client.patch(
				f"/api/reviews/my/{self.review.id}/",
				{"comment": f"Update {index}"},
				format="json",
			)
			self.assertEqual(response.status_code, status.HTTP_200_OK)

		throttled = self.client.patch(
			f"/api/reviews/my/{self.review.id}/",
			{"comment": "Too many"},
			format="json",
		)

		self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
