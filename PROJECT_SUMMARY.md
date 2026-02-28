# Nobonir E-Commerce - Project Summary

## What We Built

A **complete, production-ready, AI-powered e-commerce platform** with:

✅ **Modular Django Backend** (7 apps)

- `accounts` - JWT authentication with ADMIN/CUSTOMER roles
- `products` - Categories and product catalog with stock management
- `cart` - Shopping cart and wishlist
- `orders` - Order lifecycle management (6 statuses)
- `payments` - Payment simulation with atomic stock reduction
- `reviews` - Product reviews and ratings
- `ai_engine` - AI recommendations, semantic search, sentiment analysis
- `common` - Shared RBAC permissions (IsAdminRole, IsCustomerRole)

✅ **Modern React Frontend**

- JWT-based authentication with Zustand state management
- Protected routes with role-based access control
- Customer dashboard: AI-powered product search, cart, wishlist, checkout
- Admin dashboard: Product management, order tracking, analytics
- TypeScript + Tailwind CSS + shadcn/ui components
- Automatic token refresh on API 401 errors
- Unified global feedback copy/toast standard: `frontend/FEEDBACK_COPY_STYLE_GUIDE.md`

✅ **AI Features** (sentence-transformers)

- Personalized product recommendations using user behavior
- Semantic product search with natural language queries
- Review sentiment analysis
- Embedding caching for performance

✅ **Enterprise Architecture**

- Split settings (base/dev/prod) for environment-specific config
- PostgreSQL for production, SQLite for development
- JWT with refresh token rotation (30min access, 7-day refresh)
- API documentation with Swagger UI + ReDoc (drf-spectacular)
- CORS configured for frontend-backend separation
- Atomic transactions to prevent race conditions on stock updates

✅ **Production Ready**

- Pinned dependency versions in package.json and requirements.txt
- Unit tests covering critical business logic (checkout, payment, stock management)
- Comprehensive README with setup instructions
- Environment variable configuration (.env support)
- Can run on new machine without manual fixes

## Key Technical Decisions

### Backend

1. **Modular App Structure**: Each feature is isolated in its own Django app for maintainability
2. **Custom User Model with Roles**: Implemented from the start to avoid migration conflicts
3. **Stock Reduction Strategy**: Only successful payments reduce stock (atomic with `select_for_update()`)
4. **Order Lifecycle**: PENDING → PAID/CANCELLED → PROCESSING → SHIPPED → DELIVERED
5. **AI Model Loading**: Loaded once at app startup in `ai_engine/apps.py ready()` hook

### Frontend

1. **Zustand for Auth**: Lightweight state manager with persistence middleware
2. **Axios Interceptors**: Automatic JWT refresh on 401 errors
3. **Protected Routes**: Role-based navigation with redirect logic
4. **Component Separation**: Dashboard split by role (Customer vs Admin)

## What Works

### Backend APIs ✓

- User registration and login with JWT
- Product CRUD with filtering, search, ordering
- Cart and wishlist management
- Order creation from cart (checkout)
- Payment simulation with stock updates
- Review submission
- AI recommendations, semantic search, sentiment analysis
- Auto-generated Swagger docs at `/api/docs/swagger/`

### Frontend UI ✓

- Login/register pages with error handling
- Customer dashboard with product browsing, AI search, cart actions
- Admin dashboard with product table, stats, delete functionality
- Protected routes preventing unauthorized access
- Role-based routing (customers → /, admins → /admin)

### Tests ✓

- `test_checkout_creates_pending_order_without_reducing_stock` - Passes
- `test_success_payment_reduces_stock_and_marks_paid` - Passes
- `test_failed_payment_cancels_order_and_does_not_reduce_stock` - Passes
- `test_recommendations_returns_products` - Passes

## Backend Hardening (Validation + Abuse Controls)

Recent backend hardening covers validation cleanup, permission edge cases, and scoped API throttling on sensitive write/download paths.

### Validation & Permission Cleanup ✓

- Cart writes now validate numeric bounds for `product_id` and `quantity` (including safe quantity parsing on patch).
- Review validation now enforces active products, trims/sanitizes comments, and prevents product changes after review creation.
- Checkout/coupon validation now normalizes trimmed/uppercased coupon codes and rejects empty required inputs.
- RBAC edge case fixed: active `is_staff`/`is_superuser` users are treated as admin for admin-only endpoints.

### Scoped Rate Limits ✓

