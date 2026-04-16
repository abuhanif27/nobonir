# Password Reset & Email System Documentation

## Overview

This document describes the real-world forgot password and email notification system implemented in Nobonir. The system provides:

- Secure password reset tokens
- HTML and plain text email templates
- Multiple SMTP backend support
- SendGrid integration ready
- Comprehensive logging
- Error handling and fallbacks

## Architecture

### Components

1. **EmailService** (`accounts/services/email_service.py`)
   - Central service for sending all emails
   - Template rendering with context
   - Error handling and logging
   - Support for multiple email types

2. **Email Templates** (`accounts/templates/emails/`)
   - HTML and text versions of each email
   - Professional, responsive design
   - Security-focused messaging

3. **Models & Views**
   - `PasswordResetToken` - Secure reset tokens
   - `PasswordResetRequestAPIView` - Initiate password reset
   - `PasswordResetConfirmAPIView` - Confirm reset with token
   - `PasswordChangeAPIView` - Change password for authenticated users

## Configuration

### Environment Variables

Set these in your `.env` file:

```env
# Email Backend Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@nobonir.com

# Frontend Configuration
FRONTEND_BASE_URL=http://localhost:5173

# Password Reset Configuration
PASSWORD_RESET_TOKEN_EXPIRY_HOURS=24
```

### Email Backend Options

#### 1. Gmail SMTP (Development/Production)

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

**Setup Instructions:**
1. Enable 2-factor authentication in Gmail
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character password as `EMAIL_HOST_PASSWORD`

#### 2. SendGrid (Recommended for Production)

```env
EMAIL_BACKEND=sendgrid_backend.SendgridBackend
SENDGRID_API_KEY=your-sendgrid-api-key
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
```

Install the backend:
```bash
pip install django-sendgrid-v5
```

Add to `INSTALLED_APPS`:
```python
INSTALLED_APPS = [
    ...
    'sendgrid_backend',
]
```

#### 3. Console Backend (Development/Testing)

```env
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

Emails are printed to console instead of being sent.

#### 4. File Backend (Development/Testing)

```env
EMAIL_BACKEND=django.core.mail.backends.filebased.EmailBackend
EMAIL_FILE_PATH=/tmp/app-messages
```

Emails are saved to files.

## API Endpoints

### 1. Request Password Reset

**Endpoint:** `POST /api/accounts/password-reset/`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "detail": "If an account exists with this email, you will receive a password reset link."
}
```

**Notes:**
- Returns success regardless of whether email exists (security practice)
- Email contains reset link valid for 24 hours
- Token is single-use only

### 2. Confirm Password Reset

**Endpoint:** `POST /api/accounts/password-reset/confirm/`

**Request:**
```json
{
  "token": "reset-token-from-email",
  "new_password": "NewSecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "detail": "Password has been reset successfully. You can now login with your new password.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username"
  }
}
```

**Error Cases:**
- Invalid token: 400 Bad Request
- Expired token: 400 Bad Request
- Short password (<8 chars): 400 Bad Request
- Token already used: 400 Bad Request

### 3. Change Password (Authenticated)

**Endpoint:** `POST /api/accounts/me/change-password/`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "old_password": "CurrentPassword123",
  "new_password": "NewPassword456"
}
```

**Response (200 OK):**
```json
{
  "detail": "Password changed successfully"
}
```

## Email Templates

### 1. Password Reset Email

**File:** `accounts/templates/emails/password_reset.html`

Contains:
- Professional gradient header
- Clear reset instructions
- Large CTA button
- Security notice about expiration
- Plain text version for fallback

**Context Variables:**
- `user` - User object
- `reset_url` - Full reset link
- `expiry_hours` - Token expiration time
- `app_name` - Application name
- `support_email` - Support contact

### 2. Password Changed Confirmation

**File:** `accounts/templates/emails/password_changed.html`

Contains:
- Success confirmation
- Security tips
- Account compromise notice
- Support contact information

### 3. Welcome Email

**File:** `accounts/templates/emails/welcome.html`

Contains:
- Warm welcome message
- Feature highlights
- Optional email verification link
- Call-to-action button
- Getting started tips

## Email Service API

### EmailService Class

#### `send_password_reset_email(user, reset_token, expiry_hours=24)`

Sends password reset email.

**Parameters:**
- `user` (User): User instance
- `reset_token` (str): Reset token string
- `expiry_hours` (int): Token expiration hours

**Returns:** `bool` - True if sent successfully

**Example:**
```python
from accounts.services.email_service import EmailService

