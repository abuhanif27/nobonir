# Ollama + Phi-3 Mini Setup Guide

Using **100% free local AI** with Ollama and Phi-3 Mini for Nobonir chatbot.

## What You Get
- ✅ **100% Free** - No API costs, no rate limits
- ✅ **Local** - Runs on your machine, no cloud dependency  
- ✅ **Fast** - Instant responses with product context
- ✅ **Privacy** - All data stays on your machine
- ✅ **Reliable** - Works offline after model is downloaded

## Prerequisites
- Windows/Mac/Linux
- ~2.5GB disk space (for Phi-3 Mini model)
- ~4GB RAM (model runs efficiently)

## Installation Steps

### 1. Download & Install Ollama

**Windows/Mac/Linux:**
```bash
# Download from: https://ollama.ai
# Or via CLI (Mac/Linux):
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation:
ollama --version
```

### 2. Pull Phi-3 Mini Model

```bash
# Download Phi-3 Mini (~2.1GB)
ollama pull phi

# Or use a variant:
ollama pull phi:latest
```

First run will download the model. Subsequent runs are instant (~instant).

### 3. Start Ollama Server

```bash
# Start the Ollama API server (runs on localhost:11434)
ollama serve

# Output should show:
# 2026/04/15 22:56:08 "Listening on 127.0.0.1:11434"
```

Keep this terminal window running while you use the chatbot.

### 4. Test Ollama Connection

```bash
# In another terminal:
curl -X POST http://127.0.0.1:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "phi",
    "prompt": "What is Nobonir?",
    "stream": false
  }'

# Should return a response from Phi-3 Mini
```

### 5. Configure Django Backend

Your backend is already configured to use Ollama! The settings default to:
- API URL: `http://127.0.0.1:11434`
- Model: `phi`
- Provider priority: `ollama > pollinations > huggingface > local fallback`

**Optional: Custom Configuration**

If you want to customize, set environment variables before running Django:

```bash
# Windows PowerShell:
$env:AI_OLLAMA_API_URL = "http://127.0.0.1:11434"
$env:AI_OLLAMA_MODEL = "phi"
$env:AI_FREE_LLM_PROVIDERS = "ollama,pollinations,huggingface"

# Then start Django:
python backend/manage.py runserver 127.0.0.1:8000

# Linux/Mac:
export AI_OLLAMA_API_URL="http://127.0.0.1:11434"
export AI_OLLAMA_MODEL="phi"
export AI_FREE_LLM_PROVIDERS="ollama,pollinations,huggingface"
python backend/manage.py runserver 127.0.0.1:8000
```

### 6. Start Your App

```bash
# Terminal 1: Start Ollama server
ollama serve

# Terminal 2: Start Django backend
cd f:\CODE\nobonir
python backend/manage.py runserver 127.0.0.1:8000

# Terminal 3: Start React frontend (optional)
cd frontend
npm run dev -- --host 127.0.0.1
```

### 7. Test in Chatbot

Open your app and chat with the AI. Monitor the logs:

```
2026-04-15 22:57:10 INFO nobonir.request {"method": "POST", "path": "/api/ai/assistant/chat/", "llm_provider": "ollama", "status_code": 200}
```

When you see `"llm_provider": "ollama"`, you know it's using your local Phi-3 Mini!

---

## Model Alternatives

If you want to try other models:

```bash
# Smaller, faster:
ollama pull orca-mini        # ~3.5B params, very fast
ollama pull neural-chat      # ~7B, balanced

# Larger, better quality (need more RAM):
ollama pull mistral          # ~7B, excellent reasoning
ollama pull llama2           # ~7B, strong all-around
ollama pull openchat         # ~7B, good for chat

# Configure Django to use a different model:
$env:AI_OLLAMA_MODEL = "mistral"
```

**Note:** Larger models (7B+) may take 3-5s per response. Phi (2.7B) is fast (~1s).

---

## How It Works

1. **User sends message** → React frontend
2. **Backend processes intent** (TOP_SELLING, BUDGET_SEARCH, etc.)
3. **Ollama generates reply** using Phi-3 Mini + product context
4. **Falls back** to Pollinations/HuggingFace if Ollama is down
5. **Falls back to templates** if all LLMs fail (still works!)

Provider chain: `ollama → pollinations → huggingface → local templates`

---

## Troubleshooting

### "Connection refused on 127.0.0.1:11434"
- Ollama server not running? Start it: `ollama serve`
- Check if port is correct in settings

### "Model not found: phi"
- Pull the model: `ollama pull phi`
- List available: `ollama list`

### Slow responses (~10+ seconds)
- Ollama might be downloading model or running on slow hardware
- Check Ollama logs in the `ollama serve` terminal
- Try smaller model: `ollama pull orca-mini`

### High memory usage
- Phi-3 Mini should use ~2-4GB RAM
- Close other apps or use smaller model

### Want to switch back to Pollinations?
```bash
$env:AI_FREE_LLM_PROVIDERS = "pollinations,huggingface"
```

---

## Performance Tips

- **First response**: 1-3 seconds (model loads into memory)
- **Subsequent**: 0.5-1 second (model stays in memory)
- **Batch requests**: Keep responses short for speed
- **Product context**: 100% accurate since it's from your database

---

## Next Steps

1. Install Ollama
2. Pull Phi model: `ollama pull phi`
3. Run `ollama serve` in a terminal
4. Start Django backend (it will auto-detect Ollama)
5. Chat and enjoy 100% free AI! 🚀

Questions? Check logs for provider chain attempts:
```bash
python backend/manage.py test ai_engine.tests -v 2
```
