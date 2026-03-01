import os
import sys
import subprocess
import time

# Set environment
os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("Starting server process...")
sys.stdout.flush()

process = subprocess.Popen(
    [sys.executable, '-u', 'backend/manage.py', 'runserver', '0.0.0.0:8000', '--noreload'],
    stdout=sys.stdout,
    stderr=sys.stderr,
    text=True,
    bufsize=1
)

# No need to read output manually if it's already piped to our own stdout/stderr
# Keep this script alive as long as the server is alive
while process.poll() is None:
    time.sleep(1)

print(f"Server process exited with code {process.returncode}")
sys.stdout.flush()
