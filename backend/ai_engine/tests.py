from django.contrib.auth import get_user_model
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient

from ai_engine.services.recommendation_service import (
	_age_category_boost,
	get_personalized_recommendations_for_user,
	get_recommendations_for_user,
	_location_category_boost,
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
		budget_category = Category.objects.create(name="Mobiles", slug="mobiles")
		expensive_category = Category.objects.create(name="Laptops", slug="laptops")
		self.product = Product.objects.create(
			category=category,
			name="Cotton Shirt",
			slug="cotton-shirt",
			description="Comfortable fit shirt",
			price=25,
			stock=10,
		)
		self.budget_product = Product.objects.create(
			category=budget_category,
			name="Budget Phone",
			slug="budget-phone",
			description="Affordable phone for everyday use",
			price=9000,
			stock=10,
		)
		self.expensive_product = Product.objects.create(
			category=expensive_category,
			name="Premium Laptop",
			slug="premium-laptop",
			description="High-end laptop for power users",
			price=85000,
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

	def test_guest_order_help_requires_sign_in(self):
		guest_client = APIClient()
		response = guest_client.post(
			"/api/ai/assistant/chat/",
			{"message": "where is my order"},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "ORDER_STATUS_HELP")
		self.assertIn("sign in", body["reply"].lower())

	def test_guest_price_stock_returns_live_database_stock(self):
		guest_client = APIClient()
		response = guest_client.post(
			"/api/ai/assistant/chat/",
			{"message": "stock and price for cotton shirt"},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "PRICE_STOCK_LOOKUP")
		for item in body.get("suggested_products", []):
			if item.get("id") == self.product.id:
				self.assertEqual(int(item.get("available_stock") or 0), int(self.product.stock))

	def test_budget_intent_returns_budget_search_or_recommendation(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "recommend shirt under 30"},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn(body["intent"], {"BUDGET_SEARCH", "RECOMMENDATION"})
		self.assertIsInstance(body["suggested_products"], list)

	def test_chat_endpoint_parses_k_budget_and_stays_within_limit(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "my budget is 10k"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "BUDGET_SEARCH")
		self.assertTrue(body["suggested_products"])
		self.assertTrue(
			all(Decimal(str(item.get("price") or 0)) <= Decimal("10000") for item in body["suggested_products"])
		)
		self.assertTrue(
			all(str(item.get("name") or "") != self.expensive_product.name for item in body["suggested_products"])
		)

	def test_chat_endpoint_matches_budget_range_from_database(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "suggest products between 8k and 10k"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn(body["intent"], {"BUDGET_SEARCH", "RECOMMENDATION"})
		self.assertTrue(body["suggested_products"])
		self.assertTrue(
			all(
				Decimal("8000") <= Decimal(str(item.get("price") or 0)) <= Decimal("10000")
				for item in body["suggested_products"]
			)
		)

	def test_chat_endpoint_budget_range_no_match_returns_clear_message(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "suggest products between 1 and 2"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn(body["intent"], {"BUDGET_SEARCH", "RECOMMENDATION"})
		self.assertEqual(body["suggested_products"], [])
		self.assertIn("couldn't find products in your budget range", body["reply"].lower())

	def test_chat_endpoint_budget_converts_from_local_currency_rate(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{
				"message": "my budget is 10000",
				"currency_code": "BDT",
				"currency_rate": "100",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "BUDGET_SEARCH")
		self.assertTrue(body["suggested_products"])
		self.assertTrue(
			all(Decimal(str(item.get("price") or 0)) <= Decimal("100") for item in body["suggested_products"])
		)

	def test_chat_endpoint_category_request_returns_matching_products(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "i want clothes"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertIn(body["intent"], {"RECOMMENDATION", "GENERAL"})
		self.assertTrue(body["suggested_products"])
		self.assertTrue(
			any(item["name"] == self.product.name for item in body["suggested_products"])
		)

	def test_chat_endpoint_how_to_order_returns_order_help(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "how to order product"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "ORDER_HELP")
		self.assertIn("add it to cart", body["reply"].lower())
		self.assertIn("checkout", body["reply"].lower())

	def test_chat_endpoint_login_help_returns_support_reply(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "how do i login"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "LOGIN_HELP")
		self.assertIn("sign in", body["reply"].lower())
		self.assertIn("reset", body["reply"].lower())

	def test_chat_endpoint_refund_help_returns_policy_reply(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "how to refund"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "REFUND_HELP")
		self.assertIn("7-day", body["reply"].lower())
		self.assertIn("admin@nobonir.com", body["reply"].lower())

	def test_chat_endpoint_policy_help_returns_store_policy(self):
		response = self.client.post(
			"/api/ai/assistant/chat/",
			{"message": "what is the policy"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		body = response.json()
		self.assertEqual(body["intent"], "POLICY_HELP")
		self.assertIn("cash on delivery", body["reply"].lower())
		self.assertIn("7-day", body["reply"].lower())

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


class AIProfilePersonalizationTests(TestCase):
	def setUp(self):
		self.user_a = User.objects.create_user(
			username="profile-a",
			email="profile-a@example.com",
			password="Secret123!",
			gender="MALE",
		)
		self.user_b = User.objects.create_user(
			username="profile-b",
			email="profile-b@example.com",
			password="Secret123!",
			gender="FEMALE",
		)

		electronics = Category.objects.create(name="Electronics", slug="electronics")
		groceries = Category.objects.create(name="Groceries", slug="groceries")
		home = Category.objects.create(name="Home", slug="home")
		fashion = Category.objects.create(name="Fashion", slug="fashion")

		Product.objects.create(
			category=electronics,
			name="Wireless Headphones",
			slug="wireless-headphones",
			description="smart audio gear",
			price=99,
			stock=10,
		)
		Product.objects.create(
			category=groceries,
			name="Organic Rice",
			slug="organic-rice",
			description="daily essentials",
			price=20,
			stock=10,
		)
		Product.objects.create(
			category=home,
			name="Kitchen Set",
			slug="kitchen-set",
			description="home and kitchen items",
			price=75,
			stock=10,
		)
		Product.objects.create(
			category=fashion,
			name="Daily Outfit",
			slug="daily-outfit",
			description="modern wear",
			price=55,
			stock=10,
		)

		UserPreference.objects.update_or_create(
			user=self.user_a,
			defaults={"age": 22, "location": "Dhaka city", "continent": "Asia"},
		)
		UserPreference.objects.update_or_create(
			user=self.user_b,
			defaults={"age": 52, "location": "Rural district village", "continent": "Africa"},
		)

	def test_age_and_location_boost_helpers(self):
		self.assertGreater(_age_category_boost(21, "Electronics"), 0)
		self.assertGreater(_age_category_boost(52, "Home"), 0)
		self.assertEqual(_age_category_boost(None, "Home"), 0)

		self.assertGreater(_location_category_boost("dhaka city asia", "Electronics"), 0)
		self.assertGreater(_location_category_boost("rural village africa", "Groceries"), 0)
		self.assertEqual(_location_category_boost("", "Groceries"), 0)

	def test_different_profiles_receive_different_rankings(self):
		train_user_preference_model(self.user_a)
		train_user_preference_model(self.user_b)

		recs_a = get_personalized_recommendations_for_user(self.user_a, limit=4)
		recs_b = get_personalized_recommendations_for_user(self.user_b, limit=4)

		self.assertGreaterEqual(len(recs_a), 2)
		self.assertGreaterEqual(len(recs_b), 2)

		top_a_categories = [product.category.name.lower() for product in recs_a[:2]]
		top_b_categories = [product.category.name.lower() for product in recs_b[:2]]

		self.assertIn("electronics", top_a_categories)
		self.assertTrue(any(category in top_b_categories for category in ("home", "groceries", "fashion")))
		self.assertNotEqual([p.id for p in recs_a[:3]], [p.id for p in recs_b[:3]])
