from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

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


class AIAssistantEndpointTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(
			username="assistant-user",
			email="assistant@example.com",
			password="Secret123!",
		)
		self.client.force_authenticate(user=self.user)
		category = Category.objects.create(name="Fashion", slug="fashion")
		self.product = Product.objects.create(
			category=category,
			name="Cotton Shirt",
			slug="cotton-shirt",
			description="Comfortable fit shirt",
			price=25,
			stock=10,
		)

	def test_chat_endpoint_returns_structured_payload(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "recommend a shirt"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn("reply", body)
		self.assertIn("intent", body)
		self.assertIn("session_key", body)
		self.assertIn("llm_provider", body)
		self.assertIn("llm_enhanced", body)
		self.assertIn("llm_attempts", body)
		self.assertIn("suggested_products", body)

	def test_notification_insights_endpoint_returns_array(self):
		response = self.client.get("/api/ai/assistant/notification-insights/")
		self.assertEqual(response.status_code, 200)
		self.assertIsInstance(response.json(), list)

	def test_chat_endpoint_handles_price_stock_lookup(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "what is price and stock of cotton shirt"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "PRICE_STOCK_LOOKUP")
		self.assertIn("price", body["reply"].lower())
		self.assertIn("stock", body["reply"].lower())
		if body["suggested_products"]:
			self.assertIn("available_stock", body["suggested_products"][0])

	def test_chat_endpoint_handles_top_selling_intent(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "show me top selling best product"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "TOP_SELLING")
		self.assertIn("top-selling", body["reply"].lower())
		self.assertIsInstance(body["suggested_products"], list)

	def test_chat_endpoint_supports_guest_mode(self):
		guest_client = APIClient()
		response = guest_client.post(
			"/api/ai/assistant/chat/",
			{"message": "suggest budget shirt"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn("reply", body)
		self.assertIn("session_key", body)
		self.assertIn("suggested_products", body)

	def test_history_endpoint_returns_persisted_messages_for_user(self):
		chat_response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "need shirt options"},
			format="json",
		)
		session_key = chat_response.json().get("session_key")

		history_response = self.client.get(
			"/api/ai/assistant/history/",
			{"session_key": session_key},
		)

		self.assertEqual(history_response.status_code, 200)
		history_body = history_response.json()
		self.assertEqual(history_body["session_key"], session_key)
		self.assertGreaterEqual(len(history_body["messages"]), 2)
		self.assertEqual(history_body["messages"][0]["role"], "user")

	def test_history_endpoint_returns_persisted_messages_for_guest(self):
		guest_client = APIClient()
		chat_response = guest_client.post(
			"/api/ai/assistant/chat/",
			{"message": "budget t shirt"},
			format="json",
		)
		session_key = chat_response.json().get("session_key")

		history_response = guest_client.get(
			"/api/ai/assistant/history/",
			{"session_key": session_key},
		)

		self.assertEqual(history_response.status_code, 200)
		history_body = history_response.json()
		self.assertEqual(history_body["session_key"], session_key)
		self.assertGreaterEqual(len(history_body["messages"]), 2)

	def test_history_endpoint_can_clear_conversation(self):
		chat_response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "remember this conversation"},
			format="json",
		)
		session_key = chat_response.json().get("session_key")

		clear_response = self.client.delete(
			"/api/ai/assistant/history/",
			{"session_key": session_key},
		)
		self.assertEqual(clear_response.status_code, 200)
		next_session_key = clear_response.json().get("session_key")
		self.assertTrue(next_session_key)

		history_response = self.client.get(
			"/api/ai/assistant/history/",
			{"session_key": next_session_key},
		)
		self.assertEqual(history_response.status_code, 200)
		self.assertEqual(len(history_response.json().get("messages", [])), 0)

	def test_runtime_status_endpoint_returns_provider_chain(self):
		response = self.client.get("/api/ai/assistant/status/")
		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn("enabled", body)
		self.assertIn("providers", body)
		self.assertIn("timeout_seconds", body)
		self.assertIn("test_mode", body)
