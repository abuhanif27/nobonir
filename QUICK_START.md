# Ollama + Phi-3 Mini Quick Start

Free local AI for Nobonir. Zero cloud costs. 5-minute setup.

---

## Step 1: Install Ollama

Download from [ollama.ai](https://ollama.ai) for your OS and run the installer.

Verify:
```powershell
ollama --version
```

---

## Step 2: Pull Phi-3 Mini Model

```powershell
ollama pull phi
```

First-time: ~1.6GB download (2-5 min). Verify with:
```powershell
ollama list  # Shows: phi:latest  1.6 GB
```

---

## Step 3: Open Two Terminals

**Terminal 1** - Start Ollama (keep running):
```powershell
ollama serve
# Should show: Listening on 127.0.0.1:11434
```

**Terminal 2** - Start Django backend:
```powershell
cd f:\CODE\nobonir
python backend/manage.py runserver 127.0.0.1:8000 --noreload
# Should show: Starting development server at http://127.0.0.1:8000/
```

---

## Step 4: Test the Integration

**Terminal 3** - Test chat endpoint:
```powershell
$body = @{ message = 'Hello' } | ConvertTo-Json
$r = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/ai/assistant/chat/' `
  -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 120
$r.llm_provider  # Should print: ollama ✓
$r.reply         # AI response from Phi-3
```

**Expected metadata**:
- `llm_provider`: `"ollama"` ✓
- `llm_enhanced`: `true` ✓
- `llm_attempts`: `["ollama"]` ✓

---

## Performance

| Metric | Performance |
|--------|------------|
| First call | 0.5-1.5s (model warmup) |
| Subsequent calls | 0.2-0.5s |
| Memory | ~2-4 GB RAM |
| Cost | $0.00 |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused to Ollama | Check if `ollama serve` is running (Terminal 1) |
| Getting `llm_provider: local` | Restart Django (stale process issue) |
| Model download stuck | Retry: `ollama pull phi` |
| Slow responses | Check RAM available (need 2-4GB) |

---

## Alternative Models

```powershell
ollama pull mistral      # Larger, better reasoning (~7B)

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
