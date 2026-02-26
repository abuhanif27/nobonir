from django.contrib.auth import get_user_model
from django.test import TestCase

from ai_engine.services.recommendation_service import (
	get_personalized_recommendations_for_user,
	get_recommendations_for_user,
	train_user_preference_model,
)
from ai_engine.models import UserPreference
from ai_engine.services.search_service import semantic_product_search
from cart.models import WishlistItem
from products.models import Category, Product

User = get_user_model()


class AIRecommendationTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="customer3", email="c3@example.com", password="Secret123!")
		category = Category.objects.create(name="Home", slug="home")
		self.p1 = Product.objects.create(category=category, name="Lamp", slug="lamp", description="smart lamp", price=20, stock=10)
		self.p2 = Product.objects.create(category=category, name="Fan", slug="fan", description="quiet fan", price=30, stock=10)
		self.p3 = Product.objects.create(category=category, name="Heater", slug="heater", description="room heater", price=40, stock=10)
		WishlistItem.objects.create(user=self.user, product=self.p1)

	def test_recommendations_returns_products(self):
		results = get_recommendations_for_user(self.user, limit=2)
		self.assertGreaterEqual(len(results), 1)

	def test_personalized_recommendations_include_in_stock_only(self):
		self.p2.stock = 0
		self.p2.save(update_fields=["stock"])
		results = get_personalized_recommendations_for_user(self.user, limit=5)
		self.assertTrue(all(product.stock > 0 for product in results))

	def test_training_creates_weights(self):
		preference, _ = UserPreference.objects.get_or_create(user=self.user)
		preference.preferred_categories.set([self.p1.category])
		trained = train_user_preference_model(self.user)
		self.assertTrue(bool(trained.trained_category_weights))


class AISearchTests(TestCase):
	def setUp(self):
		category = Category.objects.create(name="Electronics", slug="electronics")
		self.fan = Product.objects.create(
			category=category,
			name="Quiet Fan",
			slug="quiet-fan",
			description="Low-noise cooling fan for bedroom",
			price=30,
			stock=10,
		)
		self.camera = Product.objects.create(
			category=category,
			name="Camera",
			slug="camera",
			description="Digital camera for travel",
			price=200,
			stock=10,
		)

	def test_semantic_search_prioritizes_relevant_products(self):
		results = semantic_product_search("quiet cooling fan", limit=2)
		self.assertGreaterEqual(len(results), 1)
		self.assertEqual(results[0].id, self.fan.id)

	def test_search_api_accepts_query_parameter_alias(self):
		response = self.client.get("/api/ai/search/", {"query": "quiet fan"})
		self.assertEqual(response.status_code, 200)
		self.assertGreaterEqual(len(response.json()), 1)
