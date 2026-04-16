from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import timedelta
from accounts.models import PasswordResetToken
from accounts.serializers import (
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordChangeSerializer,
)

User = get_user_model()


class PasswordResetRequestSerializerTest(TestCase):
    """Test PasswordResetRequestSerializer"""

    def test_valid_email(self):
        """Test serializer with valid email"""
        serializer = PasswordResetRequestSerializer(data={"email": "test@example.com"})
        self.assertTrue(serializer.is_valid())

    def test_invalid_email_format(self):
        """Test serializer with invalid email format"""
        serializer = PasswordResetRequestSerializer(data={"email": "not-an-email"})
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_missing_email(self):
        """Test serializer with missing email"""
        serializer = PasswordResetRequestSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)


class PasswordResetConfirmSerializerTest(TestCase):
    """Test PasswordResetConfirmSerializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="oldpass123",
        )

    def test_valid_token_and_password(self):
        """Test with valid token and password"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        data = {
            "token": token,
            "new_password": "newpass123456"
        }
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_invalid_token(self):
        """Test with invalid token"""
        data = {
            "token": "invalid-token-123",
            "new_password": "newpass123456"
        }
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_expired_token(self):
        """Test with expired token"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() - timedelta(hours=1)
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        data = {
            "token": token,
            "new_password": "newpass123456"
        }
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())

    def test_short_password(self):
        """Test with password less than 8 characters"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        data = {
            "token": token,
            "new_password": "short"
        }
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("new_password", serializer.errors)

    def test_save_resets_password(self):
        """Test that saving resets the user's password"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        data = {
            "token": token,
            "new_password": "newpass123456"
        }
        serializer = PasswordResetConfirmSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        
        user = serializer.save()
        self.assertTrue(user.check_password("newpass123456"))
        self.assertFalse(user.check_password("oldpass123"))


class PasswordChangeSerializerTest(TestCase):
    """Test PasswordChangeSerializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="oldpass123",
        )
        self.request = type('Request', (), {'user': self.user})()

    def test_valid_password_change(self):
        """Test valid password change"""
        data = {
            "old_password": "oldpass123",
            "new_password": "newpass123456"
        }
        serializer = PasswordChangeSerializer(
            data=data,
            context={'request': self.request}
        )
        self.assertTrue(serializer.is_valid())

    def test_incorrect_old_password(self):
        """Test with incorrect old password"""
        data = {
            "old_password": "wrongpass",
            "new_password": "newpass123456"
        }
        serializer = PasswordChangeSerializer(
            data=data,
            context={'request': self.request}
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("old_password", serializer.errors)

    def test_short_new_password(self):
        """Test with new password less than 8 characters"""
        data = {
            "old_password": "oldpass123",
            "new_password": "short"
        }
        serializer = PasswordChangeSerializer(
            data=data,
            context={'request': self.request}
        )
        self.assertFalse(serializer.is_valid())


class PasswordResetAPITest(APITestCase):
    """Test password reset API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )

    def test_password_reset_request_valid_email(self):
        """Test password reset request with valid email"""
        response = self.client.post(
            "/api/accounts/password-reset/",
            {"email": "test@example.com"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)

    def test_password_reset_request_nonexistent_email(self):
        """Test password reset request with nonexistent email (should not leak info)"""
        response = self.client.post(
            "/api/accounts/password-reset/",
            {"email": "nonexistent@example.com"},
            format="json"
        )
        # Should return success for security (don't reveal if email exists)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_token_created(self):
        """Test that reset token is created"""
        self.client.post(
            "/api/accounts/password-reset/",
            {"email": "test@example.com"},
            format="json"
        )
        
        # Verify token was created
        tokens = PasswordResetToken.objects.filter(user=self.user)
        self.assertEqual(tokens.count(), 1)
        self.assertFalse(tokens.first().used)

    def test_password_reset_confirm_valid(self):
        """Test password reset confirmation with valid token"""
        # Create a reset token
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        # Confirm reset
        response = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {
                "token": token,
                "new_password": "newpass123456"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("detail", response.data)
        
        # Verify password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass123456"))

    def test_password_reset_confirm_invalid_token(self):
        """Test password reset confirmation with invalid token"""
        response = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {
                "token": "invalid-token",
                "new_password": "newpass123456"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_confirm_expired_token(self):
        """Test password reset confirmation with expired token"""
        # Create an expired reset token
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() - timedelta(hours=1)
        PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        response = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {
                "token": token,
                "new_password": "newpass123456"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_used_only_once(self):
        """Test that reset token can only be used once"""
        # Create a reset token
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )

        # Use it once
        self.client.post(
            "/api/accounts/password-reset/confirm/",
            {
                "token": token,
                "new_password": "newpass123456"
            },
            format="json"
        )

        # Try to use it again
        response = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {
                "token": token,
                "new_password": "anotherpass123"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PasswordChangeAPITest(APITestCase):
    """Test password change API endpoint"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="oldpass123",
        )

    def test_password_change_authenticated(self):
        """Test password change for authenticated user"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.post(
            "/api/accounts/me/change-password/",
            {
                "old_password": "oldpass123",
                "new_password": "newpass123456"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify password changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass123456"))

    def test_password_change_unauthenticated(self):
        """Test password change without authentication"""
        response = self.client.post(
            "/api/accounts/me/change-password/",
            {
                "old_password": "oldpass123",
                "new_password": "newpass123456"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change_wrong_old_password(self):
        """Test password change with wrong old password"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.post(
            "/api/accounts/me/change-password/",
            {
                "old_password": "wrongpass",
                "new_password": "newpass123456"
            },
            format="json"
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
