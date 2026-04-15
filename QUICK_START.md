# 🚀 COMPLETE OLLAMA + PHI-3 MINI INSTALLATION GUIDE

Follow these steps exactly to get 100% free local AI working on your Nobonir chatbot.

---

## STEP 1: Download Ollama (3 minutes)

### Windows

1. **Open this link in your browser:**
   ```
   https://ollama.ai/download
   ```

2. **Click "Download for Windows"** - This downloads `OllamaSetup.exe` (~200MB)

3. **Run the installer:**
   - Double-click `OllamaSetup.exe`
   - Click "Install"
   - Wait for installation to complete (~1-2 minutes)
   - Ollama will start automatically

4. **Verify installation:**
   - Open PowerShell
   - Type: `ollama --version`
   - You should see: `ollama version X.X.X`

### Mac

```bash
# Download and install (or use the GUI installer from https://ollama.ai)
curl -fsSL https://ollama.ai/install.sh | sh
ollama --version
```

### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama --version
```

---

## STEP 2: Download Phi-3 Mini Model (5-10 minutes)

**This only needs to be done ONCE** - downloads ~2.1GB

### Windows PowerShell

```powershell
# Open PowerShell and run:
ollama pull phi

# Output will show:
# pulling manifest
# pulling 4e4bef180305... 100% ▓▓▓▓▓▓▓▓▓▓ 2.0GB
# ✓ Done
```

### Mac/Linux

```bash
ollama pull phi
# Same output as above
```

**First run takes 2-5 minutes (downloading model)**  
**Subsequent runs are instant**

---

## STEP 3: Start Ollama Server

You need **two PowerShell windows open** from here on:

### PowerShell Window #1: Run Ollama Server (Keep Running)

```powershell
ollama serve

# Output should show:
# 2026/04/15 23:12:34 "Listening on 127.0.0.1:11434"
```

**⚠️ IMPORTANT: Do NOT close this window!**  
**The server must keep running for your chatbot to work.**

### PowerShell Window #2: Run Django Backend (New Window)

```powershell
cd F:\CODE\nobonir

# Optional: Set environment (already configured, but you can customize)
# $env:AI_OLLAMA_MODEL = "phi"
# $env:AI_FREE_LLM_PROVIDERS = "ollama,pollinations,huggingface"

# Start Django
python backend/manage.py runserver 127.0.0.1:8000

# Output should show:
# Starting development server at http://127.0.0.1:8000/
```

---

## STEP 4: Verify Everything Works

### Test 1: Quick Ollama Connection Test

```powershell
# In a new PowerShell window (Window #3):
curl -X POST http://127.0.0.1:11434/api/generate `
  -H "Content-Type: application/json" `
  -d '{"model":"phi","prompt":"Hello, who are you?","stream":false}' | ConvertTo-Json

# Should return a response from Phi-3 Mini
```

### Test 2: Test Through Django API

```powershell
# Still in Window #3:
$body = @{ message = "hey" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri http://127.0.0.1:8000/api/ai/assistant/chat/ `
  -Method Post -ContentType "application/json" -Body $body

