from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
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

	def test_me_endpoint_requires_authentication(self):
		response = self.client.get("/api/accounts/me/")
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
		self.assertIn("X-Request-ID", response)

	def test_security_headers_present_on_api_response(self):
		response = self.client.get("/api/accounts/me/")
		self.assertEqual(response["X-Frame-Options"], "DENY")
		self.assertEqual(response["X-Content-Type-Options"], "nosniff")


class ProfileSecurityTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="profileuser",
			email="profile@example.com",
			password="StrongPass123!",
		)
		self.client.force_authenticate(user=self.user)

	def test_rejects_non_image_profile_upload(self):
		payload = {
			"profile_picture": SimpleUploadedFile(
				"payload.txt",
				b"not-an-image",
				content_type="text/plain",
			)
		}
		response = self.client.patch("/api/accounts/me/", payload, format="multipart")
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("profile_picture", response.data)


class AdminUserGuardTests(APITestCase):
	def setUp(self):
		self.main_admin = User.objects.create_user(
			username="mainadmin",
			email="mainadmin@example.com",
			password="StrongPass123!",
			role="ADMIN",
			is_active=True,
			is_staff=True,
			is_superuser=True,
		)
		self.client.force_authenticate(user=self.main_admin)

	def test_cannot_deactivate_last_main_admin(self):
		response = self.client.patch(
			f"/api/accounts/users/{self.main_admin.id}/",
			{"role": "CUSTOMER"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("required", response.data.get("detail", "").lower())

	def test_can_deactivate_main_admin_when_another_exists(self):
		other_admin = User.objects.create_user(
			username="otheradmin",
			email="otheradmin@example.com",
			password="StrongPass123!",
			role="ADMIN",
			is_active=True,
			is_staff=True,
			is_superuser=True,
		)

		response = self.client.patch(
			f"/api/accounts/users/{other_admin.id}/",
			{"is_active": False},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)

	def test_non_super_admin_cannot_demote_admin_user(self):
		non_super_admin = User.objects.create_user(
			username="opsadmin",
			email="opsadmin@example.com",
			password="StrongPass123!",
			role="ADMIN",
			is_active=True,
			is_staff=True,
			is_superuser=False,
		)
		target_admin = User.objects.create_user(
			username="targetadmin",
			email="targetadmin@example.com",
			password="StrongPass123!",
			role="ADMIN",
			is_active=True,
			is_staff=True,
			is_superuser=True,
		)

		self.client.force_authenticate(user=non_super_admin)
		response = self.client.patch(
			f"/api/accounts/users/{target_admin.id}/",
			{"role": "CUSTOMER"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertIn("super admin", response.data.get("detail", "").lower())

	def test_customer_cannot_access_admin_user_list(self):
		customer = User.objects.create_user(
			username="custonly",
			email="custonly@example.com",
			password="StrongPass123!",
			role="CUSTOMER",
		)
		self.client.force_authenticate(user=customer)
		response = self.client.get("/api/accounts/users/")
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