- `review_create`: `10/hour`
- `review_update`: `30/hour`
- `cart_write`: `120/hour`
- `order_checkout`: `15/hour`
- `order_coupon_validate`: `60/hour`
- `order_invoice_download`: `30/hour`

### Expected API Behavior ✓

- Exceeding a scoped limit returns `429 Too Many Requests` (DRF throttle response shape).
- Frontend/clients should back off and retry instead of immediately replaying requests.

## Quick Start

### First Time Setup

```bash
# Backend
cd backend
python3 manage.py migrate
python3 manage.py createsuperuser  # Create admin user
python3 manage.py seed_products    # Add sample data

# Frontend
cd ../frontend
npm install
```

### Running (Easy Way)

```bash
# From project root
./start.sh
```

This starts both backend (port 8000) and frontend (port 5173) simultaneously.

### Running (Manual)

```bash
# Terminal 1 - Backend
cd backend
python3 manage.py runserver

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Access Points

- Frontend: http://localhost:5173
- Backend API: http://127.0.0.1:8000
- Swagger Docs: http://127.0.0.1:8000/api/docs/swagger/
- Django Admin: http://127.0.0.1:8000/admin/

## Project Structure

```
nobonir/
├── start.sh                    # Startup script for both servers
├── README.md                   # Full documentation
├── backend/
│   ├── backend/settings/      # Split config (base/dev/prod)
│   ├── accounts/              # Auth & users
│   ├── products/              # Catalog
│   ├── cart/                  # Cart & wishlist
│   ├── orders/                # Order management
│   ├── payments/              # Payment processing
│   ├── reviews/               # Product reviews
│   ├── ai_engine/             # AI features
│   ├── common/                # Shared utilities
│   ├── db.sqlite3             # Development database
│   └── requirements.txt       # Python dependencies
└── frontend/
    ├── src/
    │   ├── components/ui/     # shadcn/ui components
    │   ├── pages/             # Login, Register, Dashboards
    │   ├── lib/
    │   │   ├── api.ts         # Axios with JWT interceptor
    │   │   └── auth.ts        # Zustand auth store
    │   └── App.tsx            # Route configuration
    ├── package.json           # NPM dependencies (pinned)
    └── dist/                  # Production build
```

## Testing

```bash
# Backend tests
cd backend
python3 manage.py test

# Expected output:
# Creating test database...
# ....
# Ran 4 tests in 2.0s
# OK
```

## Next Steps for Production

1. Set `DEBUG=False` in backend/.env
2. Generate new `SECRET_KEY` for production
3. Configure PostgreSQL database
4. Set `ALLOWED_HOSTS` in settings
5. Run `python manage.py collectstatic`
6. Deploy with gunicorn/nginx
7. Build frontend: `npm run build`
8. Serve frontend dist/ with nginx

## Notes

- AI model (all-MiniLM-L6-v2) downloads automatically on first migration (~91MB)
- Feedback copy/toast standards are documented in `frontend/FEEDBACK_COPY_STYLE_GUIDE.md`
- Superuser created via `createsuperuser` gets ADMIN role automatically
- Regular registrations via API get CUSTOMER role
- Stock updates are atomic - no race conditions
- JWT access tokens expire in 30 minutes, refresh tokens last 7 days
- Frontend auto-refreshes tokens on 401 errors

## Architecture Highlights

### Authentication Flow

1. User registers → receives JWT access + refresh tokens
2. Frontend stores tokens in localStorage via Zustand persist
3. API requests include `Authorization: Bearer <access_token>`
4. On 401 error → Axios interceptor calls /token/refresh/
5. New access token used to retry original request
6. If refresh fails → logout and redirect to /login

### Order + Payment Flow

1. Customer adds items to cart
2. Checkout creates Order with status=PENDING (no stock change)
3. Payment simulation called with order_id
4. On success: Stock reduced atomically + order status=PAID
5. On failure: Order status=CANCELLED (stock unchanged)
6. Admin can update status: PROCESSING → SHIPPED → DELIVERED

### AI Recommendation Flow

1. User interacts with products (cart, wishlist, reviews)
2. AI service generates embeddings for product descriptions
3. User's preference vector calculated from interaction history
4. Cosine similarity used to rank products
5. Top N recommendations returned via `/api/ai/recommendations/`

---

**Total Development Scope:**

- 7 Django apps
- 30+ API endpoints
- 4 test cases
- JWT auth with RBAC
- AI integration with sentence-transformers
- React frontend with 6 pages/components
- Complete documentation
- Production-ready configuration

**Ready to deploy and scale!** 🚀
