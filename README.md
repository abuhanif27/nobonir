# Nobonir E-Commerce

A full-stack AI-powered e-commerce platform built with Django 6.0, React 18, and sentence-transformers AI.

## CI Status

![Frontend Keyboard E2E](https://github.com/OWNER/REPO/actions/workflows/frontend-keyboard-e2e.yml/badge.svg)
![Frontend Build](https://github.com/OWNER/REPO/actions/workflows/frontend-build.yml/badge.svg)

Replace `OWNER/REPO` with your GitHub repository path to activate the badge.

### Branch protection checklist

Set these as required status checks for your default branch in GitHub:

- `Frontend Build / build`
- `Frontend Keyboard E2E / keyboard-smoke`

Suggested branch protection settings:

- Require pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators (optional but recommended)

Quick setup in GitHub UI:

1. Open your repository on GitHub.
2. Go to **Settings** → **Branches**.
3. In **Branch protection rules**, click **Add rule** (or edit your default branch rule).
4. Enter your branch pattern (for example: `main`).
5. Enable **Require a pull request before merging**.
6. Enable **Require status checks to pass before merging**.
7. In the status check list, select:
   - `Frontend Build / build`
   - `Frontend Keyboard E2E / keyboard-smoke`
8. (Recommended) Enable **Require branches to be up to date before merging**.
9. Click **Create** or **Save changes**.

Troubleshooting:

- If `Frontend Build / build` or `Frontend Keyboard E2E / keyboard-smoke` does not appear in the required checks list, run at least one workflow execution first (push a small commit or open a PR touching `frontend/**`).
- Refresh the branch protection page after the workflow completes, then select the checks.
- Typical runtime: `Frontend Build` is usually ~2–5 minutes, and `Frontend Keyboard E2E` is usually ~4–8 minutes (first run can be slower due to Playwright browser installation).
- CI optimization: the keyboard E2E workflow caches Playwright browser binaries to speed up repeat runs.
- Cache refresh behavior: Playwright cache is refreshed automatically when frontend dependency lockfile or Playwright config changes.

## Features

- **Guest Mode**: Browse and add to cart without account - login required only for checkout
- **Modular Backend Architecture**: Separate Django apps for accounts, products, cart, orders, payments, reviews, and AI engine
- **JWT Authentication**: Secure token-based auth with refresh token rotation
- **Role-Based Access Control (RBAC)**: Admin and customer roles with permission-based views
- **AI-Powered Features**: Product recommendations, semantic search, and sentiment analysis using sentence-transformers
- **PostgreSQL & SQLite Support**: Production-ready PostgreSQL config with SQLite for development
- **REST API Documentation**: Auto-generated Swagger UI and ReDoc with drf-spectacular
- **Modern React Frontend**: TypeScript, Tailwind CSS, shadcn/ui components, Zustand state management
- **Atomic Transactions**: Stock reduction only on successful payment with race condition protection
- **Complete Test Coverage**: Unit tests for critical business logic

## Tech Stack

### Backend

- Python 3.12+
- Django 6.0
- Django REST Framework 3.15.2
- djangorestframework-simplejwt 5.5.1 (JWT auth)
- drf-spectacular 0.28.0 (API docs)
- sentence-transformers 5.1.0 (AI)
- scikit-learn 1.6.1
- psycopg 3.2.9 (PostgreSQL adapter)

### Frontend

- React 18.2.0
- TypeScript 5.2.2
- Vite 5.1.0
- Tailwind CSS 3.4.17
- shadcn/ui components
- Zustand 4.5.5 (state management)
- axios 1.13.5
- react-router-dom 6.28.2

## UX Documentation

- Feedback copy and toast standards: [frontend/FEEDBACK_COPY_STYLE_GUIDE.md](frontend/FEEDBACK_COPY_STYLE_GUIDE.md)

## Setup Instructions

### Backend Setup

1. Clone and navigate:

   ```bash
   cd nobonir/backend
   ```

2. Install dependencies:

   ```bash
   pip install Django==6.0 djangorestframework==3.15.2 djangorestframework-simplejwt==5.5.1 drf-spectacular==0.28.0 django-cors-headers==4.6.0 django-filter==25.1 psycopg[binary]==3.2.9 sentence-transformers==5.1.0 scikit-learn==1.6.1 numpy==2.2.3 python-dotenv==1.0.1 stripe==11.5.0
   ```

3. Create backend environment file:

   ```bash
   cp .env.example .env
   ```

   Set Stripe credentials in `backend/.env`:

   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   FRONTEND_BASE_URL=http://localhost:5173
   ```

   Optional invoice currency settings in `backend/.env`:

   ```env
   # Base currency used by stored order amounts
   INVOICE_BASE_CURRENCY=USD

   # Override rates using CSV pairs (USD -> target currency)
   INVOICE_USD_TO_RATES=BDT:121.50,INR:83.20,EUR:0.93

   # Or override with JSON (takes precedence over defaults, can be used instead of CSV)
   INVOICE_USD_TO_RATES_JSON={"BDT":"121.50","INR":"83.20","EUR":"0.93"}
   ```

   Notes:
   - Invoices are converted from `INVOICE_BASE_CURRENCY` to the user region currency.
   - If no geo header is available, local/private IP defaults to `BDT` and otherwise falls back to configured defaults.
   - Rates are static values from env and should be updated periodically for accuracy.

4. Run migrations:

   ```bash
   python manage.py migrate
   ```

5. Create superuser (admin):

   ```bash
   python manage.py createsuperuser
   ```

6. Seed sample data:

   ```bash
   python manage.py seed_products
   ```

7. Run server:

   ```bash
   python manage.py runserver
   ```

   Backend: `http://127.0.0.1:8000`
   API docs: `http://127.0.0.1:8000/api/docs/swagger/`

### Frontend Setup

1. Navigate to frontend:

   ```bash
   cd ../frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run dev server:

   ```bash
   npm run dev
   ```

   Frontend: `http://localhost:5173`

## Running Tests

```bash
cd backend
python manage.py test
```

## Backend Hardening

The backend enforces stricter input validation and scoped API throttling for abuse-prone write paths.

### Rate-Limited Scopes

- `review_create`: `10/hour` (review submission)
- `review_update`: `30/hour` (review edit/delete)
- `cart_write`: `120/hour` (cart add/update/delete)
- `order_checkout`: `15/hour` (checkout)
- `order_coupon_validate`: `60/hour` (coupon validation)
- `order_invoice_download`: `30/hour` (invoice text/pdf download)

### API Behavior on Limit Exceeded

- Exceeding a scoped limit returns `429 Too Many Requests`.
- Response body follows DRF throttle format (includes a `detail` message).
- Clients should treat `429` as retryable and back off before retrying.

## User Roles

### Guest (No Account Required)

- Browse all products
- AI-powered search
- Add items to cart
- View and manage cart
- **Must create account to checkout**

### Customer

- All guest permissions
- Checkout and place orders
- Add items to wishlist
- View order history
- Submit product reviews

### Admin

- All customer permissions
- Create/update/delete products
- Manage categories
- Update order statuses

## API Documentation

Visit `http://127.0.0.1:8000/api/docs/swagger/` after starting the backend server for interactive API documentation.

## Key Endpoints

- `POST /api/accounts/register/` - Register
- `POST /api/accounts/login/` - Login (get JWT tokens)
- `GET /api/products/products/` - List products
- `GET /api/ai/recommendations/` - AI recommendations
- `GET /api/ai/search/?query=...` - Semantic search
- `POST /api/orders/checkout/` - Create order
- `POST /api/payments/stripe/checkout-session/` - Create Stripe checkout session
- `POST /api/payments/stripe/webhook/` - Stripe webhook handler

## License

MIT
