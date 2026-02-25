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
