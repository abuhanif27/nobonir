#!/usr/bin/env pwsh
Write-Host "Checking Django setup..."
python backend/manage.py check
Write-Host "Starting server..."
python backend/manage.py runserver 127.0.0.1:8000 --noreload