Write-Host "Reply: $($response.reply)"
Write-Host "Provider: $($response.llm_provider)"
# Should show: "llm_provider": "ollama" ✓
```

### Test 3: Open Your Chatbot UI

```
Browser: http://127.0.0.1:5173  (Frontend, if running)
or open your deployed Nobonir app
```

Chat with the AI! You should see `"llm_provider": "ollama"` in the logs.

---

## STEP 5: Test Different Queries

Try these in the chatbot to test different intents:

| Query | Expected Behavior |
|-------|-------------------|
| `"hey"` | Friendly greeting |
| `"help"` | Explains what assistant can do |
| `"top selling"` | Shows bestselling products |
| `"under 500 taka"` | Budget search within price |
| `"blue shirt"` | Product recommendation search |
| `"check my order"` | Shows order status (guest: asks to login) |

---

## STEP 6: Monitor Performance

### Check Response Time

```powershell
# In Window #3:
$measure = Measure-Command {
    $body = @{ message = "what's your best selling product" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri http://127.0.0.1:8000/api/ai/assistant/chat/ `
      -Method Post -ContentType "application/json" -Body $body
}
Write-Host "Response time: $($measure.TotalSeconds) seconds"

# Expected: 0.5-1.5 seconds
```

### View Django Logs

Check Terminal Window #2 output for:
```
INFO nobonir.request {"llm_provider": "ollama", "llm_enhanced": true}
```

---

## Terminal Setup Summary

You should have these running:

| Window | Command | Keep Open |
|--------|---------|-----------|
| #1 | `ollama serve` | ✅ YES (Server) |
| #2 | `python backend/manage.py runserver...` | ✅ YES (Django) |
| #3 (New) | Testing/API calls | ✓ (Optional) |
| Browser | http://127.0.0.1:8000 | ✓ (Your app) |

---

## Troubleshooting

### "ollama: command not found"
→ Ollama not installed. Go back to STEP 1 and run the installer.

### "Connection refused 127.0.0.1:11434"
→ Ollama server not running. Make sure Window #1 has `ollama serve` running.

### "Model not found: phi"
→ You didn't pull the model. Run `ollama pull phi` in Window #2.

### "Slow response (>5 seconds)"
→ First response loads model into memory. Subsequent responses should be <1s.
→ If persistent, check available RAM (Phi needs ~2-4GB).

### "High CPU/Memory usage"
→ Normal - Phi-3 Mini uses ~2-4GB RAM while loaded.
→ Ollama unloads after 5 minutes of inactivity.

### Want to use a different model?
```powershell
# Available models:
ollama pull orca-mini        # Smaller, faster (~3.5B)
ollama pull neural-chat      # Balanced (~7B)
ollama pull mistral          # Excellent reasoning (~7B)
ollama pull llama2           # Strong all-around (~7B)

# Then update:
$env:AI_OLLAMA_MODEL = "mistral"

# Or change in Django settings
```

---

## Performance Baseline

With **Phi-3 Mini on modern machine:**

```
First request:   1-3 seconds (model loads)
Subsequent:      0.5-1 second (instant)
Memory:          ~2-4 GB RAM
Disk:            ~2.1 GB
Cost:            $0.00 ✓
```

---

## Quick Restart Procedure

If you need to restart everything:

1. **Stop Ollama:** Close Window #1 (Ctrl+C)
2. **Stop Django:** Close Window #2 (Ctrl+C)
3. **Restart Ollama:** Window #1 → `ollama serve`
4. **Restart Django:** Window #2 → `python backend/manage.py runserver 127.0.0.1:8000`

---

## What's Happening Behind the Scenes

```
┌─────────────────────────────────────────┐
│ User Types Message in Chatbot (Browser) │
└────────────────┬────────────────────────┘
                 ↓
         ┌───────────────────┐
         │ Django Backend    │
         │ - Detect Intent   │
         │ - Search Products │
         └────────┬──────────┘
                  ↓
        ┌─────────────────────────┐
        │ LLM Enhancement (Try:)  │
        ├─────────────────────────┤
        │ 1. Ollama (LOCAL) ⚡    │ ← PRIMARY
        │    Response: 0.5-1s     │
        │                         │
        │ 2. Pollinations (Cloud) │ ← Fallback
        │    Response: 1-3s       │
        │                         │
        │ 3. HuggingFace (Cloud)  │ ← Fallback
        │    Response: 2-5s       │
        │                         │
        │ 4. Template (Local)     │ ← Always Works
        └────────┬────────────────┘
                 ↓
      ┌──────────────────────┐
      │ Response with Products│
      │ (Powered by Phi-3)   │
      └────────┬─────────────┘
              ↓
   ┌──────────────────────────┐
   │ Browser Shows Reply      │
   │ + Product Suggestions    │
   └──────────────────────────┘
```

---

## Next Steps

✅ **Install Ollama** (https://ollama.ai/download)  
✅ **Run:** `ollama pull phi`  
✅ **Run:** `ollama serve` (Window #1)  
✅ **Run:** `python backend/manage.py runserver 127.0.0.1:8000` (Window #2)  
✅ **Chat and enjoy 100% free AI!** 🚀

---

## Questions?

If something doesn't work:
1. Scroll to Troubleshooting section above
2. Check OLLAMA_SETUP.md for detailed steps
3. Check OLLAMA_INTEGRATION.md for architecture details
4. Run tests: `python backend/manage.py test ai_engine.tests -v 2`

**You're all set!** Your Nobonir chatbot is now powered by free local AI. No API costs, no rate limits, no cloud dependency. 🎉
