#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Check if admin user exists
admin = User.objects.filter(email='admin@nobonir.com').first()

print("\n=== ADMIN USER CHECK ===\n")

if admin:
    print(f"✓ Admin user found")
    print(f"  Email: {admin.email}")
    print(f"  Username: {admin.username}")
    print(f"  Is Active: {admin.is_active}")
    print(f"  Is Staff: {admin.is_staff}")
    print(f"  Is Superuser: {admin.is_superuser}")
    
    # Test password
    if admin.check_password('admin@1234'):
        print(f"✓ Password is CORRECT")
    else:
        print(f"✗ Password is INCORRECT")
else:
    print("✗ Admin user NOT found with email admin@nobonir.com")
    print("\nAll users in database:")
    users = User.objects.all()
    if users.exists():
        for user in users:
            print(f"  - Email: {user.email}, Username: {user.username}, Active: {user.is_active}, Staff: {user.is_staff}")
    else:
        print("  (No users found)")

print("\n")
