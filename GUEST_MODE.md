# Guest Mode Documentation

## Overview

Guest mode allows anonymous users to browse products and add items to their shopping cart without creating an account. When they're ready to checkout, they'll be prompted to register or login.

## Features

### Guest Users Can:

- ✅ Browse all products
- ✅ Search products with AI-powered semantic search
- ✅ Add products to cart
- ✅ View and manage cart items
- ✅ Update quantities and remove items

### Guest Users Cannot:

- ❌ Checkout (must login/register first)
- ❌ Add items to wishlist (requires account)
- ❌ View order history
- ❌ Submit product reviews

## How It Works

### Backend Implementation

1. **Session-Based Carts**
   - Guest carts are identified by Django session key
   - Cart model supports both `user` (for authenticated users) and `session_key` (for guests)
   - Constraint ensures cart has either a user OR a session key

2. **Cart Endpoints (AllowAny permission)**
   - `GET /api/cart/` - Get cart items
   - `POST /api/cart/items/` - Add item to cart
   - `PATCH /api/cart/items/{id}/` - Update cart item
   - `DELETE /api/cart/items/{id}/` - Remove cart item

3. **Protected Endpoints (IsAuthenticated required)**
   - `POST /api/orders/checkout/` - Create order (requires login)
   - `GET /api/orders/orders/` - View order history
   - Wishlist endpoints

4. **Cart Merge on Login**
   - When a guest logs in, their session cart is automatically merged with their user cart
   - Duplicate items have quantities combined
   - Guest cart is deleted after merge

### Frontend Implementation

1. **Public Access**
   - Home page (CustomerDashboard) accessible to all users
   - Cart page accessible to all users
   - Product browsing and search available to everyone

2. **Authentication UI**
   - Header shows "Browsing as Guest" for non-authenticated users
   - Login and Sign Up buttons prominently displayed
   - Cart page shows yellow notice prompting guests to login

3. **Checkout Flow for Guests**
   ```
   Guest adds items to cart
   → Navigates to /cart
   → Fills shipping address (disabled until login)
   → Clicks "Login to Checkout"
   → Redirected to /login
   → After login, cart is merged
   → Can complete checkout
   ```

## Database Schema

### Cart Model

```python
class Cart(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=CASCADE,
        null=True,
        blank=True
    )  # Null for guest carts

    session_key = models.CharField(
        max_length=40,
        null=True,
        blank=True,
        db_index=True
    )  # Set for guest carts

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            CheckConstraint(
                check=Q(user__isnull=False) | Q(session_key__isnull=False),
                name='cart_must_have_user_or_session'
            )
        ]
```

## API Example

### Guest Adding Item to Cart

```bash
# No authentication required
curl -X POST http://localhost:8000/api/cart/items/ \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity": 2
  }'
```

### Guest Trying to Checkout (will fail)

```bash
# Returns 401 Unauthorized
curl -X POST http://localhost:8000/api/orders/checkout/ \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_address": "123 Main St"
  }'
```

### After Login - Checkout Succeeds

```bash
# With JWT token
curl -X POST http://localhost:8000/api/orders/checkout/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
  -d '{
    "shipping_address": "123 Main St"
  }'
```

## Setup Instructions

### Backend Changes Made:

1. ✅ Updated `Cart` model to support `session_key`
2. ✅ Created `cart/utils.py` with helper functions
3. ✅ Updated cart views to use `AllowAny` permissions
4. ✅ Created custom `LoginAPIView` to merge guest cart on login
5. ✅ Updated main URLs to use custom login view
6. ✅ Created migration file `0002_guest_cart_support.py`

### Frontend Changes Made:

1. ✅ Updated `CustomerDashboard` to work for guests
2. ✅ Created `CartPage` component
3. ✅ Updated routing to allow public access to home and cart
4. ✅ Added login prompts for protected actions
5. ✅ Fixed API endpoints in `auth.ts`
6. ✅ Updated API interceptor to handle guest 401s gracefully

### To Apply Changes:

```bash
# Backend
cd backend
python manage.py migrate cart

# Frontend (already updated)
cd frontend
npm run build
```

