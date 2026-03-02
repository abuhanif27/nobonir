param(
  [string]$StripeSecretKey = "",
  [string]$WebhookSecret = ""
)

Write-Host "=== Nobonir Stripe Setup ===" -ForegroundColor Cyan
Write-Host "This script configures Stripe keys for local development." -ForegroundColor Gray
Write-Host "Secrets are written to backend/.env (do NOT commit this file)." -ForegroundColor Yellow

# 1) Verify Stripe CLI
function Test-StripeCli {
  try {
    $v = stripe --version 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

if (-not (Test-StripeCli)) {
  Write-Host "Stripe CLI not found." -ForegroundColor Red
  Write-Host "Install from: https://stripe.com/docs/stripe-cli#install" -ForegroundColor Gray
  Write-Host "Then run: stripe login" -ForegroundColor Gray
}

# 2) Collect secrets interactively if not supplied
if (-not $StripeSecretKey) {
  $StripeSecretKey = Read-Host -Prompt "Enter your Stripe Secret Key (sk_test_...)"
}
if (-not $WebhookSecret) {
  Write-Host "You can obtain a webhook secret by running:" -ForegroundColor Gray
  Write-Host "  stripe listen --forward-to http://127.0.0.1:8000/api/payments/stripe/webhook/" -ForegroundColor Gray
  $WebhookSecret = Read-Host -Prompt "Enter your Webhook Signing Secret (whsec_...)"
}

if (-not $StripeSecretKey -or -not $WebhookSecret) {
  Write-Host "Missing required values. Aborting." -ForegroundColor Red
  exit 1
}

# 3) Update backend/.env safely
$envPath = Join-Path $PSScriptRoot "backend\.env"
if (-not (Test-Path $envPath)) {
  Write-Host "backend/.env not found, creating one..." -ForegroundColor Yellow
  @"
DJANGO_SECRET_KEY=$(python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
FRONTEND_BASE_URL=http://127.0.0.1:5173
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
AI_FREE_LLM_ENABLED=1
AI_FREE_LLM_PROVIDER=pollinations
AI_FREE_LLM_PROVIDERS=pollinations,huggingface
AI_FREE_LLM_TIMEOUT_SECONDS=8
AI_FREE_LLM_POLLINATIONS_URL=https://text.pollinations.ai
AI_FREE_LLM_HUGGINGFACE_URL=https://api-inference.huggingface.co/models/google/flan-t5-large
"@ | Set-Content -Path $envPath -Encoding UTF8
}

# Helper: set key in .env (replace or append)
function Set-EnvLine([string]$Path, [string]$Key, [string]$Value) {
  $content = Get-Content -Path $Path
  $pattern = "^$Key\s*="
  $exists = $false
  $out = @()
  foreach ($line in $content) {
    if ($line -match $pattern) {
      $out += "$Key=$Value"
      $exists = $true
    } else {
      $out += $line
    }
  }
  if (-not $exists) {
    $out += "$Key=$Value"
  }
  $out | Set-Content -Path $Path -Encoding UTF8
}

Set-EnvLine -Path $envPath -Key "STRIPE_SECRET_KEY" -Value $StripeSecretKey
Set-EnvLine -Path $envPath -Key "STRIPE_WEBHOOK_SECRET" -Value $WebhookSecret

Write-Host "Updated backend/.env with Stripe keys." -ForegroundColor Green
Write-Host "IMPORTANT: Do NOT commit backend/.env to version control." -ForegroundColor Yellow

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1) Start backend:  python backend/manage.py runserver 127.0.0.1:8000" -ForegroundColor Gray
Write-Host "2) Start frontend: cd frontend; npm run dev -- --host 127.0.0.1" -ForegroundColor Gray
Write-Host "3) Start Stripe webhook listener (new terminal):" -ForegroundColor Gray
Write-Host "   stripe listen --forward-to http://127.0.0.1:8000/api/payments/stripe/webhook/" -ForegroundColor Gray
Write-Host "4) In the app, proceed to Cart -> Checkout -> Card Payment" -ForegroundColor Gray

