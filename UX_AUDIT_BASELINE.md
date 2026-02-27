# UX Audit + Baseline Metrics

Date: 2026-02-27

## Scope

- Frontend UX flow reviewed: Home (`/`) → Product (`/product/:id`) → Cart (`/cart`) → Checkout (`/orders/checkout/`) → Review (`/reviews/`)
- Quantitative baselines captured for:
  - Lighthouse (desktop preset)
  - Frontend bundle size (production build)
  - API latency (local environment)
  - Conversion funnel proxies and review completion (database-derived)

## Environment

- OS: Linux
- Backend: Django development server on `127.0.0.1:8000`
- Frontend: Vite preview on `127.0.0.1:4173`
- Node: `v18.19.1`
- Python: `3.12.3`

## Baseline Metrics

### 1) Lighthouse (Desktop)

Source: `audit_lighthouse_summary.json`

| Page         | Performance | Accessibility | Best Practices | SEO | FCP (ms) | LCP (ms) | TBT (ms) | CLS |
| ------------ | ----------: | ------------: | -------------: | --: | -------: | -------: | -------: | --: |
| `/`          |          93 |            94 |             96 |  82 |   417.67 |  1719.81 |        0 |   0 |
| `/product/1` |         100 |            93 |             96 |  80 |   376.47 |   503.47 |        0 |   0 |

Observations:

- Core runtime performance is strong on both tested pages.
- SEO score is the weakest area (80–82), indicating metadata/content discoverability gaps rather than rendering speed issues.

### 2) Bundle Size (Production)

Source: `audit_bundle_summary.json`

- Total raw assets: `477,869` bytes (~466.67 KB)
- Total gzip assets: `130,554` bytes (~127.49 KB)
- Largest file: `assets/index-DoMEj1kH.js` = `408,564` bytes raw (~398.99 KB), `119,671` bytes gzip (~116.87 KB)
- CSS: `assets/index-CSKiaH12.css` = `69,305` bytes raw (~67.68 KB), `10,883` bytes gzip (~10.63 KB)

Observation:

- JS bundle is acceptable for a single-bundle app but is the main candidate for code-splitting and route-level lazy loading.

### 3) API Latency Baseline

Source: `audit_api_latency.json`

30 samples per endpoint, local environment.

| Endpoint                        | Avg (ms) | Median (ms) | P95 (ms) | Min (ms) | Max (ms) |
| ------------------------------- | -------: | ----------: | -------: | -------: | -------: |
| `GET /api/products/`            |     9.36 |        8.08 |    12.58 |     6.10 |    41.50 |
| `GET /api/products/categories/` |     5.82 |        5.20 |     8.20 |     3.99 |    10.66 |
| `GET /api/reviews/?product=1`   |     8.17 |        7.95 |    10.39 |     6.29 |    12.31 |
| `GET /api/cart/`                |    25.71 |       25.00 |    29.28 |    22.47 |    33.25 |
| `GET /api/docs/swagger/`        |     4.26 |        3.58 |     6.49 |     2.72 |     9.53 |

Observations:

- API latency is healthy in local/dev conditions.
- `GET /api/cart/` is consistently slower than other tested endpoints and should be monitored in staging/production with realistic traffic.

### 4) Conversion Funnel + Review Completion

Source: `audit_funnel_review.json`

#### Raw Counts

- Customer users: `2`
- Admin users: `1`
- All carts: `336`
- Guest carts: `335`
- Authenticated carts: `1`
- Non-empty carts: `0`
- Orders total: `10`
- Orders paid or beyond: `5`
- Delivered orders: `2`
- Reviews total: `2`
- Eligible review pairs (delivered user-product): `2`
- Reviewed eligible pairs: `2`

#### Derived Rates

- `order_to_paid_rate_pct`: `50.0%`
- `order_to_delivered_rate_pct`: `20.0%`
- `review_completion_rate_pct`: `100.0%`
- Cart-to-order rates are `null` because there are currently no non-empty carts in this snapshot.

Interpretation:

- Current dataset is too sparse/inconsistent for reliable end-to-end funnel conversion interpretation.
- Review completion appears perfect in this small sample, but sample size is too small for strong conclusions.

## UX Audit Findings (Journey-Based)

### High Priority

1. **Funnel instrumentation gap**
   - No robust event-level tracking for core stages (product view, add-to-cart, checkout start, payment success/failure).
   - Impact: Conversion funnel cannot be measured reliably; optimization decisions risk being guesswork.

2. **Data model mismatch between guest and authenticated cart behavior**
   - Very high guest cart volume with zero non-empty carts in snapshot suggests cart/session hygiene or cleanup issue.
   - Impact: Noisy analytics and potential UX confusion around cart persistence.

3. **SEO quality below performance baseline**
   - Lighthouse SEO: 80–82 despite strong performance metrics.
   - Impact: Discoverability and organic acquisition likely underperform relative to site speed.

### Medium Priority

4. **Product detail endpoint fallback complexity**
   - Product page attempts two endpoint patterns (`/products/:id/` and legacy `/products/products/:id/`).
   - Impact: Avoidable complexity, error handling ambiguity, harder debugging.

5. **Large monolithic dashboard/page components**
   - Key pages are large (hundreds/thousands of lines), raising UX regression risk and slowing iteration.
   - Impact: Harder to refine micro-interactions and maintain consistency.

## Recommended Baseline Improvement Plan

1. **Add analytics events (must-have)**
   - Track: `view_product`, `add_to_cart`, `begin_checkout`, `order_created`, `payment_success`, `payment_cancel`, `review_submitted`.
   - Persist user/session/cart/order IDs for stage attribution.

2. **Define canonical funnel KPIs**
   - `product_view_to_add_to_cart`
   - `add_to_cart_to_checkout_start`
   - `checkout_start_to_order_created`
   - `order_created_to_payment_success`
   - `delivered_item_to_review`

3. **Fix cart/session hygiene**
   - Add lifecycle cleanup for abandoned/empty guest carts.
   - Ensure cart creation is intentional and not triggered unnecessarily on passive page loads.

4. **SEO quick wins**
   - Add/verify unique page titles, meta descriptions, canonical tags, semantic headings, and structured product metadata.

5. **Performance maintainability**
   - Introduce route-level code splitting and lazy loading for non-critical routes/components.

## Reproducible Artifacts

- `audit_lighthouse_home.json`
- `audit_lighthouse_product.json`
- `audit_lighthouse_summary.json`
- `audit_bundle_summary.json`
- `audit_api_latency.json`
- `audit_funnel_review.json`

## Notes & Limitations

- Metrics were captured in local development environment; production values will differ.
- Lighthouse was run with `lighthouse@11.7.1` due Node compatibility in current environment.
- Conversion rates here are proxies from persisted relational data, not true event analytics.
