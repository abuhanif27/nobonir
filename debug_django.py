try:
    import django
    print(f"Django version: {django.get_version()}")
except Exception as e:
    print(f"Error importing Django: {e}")
