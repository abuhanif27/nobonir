# Nobonir E-Commerce (React + Django + AI)

Full-stack e-commerce platform with a teal dashboard style inspired by your UI/UX reference.

## Stack

- Frontend: React (Vite + TypeScript), Tailwind CSS, shadcn-style UI components
- Backend: Django + Django REST Framework + CORS
- AI: Recommendation engine using NumPy with behavior-driven ranking
- DB: SQLite (default, development)

## Features Implemented

- Product catalog with search, category filtering, sorting, stock filter
- Category and inventory management (admin-ready)
- Wishlist add/remove
- Cart add/update/remove
- Checkout flow with stock validation and order creation
- Order tracking API and frontend panel
- Product reviews and rating submission
- AI recommendations based on user cart/wishlist/review behavior
- Django admin for products, orders, carts, wishlist, reviews

## Project Structure

- `backend/` Django API server
- `frontend/` React client

## Quick Start

### 1) Backend

```bash
cd backend
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py seed_data
../.venv/bin/python manage.py runserver
```

Backend runs on `http://127.0.0.1:8000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173`.

## Environment Variables

### Backend (`backend/.env`)

- `DEBUG=True`
- `DJANGO_SECRET_KEY=dev-secret-key`
- `ALLOWED_HOSTS=*`
- `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

### Frontend (`frontend/.env`)

- `VITE_API_URL=http://127.0.0.1:8000/api`

## Important Note

Your machine currently uses Node `18.x`. The frontend is pinned to tooling compatible with Node 18.
