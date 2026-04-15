# Quick start script for Ollama + Phi-3 Mini setup
# Run this in PowerShell as Administrator

Write-Host "=== OLLAMA + PHI-3 MINI SETUP ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Manual Download Notice
Write-Host "STEP 1: Download Ollama" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "Please download Ollama from:"
Write-Host "  https://ollama.ai/download" -ForegroundColor Blue
Write-Host ""
Write-Host "Then run the installer and restart this PowerShell window."
Write-Host ""

# Wait for user to confirm
$response = Read-Host "Press ENTER after installing Ollama and restarting PowerShell"

# Step 2: Verify Installation
Write-Host ""
Write-Host "STEP 2: Verifying Ollama Installation" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "✓ Ollama is installed!" -ForegroundColor Green
    ollama --version
} else {
    Write-Host "✗ Ollama not found. Please install it first from https://ollama.ai/download" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "STEP 3: Pulling Phi-3 Mini Model" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "Downloading Phi-3 Mini (~2.1GB)..."
Write-Host "This may take 2-5 minutes depending on your internet speed." -ForegroundColor DarkGray
Write-Host ""

ollama pull phi

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Phi-3 Mini model downloaded successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to pull Phi model" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "STEP 4: Starting Ollama Server" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "Starting Ollama API server on localhost:11434..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠ IMPORTANT: Keep this window open!" -ForegroundColor Yellow
Write-Host "Do NOT close this terminal - Ollama server needs to keep running." -ForegroundColor Yellow
Write-Host ""
Write-Host "The server is now listening. In another PowerShell window:" -ForegroundColor Green
Write-Host "  1. cd F:\CODE\nobonir" -ForegroundColor DarkGray
Write-Host "  2. python backend/manage.py runserver 127.0.0.1:8000" -ForegroundColor DarkGray
Write-Host ""

ollama serve
