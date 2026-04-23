#!/usr/bin/env python
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()

# Create test client
client = Client()

print("\n=== TESTING ADMIN LOGIN ===\n")

# Test login with email
response = client.post(
    '/api/auth/token/',
    data=json.dumps({
        'email': 'admin@nobonir.com',
        'password': 'admin@1234'
    }),
    content_type='application/json'
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")

# Also verify user exists and password is correct
admin = User.objects.filter(email='admin@nobonir.com').first()
if admin:
    print(f"\n✓ Admin user found")
    print(f"  Email: {admin.email}")
    print(f"  Is Active: {admin.is_active}")
    print(f"  Password check: {admin.check_password('admin@1234')}")
else:
    print("\n✗ Admin user not found")
