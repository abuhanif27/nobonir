import os
import sys
import django
from django.core.management import call_command

# Set DJANGO_SETTINGS_MODULE
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

# Add backend to PYTHONPATH
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

print("Starting Django development server...")
try:
    call_command('runserver', '127.0.0.1:8000', use_reloader=False)
except Exception as e:
    print(f"Error starting server: {e}")
    import traceback
    traceback.print_exc()
