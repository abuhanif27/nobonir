import subprocess
import os
import sys

# Set DJANGO_SETTINGS_MODULE
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'

# Add backend to PYTHONPATH
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print(f"Current directory: {os.getcwd()}")

process = subprocess.Popen(
    [sys.executable, 'backend/manage.py', 'migrate'],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

for line in process.stdout:
    print(f"STDOUT: {line.strip()}")

for line in process.stderr:
    print(f"STDERR: {line.strip()}")

process.wait()
print(f"Process exited with code {process.returncode}")
