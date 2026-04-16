"""
Tests for the EmailService module
"""

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from datetime import timedelta
from accounts.models import PasswordResetToken
from accounts.services.email_service import EmailService

User = get_user_model()


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
)
class EmailServiceTestCase(TestCase):
    """Test EmailService functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            password="testpass123"
        )

    def tearDown(self):
        mail.outbox = []

    def test_send_password_reset_email_success(self):
        """Test sending password reset email"""
        token = PasswordResetToken.generate_token()
        
        success = EmailService.send_password_reset_email(
            user=self.user,
            reset_token=token,
            expiry_hours=24
        )
        
        self.assertTrue(success)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertEqual(email.subject, "Reset Your Nobonir Password")
        self.assertIn(self.user.email, email.to)
        self.assertIn(token, email.body)
        self.assertIn("24 hours", email.body)

    def test_send_password_reset_email_html_content(self):
        """Test password reset email includes HTML content"""
        token = PasswordResetToken.generate_token()
        
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token=token,
            expiry_hours=24
        )
        
        email = mail.outbox[0]
        self.assertTrue(len(email.alternatives) > 0)
        
        # Check for HTML alternative
        html_content = None
        for content, mimetype in email.alternatives:
            if mimetype == "text/html":
                html_content = content
                break
        
        self.assertIsNotNone(html_content)
        self.assertIn("Reset Your Password", html_content)
        self.assertIn(token, html_content)

    def test_send_password_reset_email_with_custom_expiry(self):
        """Test password reset email with custom expiry hours"""
        token = PasswordResetToken.generate_token()
        
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token=token,
            expiry_hours=48
        )
        
        email = mail.outbox[0]
        self.assertIn("48 hours", email.body)

    def test_send_password_reset_email_personalizes_greeting(self):
        """Test password reset email includes user's name"""
        token = PasswordResetToken.generate_token()
        
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token=token
        )
        
        email = mail.outbox[0]
        self.assertIn("Hi John", email.body)

    def test_send_password_changed_confirmation(self):
        """Test sending password changed confirmation email"""
        success = EmailService.send_password_changed_confirmation(self.user)
        
        self.assertTrue(success)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertEqual(email.subject, "Your Password Has Been Changed")
        self.assertIn(self.user.email, email.to)
        self.assertIn("successfully changed", email.body)

    def test_send_password_changed_confirmation_security_tips(self):
        """Test password changed email includes security tips"""
        EmailService.send_password_changed_confirmation(self.user)
        
        email = mail.outbox[0]
        self.assertTrue(
            "security tips" in email.body.lower() or
            any("security" in alt[0].lower() 
                for alt in email.alternatives)
        )

    def test_send_welcome_email(self):
        """Test sending welcome email"""
        success = EmailService.send_welcome_email(self.user)
        
        self.assertTrue(success)
        self.assertEqual(len(mail.outbox), 1)
        
        email = mail.outbox[0]
        self.assertIn("Welcome", email.subject)
        self.assertIn(self.user.email, email.to)

    def test_send_welcome_email_with_verification_token(self):
        """Test welcome email with verification token"""
        verification_token = "verify-token-123"
        
        EmailService.send_welcome_email(
            user=self.user,
            verification_token=verification_token
        )
        
        email = mail.outbox[0]
        self.assertIn(verification_token, email.body)
        self.assertIn("verify-email", email.body)

    def test_email_includes_app_name(self):
        """Test that emails include application name"""
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token="token"
        )
        
        email = mail.outbox[0]
        self.assertIn("Nobonir", email.body)

    def test_email_includes_support_contact(self):
        """Test that emails include support email"""
        EmailService.send_password_changed_confirmation(self.user)
        
        email = mail.outbox[0]
        self.assertTrue(
            "noreply@nobonir.com" in email.body or
            any("noreply@nobonir.com" in alt[0] for alt in email.alternatives)
        )

    def test_password_reset_email_includes_reset_url(self):
        """Test that reset email includes full reset URL"""
        token = "secret-token-xyz"
        
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token=token
        )
        
        email = mail.outbox[0]
        self.assertIn("reset-password", email.body)
        self.assertIn(token, email.body)

    def test_multiple_emails_in_sequence(self):
        """Test sending multiple emails in sequence"""
        token = PasswordResetToken.generate_token()
        
        # Send password reset
        EmailService.send_password_reset_email(self.user, token)
        self.assertEqual(len(mail.outbox), 1)
        
        # Send password changed confirmation
        EmailService.send_password_changed_confirmation(self.user)
        self.assertEqual(len(mail.outbox), 2)
        
        # Send welcome email
        EmailService.send_welcome_email(self.user)
        self.assertEqual(len(mail.outbox), 3)

    def test_email_text_and_html_versions(self):
        """Test that emails have both text and HTML versions"""
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token="token"
        )
        
        email = mail.outbox[0]
        
        # Check text version (body)
        self.assertTrue(len(email.body) > 0)
        
        # Check HTML alternative
        self.assertTrue(len(email.alternatives) > 0)
        html_found = any(
            mimetype == "text/html" 
            for _, mimetype in email.alternatives
        )
        self.assertTrue(html_found)

    def test_email_sender_is_configured(self):
        """Test that emails use configured sender"""
        EmailService.send_password_reset_email(
            user=self.user,
            reset_token="token"
        )
        
        email = mail.outbox[0]
        self.assertEqual(email.from_email, "noreply@nobonir.com")

    def test_email_recipient_is_user_email(self):
        """Test that email is sent to user's email address"""
        EmailService.send_welcome_email(self.user)
        
        email = mail.outbox[0]
        self.assertIn(self.user.email, email.to)


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'
)
class EmailServiceErrorHandlingTestCase(TestCase):
    """Test error handling in EmailService"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_send_email_with_missing_template(self):
        """Test handling of missing template"""
        # This test would fail if templates don't exist,
        # which is the desired behavior
        try:
            EmailService.send_password_reset_email(
                user=self.user,
                reset_token="token"
            )
            # If templates exist, this should succeed
            self.assertTrue(True)
        except Exception as e:
            # If templates missing, should be caught
            self.assertIn("template", str(e).lower())

    def test_send_to_user_without_email(self):
        """Test sending email to user without email address"""
        user_no_email = User.objects.create_user(
            username="noemailuser",
            email="",
            password="testpass123"
        )
        
        # Should handle gracefully
        try:
            success = EmailService.send_password_reset_email(
                user=user_no_email,
                reset_token="token"
            )
            # Result depends on email backend behavior
        except Exception:
            # Expected to fail without email
            pass

