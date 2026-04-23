# Email Setup Guide for Nobonir

## Overview
The password reset and email notification features require an SMTP email server. This guide shows how to set it up.

## Quick Setup Options

### Option 1: Gmail (Recommended for Development)

**Step 1: Enable 2-Factor Authentication**
1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable 2-Step Verification if not already enabled

**Step 2: Create an App Password**
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer"
3. Google will generate a 16-character password
4. Copy this password

**Step 3: Add to .env**
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_PORT=587
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=noreply@nobonir.com
```

**Step 4: Restart Django Server**
```bash
cd backend
python manage.py runserver 127.0.0.1:8000 --noreload
```

### Option 2: Mailtrap (Free Tier - No Real Email Sending)

Perfect for development since emails don't get sent to real inboxes.

**Step 1: Sign Up**
1. Go to [mailtrap.io](https://mailtrap.io)
2. Create a free account
3. Go to your inbox settings

**Step 2: Copy SMTP Credentials**
Copy the following from Mailtrap:
- Username
- Password
- Host
- Port

**Step 3: Add to .env**
```env
EMAIL_HOST=smtp.mailtrap.io
EMAIL_HOST_USER=your_mailtrap_username
EMAIL_HOST_PASSWORD=your_mailtrap_password
EMAIL_PORT=2525
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=noreply@nobonir.com
```

**Step 4: Restart Django**
```bash
cd backend
python manage.py runserver 127.0.0.1:8000 --noreload
```

### Option 3: SendGrid (Production-Ready)

**Step 1: Create Account**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Go to API Keys in settings
3. Create a new API key

**Step 2: Add to .env**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=your-sendgrid-api-key
EMAIL_PORT=587
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=noreply@nobonir.com
```

## Testing Email

### Test 1: Password Reset
1. Go to http://127.0.0.1:5173/password-reset
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email inbox (or Mailtrap/Gmail)
5. Click the reset link to change your password

### Test 2: Manual Email Test
```bash
cd backend
python manage.py shell
```

```python
from django.core.mail import send_mail
send_mail(
    subject='Test Email',
    message='This is a test email from Nobonir',
    from_email='noreply@nobonir.com',
    recipient_list=['your-email@example.com'],
    fail_silently=False,
)
```

## Troubleshooting

### "SMTPAuthenticationError"
- Wrong email/password credentials
- Gmail app password (not regular password) is required for Gmail
- Check .env file for typos

### "SMTPException: SMTP AUTH extension not supported by server"
- Make sure EMAIL_USE_TLS=true

### Email not sending
- Check that EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are set
- Run Django server again after changing .env
- Check Django server logs for errors

### Can't find password reset email
- Check your spam/junk folder
- For Mailtrap: check the inbox in your Mailtrap dashboard
- For Gmail: check "All Mail" folder

## Production Deployment

For production:
1. Use SendGrid, AWS SES, or Mailgun
2. Never commit .env file to git
3. Use environment variables on your hosting provider
4. Set EMAIL_BACKEND to production SMTP backend
5. Ensure your domain is verified with the email service
