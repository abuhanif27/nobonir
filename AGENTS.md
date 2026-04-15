# Nobonir Workspace Context

This repository contains two main parts:
- `backend/`: Django REST API, payments, AI engine, orders, products, cart, accounts, analytics
- `frontend/`: React + Vite customer/admin UI

## Project Context
- This is an e-commerce app with guest mode, Stripe/COD checkout, product recommendations, semantic search, and an AI shopping assistant.
- The frontend talks to the backend through `/api/...` endpoints.
- The backend uses Django, DRF, and SQLite for local development.

## AI Integration (Ollama + Phi-3 Mini)
- **Free Local LLM**: Phi-3 Mini model (2.7B parameters, 1.6GB) runs via Ollama on localhost:11434
- **Zero API Costs**: No cloud dependency; completely free operation with local computation
- **Provider Chain**: Ollama (primary) → Pollinations (fallback) → HuggingFace (fallback) → Local Templates
- **Chat Service**: `/api/ai/assistant/chat/` endpoint with `llm_provider`, `llm_enhanced`, and `llm_attempts` metadata
- **Configuration**: 
  - `AI_OLLAMA_API_URL`: `http://127.0.0.1:11434`
  - `AI_OLLAMA_MODEL`: `phi`
  - `AI_FREE_LLM_PROVIDERS`: `["ollama", "pollinations", "huggingface"]`
  - `AI_FREE_LLM_TIMEOUT_SECONDS`: `12` (accounts for warmup delay)
- **Setup**: Run `ollama pull phi` once, then Ollama daemon handles serving automatically
- **File**: [backend/ai_engine/services/chat_assistant_service.py](backend/ai_engine/services/chat_assistant_service.py) contains `_ollama_reply()` and `_build_ollama_prompt()`

## Working Style
- Prefer minimal, focused changes over large refactors.
- Preserve existing UI and backend conventions.
- Do not remove user changes unless explicitly asked.
- Validate edits when possible.

## Common Commands
- Backend: `python backend/manage.py runserver 127.0.0.1:8000 --noreload`
- Frontend: `cd frontend && npm run dev -- --host 127.0.0.1`
- Tests: `python backend/manage.py test`
- **Ollama Start**: `ollama serve` (runs daemon on localhost:11434)
- **Ollama Pull Model**: `ollama pull phi` (first-time setup)
- **Test Chat**: `curl -X POST http://127.0.0.1:8000/api/ai/assistant/chat/ -H "Content-Type: application/json" -d '{"message":"hello"}'`

## Notes
- If a feature spans both apps, inspect both sides before changing code.
- If a config file is needed for agent behavior, keep it at the workspace root or under `.github/`.
