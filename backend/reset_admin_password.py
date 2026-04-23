#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# Get admin user
admin = User.objects.filter(email='admin@nobonir.com').first()

if admin:
    admin.set_password('admin@1234')
    admin.save()
    print(f"✓ Password reset successfully!")
    print(f"  Email: {admin.email}")
    print(f"  Username: {admin.username}")
    print(f"  New password: admin@1234")
    
    # Verify
    if admin.check_password('admin@1234'):
        print(f"✓ Password verified - login should now work")
    else:
        print(f"✗ Verification failed")
else:
    print("✗ Admin user not found")