## User Experience Flow

### Scenario 1: Guest Browse → Add to Cart → Register → Checkout

1. User visits site (no login)
2. Browses products
3. Adds items to cart
4. Clicks "Cart" button
5. Sees cart with items + yellow notice "Please login to checkout"
6. Clicks "Sign Up"
7. Registers account
8. Automatically logged in + cart merged
9. Returns to cart page
10. Enters shipping address
11. Completes checkout

### Scenario 2: Guest Browse → Try Wishlist → Prompted to Login

1. User visits site (no login)
2. Clicks heart icon on product
3. Sees confirm dialog: "Please login to add items to wishlist"
4. Clicks OK → redirected to login
5. After login, can add to wishlist

## Configuration

### Session Settings (already configured)

Django sessions are enabled by default in `backend/backend/settings/base.py`:

```python
MIDDLEWARE = [
    ...
    'django.contrib.sessions.middleware.SessionMiddleware',
    ...
]

INSTALLED_APPS = [
    ...
    'django.contrib.sessions',
    ...
]
```

### CORS Settings

Ensure CORS allows credentials for session cookies:

```python
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

## Testing

### Test Guest Cart Flow:

1. Open incognito/private browser window
2. Visit http://localhost:5173
3. Verify you see "Browsing as Guest" in header
4. Add product to cart - should work
5. Click cart - should see items
6. Try to checkout - should see login prompt
7. Register new account
8. Verify cart items are preserved

### Test Cart Merge:

1. As guest, add Product A to cart
2. Register/login
3. Add Product B to cart (as authenticated user)
4. Logout
5. As guest, add Product C to cart
6. Login with same account
7. Verify cart contains all three products

## Security Considerations

- ✅ Guest carts are isolated by Django session
- ✅ Checkout and payment require authentication
- ✅ Session cookies have security flags enabled
- ✅ Guest carts expire with session (configurable in Django settings)
- ✅ No sensitive user data stored for guests

### Security Changelog (2026-02-28)

- ✅ Validation hardening for cart/review/order flows (strict input normalization and safer quantity parsing)
- ✅ RBAC edge-case fix: active `is_staff`/`is_superuser` users are accepted on admin-only endpoints
- ✅ Scoped API throttling enabled for abuse-prone operations:
  - `review_create`: `10/hour`
  - `review_update`: `30/hour`
  - `cart_write`: `120/hour`
  - `order_checkout`: `15/hour`
  - `order_coupon_validate`: `60/hour`
  - `order_invoice_download`: `30/hour`
- ✅ Requests exceeding scoped limits now return `429 Too Many Requests` (DRF throttle response)

## Future Enhancements

- [ ] Guest cart persistence across browser sessions (using localStorage)
- [ ] Email cart to guest for later (require email, no account)
- [ ] Guest checkout with email (create temporary account)
- [ ] Cart expiration policy for abandoned guest carts
- [ ] Analytics for guest-to-customer conversion rate

## Troubleshooting

### Issue: Guest cart items disappearing

**Solution**: Ensure Django sessions are working:

```python
# Check session backend
python manage.py shell
>>> from django.contrib.sessions.backends.db import SessionStore
>>> s = SessionStore()
>>> s.create()
>>> print(s.session_key)
```

### Issue: Cart not merging on login

**Solution**: Check custom LoginAPIView is being used:

```bash
# Verify in backend/backend/urls.py
path('api/auth/token/', LoginAPIView.as_view(), ...)
```

### Issue: 401 errors for cart operations

**Solution**: Verify cart endpoints use AllowAny:

```python
# In cart/views.py
class CartItemAPIView(APIView):
    permission_classes = [permissions.AllowAny]
```

## Summary

Guest mode provides a seamless shopping experience for new users while maintaining security for transactions. The implementation balances accessibility (anyone can browse and cart) with accountability (must register to buy).

**Key Benefits:**

- Reduces friction for new visitors
- Increases conversion by allowing "try before you commit"
- Preserves cart items through registration process
- Maintains security for payment and order operations
