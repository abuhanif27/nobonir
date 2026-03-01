import os
import sys

# Set DJANGO_SETTINGS_MODULE
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

# Add backend to PYTHONPATH
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    import django
    django.setup()
    from django.conf import settings
    print(f"DEBUG: {settings.DEBUG}")
    print(f"DATABASES: {settings.DATABASES}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
