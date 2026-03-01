import subprocess
import os
import sys

# Set DJANGO_SETTINGS_MODULE
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

# Add backend to PYTHONPATH
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print(f"Current directory: {os.getcwd()}")
print(f"PYTHONPATH: {sys.path}")
print(f"DJANGO_SETTINGS_MODULE: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

try:
    result = subprocess.run(
        [sys.executable, 'backend/manage.py', 'migrate'],
        capture_output=True,
        text=True,
        check=True
    )
    print("STDOUT:")
    print(result.stdout)
    print("STDERR:")
    print(result.stderr)
except subprocess.CalledProcessError as e:
    print(f"Error running migrate: {e}")
    print("STDOUT:")
    print(e.stdout)
    print("STDERR:")
    print(e.stderr)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
