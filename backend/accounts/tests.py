from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class RegisterAPITests(APITestCase):
	def test_register_without_username_generates_one(self):
		payload = {
			"email": "newuser@example.com",
			"password": "StrongPass123!",
			"first_name": "New",
			"last_name": "User",
		}

		response = self.client.post("/api/accounts/register/", payload, format="json")

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		user = User.objects.get(email="newuser@example.com")
		self.assertTrue(user.username.startswith("newuser"))
		self.assertEqual(user.first_name, "New")
		self.assertEqual(user.last_name, "User")

	def test_register_with_explicit_username_keeps_it(self):
		payload = {
			"username": "customname",
			"email": "named@example.com",
			"password": "StrongPass123!",
			"first_name": "Named",
			"last_name": "User",
		}

		response = self.client.post("/api/accounts/register/", payload, format="json")

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		user = User.objects.get(email="named@example.com")
		self.assertEqual(user.username, "customname")

	def test_login_with_email_returns_tokens_and_user(self):
		User.objects.create_user(
			username="loginuser",
			email="login@example.com",
			password="StrongPass123!",
			first_name="Login",
			last_name="User",
		)

		response = self.client.post(
			"/api/auth/token/",
			{"email": "login@example.com", "password": "StrongPass123!"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("access", response.data)
		self.assertIn("refresh", response.data)
		self.assertIn("user", response.data)
		self.assertEqual(response.data["user"]["email"], "login@example.com")
