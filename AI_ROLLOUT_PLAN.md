# AI Rollout Plan (Fast → Advanced)

## Phase 1 (Implemented MVP)

- AI Assistant Chat API (`POST /api/ai/assistant/chat/`)
- AI Notification Insights API (`GET /api/ai/assistant/notification-insights/`)
- Protected React page for assistant chat (`/assistant`)
- Notifications page now syncs AI insights and deep-links into assistant context

### Current backend flow

1. User sends a chat message.
2. Assistant detects intent (`ORDER_HELP`, `FIT_HELP`, `BUDGET_SEARCH`, `RECOMMENDATION`, `GENERAL`).
3. It blends semantic search + personalized recommendation fallback.
4. API returns:
   - `reply`
   - `intent`
   - `suggested_products[]`

### Current notification intelligence

- Generates actionable prompts from:
  - active orders
  - cart items
  - wishlist count
- Prompts are emitted as notification items with `sectionKey` and route users to `/assistant?focus=...`

## Phase 2 (Next)

- Visual search (image → nearest product matches)
- Fit advisor (size recommendation + confidence)

### Proposed additions

- Backend:
  - `POST /api/ai/visual-search/` (multipart image)
  - `POST /api/ai/fit-advisor/` (profile + product + optional measurements)
- Frontend:
  - camera/upload UI on product/discovery pages
  - fit advisor card on product details

## Phase 3 (Advanced)

- Forecasting copilot (demand and stock outlook)
- Pricing copilot (suggested price bands + rationale)

### Proposed additions

- Backend:
  - `GET /api/ai/admin/forecasting/`
  - `POST /api/ai/admin/pricing-copilot/`
- Frontend:
  - admin widgets in dashboard for demand risk and price suggestions

## Suggested immediate next sprint

1. Add chat memory persistence (`chat_session`, `chat_message` models).
2. Add RAG context from product FAQs and policy snippets.
3. Add assistant analytics events (intent hit-rate, recommendation CTR).
4. Add feedback thumb-up/down per assistant response.
