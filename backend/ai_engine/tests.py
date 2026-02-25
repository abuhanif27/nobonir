from django.contrib.auth import get_user_model
from django.test import TestCase

from ai_engine.services.recommendation_service import get_recommendations_for_user
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
