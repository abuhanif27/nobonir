from django.contrib.auth import get_user_model
User = get_user_model()

# Check if admin user exists
admin = User.objects.filter(email='admin@nobonir.com').first()
if admin:
    print(f"Admin user found: {admin.email}, username: {admin.username}")
    print(f"Is active: {admin.is_active}")
    print(f"Is staff: {admin.is_staff}")
    print(f"Is superuser: {admin.is_superuser}")
    
    # Test password
    if admin.check_password('admin@1234'):
        print("✓ Password is correct")
    else:
        print("✗ Password is INCORRECT")
else:
    print("✗ Admin user not found with email admin@nobonir.com")
    print("\nAll users:")
    for user in User.objects.all():
        print(f"  - {user.email} (username: {user.username})")
