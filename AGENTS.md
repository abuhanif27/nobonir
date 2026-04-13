# Nobonir Workspace Context

This repository contains two main parts:
- `backend/`: Django REST API, payments, AI engine, orders, products, cart, accounts, analytics
- `frontend/`: React + Vite customer/admin UI

## Project Context
- This is an e-commerce app with guest mode, Stripe/COD checkout, product recommendations, semantic search, and an AI shopping assistant.
- The frontend talks to the backend through `/api/...` endpoints.
- The backend uses Django, DRF, and SQLite for local development.

## Working Style
- Prefer minimal, focused changes over large refactors.
- Preserve existing UI and backend conventions.
- Do not remove user changes unless explicitly asked.
- Validate edits when possible.

## Common Commands
- Backend: `python backend/manage.py runserver 127.0.0.1:8000 --noreload`
- Frontend: `cd frontend && npm run dev -- --host 127.0.0.1`
- Tests: `python backend/manage.py test`

## Notes
- If a feature spans both apps, inspect both sides before changing code.
- If a config file is needed for agent behavior, keep it at the workspace root or under `.github/`.
