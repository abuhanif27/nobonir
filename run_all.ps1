# Nobonir Unified Startup Script
# This script starts both the Django Backend and Vite Frontend simultaneously.

# 1. Start Backend in a new background job
Write-Host "Starting Django Backend on http://127.0.0.1:8000/ ..." -ForegroundColor Cyan
$BackendJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    $env:PYTHONPATH = "$using:PSScriptRoot\backend"
    python backend/manage.py runserver 127.0.0.1:8000 --noreload
}

# 2. Start Frontend in a new background job
Write-Host "Starting Vite Frontend on http://127.0.0.1:5173/ ..." -ForegroundColor Green
$FrontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:PSScriptRoot\frontend"
    npm.cmd run dev -- --host 127.0.0.1
}

Write-Host "`nBoth services are starting. Please wait a few seconds..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop both services." -ForegroundColor White

# Keep the script alive and monitor the jobs
try {
    while ($true) {
        if ($BackendJob.State -ne "Running") {
            Write-Host "Backend stopped unexpectedly!" -ForegroundColor Red
            break
        }
        if ($FrontendJob.State -ne "Running") {
            Write-Host "Frontend stopped unexpectedly!" -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 2
    }
}
finally {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    Stop-Job $BackendJob
    Stop-Job $FrontendJob
    
    # Force kill processes on ports if necessary
    $BackendProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
    if ($BackendProcess) { Stop-Process -Id $BackendProcess -Force }
    
    $FrontendProcess = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
    if ($FrontendProcess) { Stop-Process -Id $FrontendProcess -Force }
    
    Write-Host "Services stopped." -ForegroundColor Gray
}
