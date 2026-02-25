# Nobonir E-Commerce

A full-stack AI-powered e-commerce platform built with Django 6.0, React 18, and sentence-transformers AI.

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

## Setup Instructions

### Backend Setup

1. Clone and navigate:
   ```bash
   cd nobonir/backend
   ```

2. Install dependencies:
   ```bash
   pip install Django==6.0 djangorestframework==3.15.2 djangorestframework-simplejwt==5.5.1 drf-spectacular==0.28.0 django-cors-headers==4.6.0 django-filter==25.1 psycopg[binary]==3.2.9 sentence-transformers==5.1.0 scikit-learn==1.6.1 numpy==2.2.3 python-dotenv==1.0.1
   ```

3. Run migrations:
   ```bash
   python manage.py migrate
   ```

4. Create superuser (admin):
   ```bash
   python manage.py createsuperuser
   ```

5. Seed sample data:
   ```bash
   python manage.py seed_products
   ```

6. Run server:
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

## User Roles

### Customer
- Browse and search products with AI
- Add items to cart and wishlist
- Place orders and track status
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

## License

MIT
