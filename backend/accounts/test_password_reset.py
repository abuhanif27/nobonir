from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from accounts.models import PasswordResetToken

User = get_user_model()


class PasswordResetTokenModelTest(TestCase):
    """Test PasswordResetToken model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )

    def test_generate_token(self):
        """Test token generation creates unique secure tokens"""
        token1 = PasswordResetToken.generate_token()
        token2 = PasswordResetToken.generate_token()
        
        self.assertNotEqual(token1, token2)
        self.assertGreater(len(token1), 20)
        self.assertGreater(len(token2), 20)

    def test_create_reset_token(self):
        """Test creating a password reset token"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )
        
        self.assertEqual(reset_token.user, self.user)
        self.assertEqual(reset_token.token, token)
        self.assertFalse(reset_token.used)
        self.assertIsNone(reset_token.used_at)

    def test_is_valid_not_expired(self):
        """Test valid token that hasn't expired"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )
        
        self.assertTrue(reset_token.is_valid())

    def test_is_valid_expired(self):
        """Test invalid token that has expired"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() - timedelta(hours=1)
        
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )
        
        self.assertFalse(reset_token.is_valid())

    def test_is_valid_already_used(self):
        """Test invalid token that has already been used"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at,
            used=True,
            used_at=timezone.now()
        )
        
        self.assertFalse(reset_token.is_valid())

    def test_mark_used(self):
        """Test marking token as used"""
        token = PasswordResetToken.generate_token()
        expires_at = timezone.now() + timedelta(hours=24)
        
        reset_token = PasswordResetToken.objects.create(
            user=self.user,
            token=token,
            expires_at=expires_at
        )
        
        self.assertFalse(reset_token.used)
        reset_token.mark_used()
        
        self.assertTrue(reset_token.used)
        self.assertIsNotNone(reset_token.used_at)
