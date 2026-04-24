# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nobonir is a full-stack AI-powered e-commerce platform. Django 6.0 REST API backend with React 18 + TypeScript + Vite frontend.

## Common Commands

### Backend (run from `backend/`)
```bash
python manage.py runserver                    # Start dev server (port 8000)
python manage.py test                         # Run all backend tests
python manage.py test accounts                # Run tests for a single app
python manage.py migrate                      # Apply database migrations
python manage.py makemigrations               # Generate migrations after model changes
python manage.py seed_products                # Seed sample product data
python manage.py createsuperuser              # Create admin user
```

### Frontend (run from `frontend/`)
```bash
npm run dev                                   # Start Vite dev server (port 5173)
npm run build                                 # TypeScript check + Vite build
npm run build:ci                              # Build + bundle budget check
npm run lint                                  # ESLint (strict, zero warnings allowed)
npm run test                                  # Vitest unit tests
npm run test:e2e                              # Playwright E2E tests
npm run test:e2e:ui                           # Playwright interactive UI mode
```

### Docker (run from root)
```bash
docker-compose up                             # Start all services (backend, frontend, postgres, redis)
```

## Architecture

### Backend (`backend/`)

**Settings:** `backend/settings/` uses a split config pattern. `__init__.py` imports `dev.py` by default. `dev.py` uses SQLite; `prod.py` uses PostgreSQL. Both extend `base.py`. The `.env` file is loaded from `backend/.env`.

**Django apps (9):**
- `accounts` — Custom User model (ADMIN/CUSTOMER roles), JWT auth via SimpleJWT, password reset
- `products` — Product, Category, ProductVariant, ProductMedia, InventoryMovement, StockReservation
- `cart` — Cart + CartItem, supports both guest (browser-only) and authenticated users
- `orders` — Order lifecycle (PENDING/PAID/PROCESSING/SHIPPED/DELIVERED/CANCELLED), Coupon, invoice PDF generation with currency conversion
- `payments` — Stripe checkout sessions + webhooks
- `reviews` — Product reviews with AI sentiment analysis
- `ai_engine` — Recommendations, semantic search (sentence-transformers embeddings), AI chat assistant, user preferences, geo-detection
- `analytics` — AnalyticsEvent model (JSONField metadata), funnel tracking
- `shop` — Legacy/placeholder

**API URL prefix:** All endpoints under `/api/`. Auth tokens at `/api/auth/token/` and `/api/auth/token/refresh/`. API docs at `/api/docs/swagger/`.

**Key backend pattern:** The `AnalyticsEvent.metadata` is a JSONField. PostgreSQL supports `metadata__product_id` ORM lookups; SQLite does not. Any analytics query using JSON field lookups needs a Python-side fallback for dev (see `_build_event_count_map` in `products/views.py`).

**Rate limiting scopes** are defined in `base.py` (e.g., `review_create: 10/hour`, `order_checkout: 15/hour`, `cart_write: 120/hour`).

### Frontend (`frontend/`)

**Build:** Vite 5.1 with `@` path alias mapping to `src/`. Bundle budget enforced in CI via `scripts/check-bundle-budget.mjs`.

**Routing:** React Router v6 in `App.tsx`. All page components are lazy-loaded. `ProtectedRoute` guards authenticated and admin routes. Admins visiting `/` are redirected to `/admin`.

**State management:**
- `Zustand` stores in `src/lib/`: `auth.ts` (user + tokens, persisted to localStorage), `cart.ts`
- React Context providers in `src/lib/`: `theme.tsx`, `currency.tsx`, `feedback.tsx`

**UI components:** shadcn/ui components in `src/components/ui/`. Custom components alongside. Icons from `lucide-react`.

**API client:** `src/lib/api.ts` — Axios instance with automatic JWT Bearer header injection and token refresh on 401.

**Key frontend files:**
- `src/pages/CustomerDashboard.tsx` — Main storefront (~3000 lines), product grid with pagination, merchandising carousel, notifications, personalization
- `src/pages/AdminDashboard.tsx` — Admin panel with order/coupon/user/review/product management and analytics
- `src/lib/notifications.ts` — Client-side notification system with localStorage persistence
- `src/lib/flyToCart.ts` — Add-to-cart animation helper

### Data Flow

1. JWT tokens obtained from `/api/auth/token/`, stored in Zustand (persisted to localStorage)
2. Axios interceptor attaches `Authorization: Bearer` header on every request
3. Guest carts are local-only; on login, local items are synced to the server cart
4. Stock is reserved atomically on checkout; reduced only on successful Stripe payment webhook
5. AI recommendations use sentence-transformer embeddings cached in `EmbeddingCache` model; preferences stored in `UserPreference`
6. Real-time order status updates via SSE at `/api/orders/my/updates/stream/`, with polling fallback

### AI Feature Fallback Chain

The AI chat assistant tries providers in order: Ollama (local) -> Pollinations (free cloud) -> HuggingFace -> template-based fallback (no API needed).

## Development Notes

- **Database:** Dev uses SQLite (`backend/db.sqlite3`), prod uses PostgreSQL. JSONField ORM lookups (e.g., `metadata__key`) only work on PostgreSQL.
- **Environment:** Copy `.env.example` to `.env` in both root and `backend/`. Key vars: `DJANGO_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, email config for password reset.
- **Frontend lint** is strict: `--max-warnings 0`. Fix all warnings before committing.
- **Product pagination:** The `/api/products/` endpoint is paginated (default page size 12). Use `page` and `page_size` query params. The `count` field in paginated responses gives the true total.
- **CI quality gates:** Backend tests, frontend lint, frontend build with budget check, and Playwright E2E tests all must pass. See `.github/workflows/`.