success = EmailService.send_password_reset_email(
    user=user,
    reset_token=token,
    expiry_hours=24
)
```

#### `send_password_changed_confirmation(user)`

Sends password change confirmation email.

**Parameters:**
- `user` (User): User instance

**Returns:** `bool` - True if sent successfully

#### `send_welcome_email(user, verification_token=None)`

Sends welcome email to new user.

**Parameters:**
- `user` (User): User instance
- `verification_token` (str, optional): Email verification token

**Returns:** `bool` - True if sent successfully

## Frontend Integration

### Password Reset Page

Located at: `frontend/src/pages/PasswordResetPage.tsx`

1. User enters email address
2. Click "Send Reset Link"
3. API creates token and sends email
4. User receives email with reset link

### Password Reset Confirm Page

Located at: `frontend/src/pages/PasswordResetConfirmPage.tsx`

1. User clicks reset link from email
2. Extracted token from URL
3. User enters new password
4. Click "Reset Password"
5. API confirms token and updates password

## Security Features

### 1. Token Security

- Cryptographically secure random tokens
- 32-byte (256-bit) tokens using `secrets.token_urlsafe()`
- Single-use tokens (marked as used after reset)
- 24-hour expiration (configurable)
- Database-indexed for fast lookup

### 2. Email Privacy

- Never reveals if email exists (security practice)
- Generic response for both existing and non-existing emails
- Prevents email enumeration attacks

### 3. Password Validation

- Minimum 8 characters required
- Django's password validators applied
- Password confirmation matching
- No password reuse in same request

### 4. Rate Limiting

- Throttling on password reset requests
- Protection against brute force attempts
- Configurable via Django REST Framework

### 5. Logging

- All email sends logged
- Failed email attempts logged with errors
- User ID and email tracked for security audit
- Exceptions logged with full traceback

## Testing

### Running Tests

```bash
python manage.py test accounts.test_password_reset
python manage.py test accounts.test_api_password_reset
python manage.py test accounts.services.test_email_service
```

### Email Testing in Development

#### Using Console Backend

Emails appear in Django console output:

```
Message-ID: <...>
Subject: Password Reset Request
From: noreply@nobonir.com
To: user@example.com
Date: ...

Hi John,

We received a request to reset your password...
```

#### Using File Backend

Emails saved to `/tmp/app-messages/`:

```bash
ls -la /tmp/app-messages/
cat /tmp/app-messages/20260416-113045-abc123.txt
```

#### Using Mailtrap (Recommended)

1. Sign up at https://mailtrap.io
2. Create a new inbox
3. Update settings:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=465
EMAIL_USE_TLS=false
EMAIL_HOST_USER=your-mailtrap-username
EMAIL_HOST_PASSWORD=your-mailtrap-password
```

4. All emails appear in Mailtrap dashboard
5. View HTML rendering, reply simulation, etc.

## Troubleshooting

### Issue: "SMTPAuthenticationError"

**Cause:** Invalid email credentials

**Solution:**
1. Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
2. For Gmail, ensure App Password is used (not regular password)
3. Enable "Less secure app access" if needed (not recommended)

### Issue: "SMTPNotSupportedError: STARTTLS extension not supported by server"

**Cause:** EMAIL_USE_TLS=true but server doesn't support it

**Solution:**
- Set EMAIL_USE_TLS=false
- Or use SSL: set EMAIL_PORT=465 and EMAIL_USE_TLS=false, EMAIL_USE_SSL=true

### Issue: "ConnectionRefusedError"

**Cause:** Email server not reachable

**Solution:**
1. Check EMAIL_HOST is correct
2. Verify firewall allows outbound SMTP
3. Check EMAIL_PORT is correct for server
4. Test with: `telnet EMAIL_HOST EMAIL_PORT`

### Issue: Emails not being sent but no errors

**Cause:** Using console or file backend

**Solution:**
- Check Django logs
- Check console output or `/tmp/app-messages/`
- Switch to actual SMTP backend for production

## Performance Considerations

### Async Email Sending

For production, send emails asynchronously using Celery:

```python
from celery import shared_task
from accounts.services.email_service import EmailService

@shared_task
def send_password_reset_email_async(user_id, reset_token, expiry_hours=24):
    user = User.objects.get(id=user_id)
    return EmailService.send_password_reset_email(user, reset_token, expiry_hours)
```

Then in views:

```python
send_password_reset_email_async.delay(user.id, token, expiry_hours)
```

### Monitoring

Monitor email delivery:
1. Check Django logs for send failures
2. Monitor email service provider dashboard
3. Set up alerts for bounces/complaints
4. Track password reset completion rates

## Best Practices

### 1. Email Content

- ✅ Always include clear instructions
- ✅ Provide both HTML and text versions
- ✅ Include expiration time prominently
- ✅ Add security notices
- ✅ Include support contact

### 2. User Experience

- ✅ Send reset link immediately
- ✅ Make reset process simple (one click)
- ✅ Clear error messages if token invalid
- ✅ Option to request new link
- ✅ Redirect to login after successful reset

### 3. Security

- ✅ Use cryptographically secure tokens
- ✅ Implement short expiration times (24h recommended)
- ✅ Single-use tokens only
- ✅ Never reveal if email exists
- ✅ Log all password changes
- ✅ Log failed reset attempts
- ✅ Implement rate limiting

### 4. Reliability

- ✅ Handle email failures gracefully
- ✅ Log all email operations
- ✅ Test all email templates
- ✅ Monitor email delivery rates
- ✅ Have fallback email addresses
- ✅ Implement retry logic for failures

## Future Enhancements

1. **Email Verification**
   - Verify email ownership during registration
   - Re-send verification if needed

2. **Two-Factor Authentication**
   - Code sent via email for extra security
   - WebAuthn/FIDO2 support

3. **Account Recovery**
   - Recovery codes generation
   - Backup email addresses

4. **Email Preferences**
   - Users control which emails they receive
   - Unsubscribe management
   - Frequency preferences

5. **SMS Integration**
   - SMS password reset option
   - SMS OTP verification

6. **Internationalization**
   - Email templates in multiple languages
   - User locale preferences

## Support

For issues or questions:
- Check logs: `django-nobonir.log`
- Review error messages in response
- Test with Mailtrap
- Enable DEBUG mode temporarily
- Check email service provider status
