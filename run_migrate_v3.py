import os
import sys
import django
from django.core.management import call_command

# Set DJANGO_SETTINGS_MODULE
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

# Add backend to PYTHONPATH
sys.path.append(os.path.join(os.getcwd(), 'backend'))

django.setup()

print("Running migrations...")
try:
    call_command('migrate', verbosity=3)
    print("Migrations completed successfully.")
except Exception as e:
    print(f"Error running migrations: {e}")
    import traceback
    traceback.print_exc()
