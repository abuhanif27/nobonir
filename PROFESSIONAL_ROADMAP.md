# Professional Development Roadmap for Nobonir

This document outlines the recommended steps to elevate **Nobonir** from a functional prototype to a production-grade, scalable, and professional e-commerce platform.

## 1. DevOps & Infrastructure (The Foundation)

### **Containerization (Docker)**
- **Why:** Ensures the app runs exactly the same on your machine, your colleague's machine, and the production server. Removes "it works on my machine" issues.
- **Action:**
    - Create `Dockerfile` for Backend (Django).
    - Create `Dockerfile` for Frontend (Vite/Nginx).
    - Create `docker-compose.yml` to orchestrate Backend, Frontend, Database (Postgres), and Redis.

### **Database Migration**
- **Why:** SQLite is great for testing but poor for production concurrency.
- **Action:** Switch to **PostgreSQL**. It supports robust locking, JSONB fields (great for AI metadata), and `pgvector` for AI embeddings.

### **CI/CD Pipeline**
- **Why:** Automate testing and deployment to prevent bugs from reaching production.
- **Action:** Enhance GitHub Actions to:
    - Run Backend Tests (`pytest`).
    - Run Frontend Linting & Build checks.
    - Run End-to-End Tests (`playwright`).

---

## 2. Backend Engineering (Django)

### **Asynchronous Task Queue (Celery + Redis)**
- **Why:** The AI embedding generation and email sending currently happen "synchronously" (blocking the user's request). If OpenAI takes 5 seconds, the user waits 5 seconds.
- **Action:** Move these tasks to Celery workers:
    - `generate_embedding_for_product`
    - `send_order_confirmation_email`
    - `process_stripe_webhook`

### **Caching Strategy**
- **Why:** Fetching products from the DB every time is slow.
- **Action:** Use Redis to cache:
    - Homepage product lists (TTL: 5-10 mins).
    - AI Recommendations (TTL: 1 hour).
    - User session data.

### **Security Hardening**
- **Why:** Protect user data and payments.
- **Action:**
    - **Environment Variables:** Use `django-environ` for stricter type checking of `.env` files.
    - **Rate Limiting:** Tweak `ScopedRateThrottle` for sensitive endpoints (Login, Payment) to prevent brute force.
    - **Headers:** Configure `django-cors-headers` and `SECURE_SSL_REDIRECT` strictly for production.

---

## 3. Frontend Engineering (React)

### **State Management Upgrade**
- **Why:** Currently using `useEffect` + `axios` manually. This leads to "race conditions" (wrong data showing up) and complex loading state management.
- **Action:** Adopt **TanStack Query (React Query)**.
    - Automatic caching, background refetching, and simpler loading/error states.
    - Replaces 80% of manual `useEffect` data fetching code.

### **Form Validation (Zod)**
- **Why:** Manual `if (!email.includes('@'))` checks are brittle.
- **Action:** Use **React Hook Form** + **Zod** schema validation. This standardizes all forms (Login, Checkout, Address).

### **Error Monitoring (Sentry)**
- **Why:** You need to know when a user crashes *before* they email you.
- **Action:** Integrate Sentry to capture frontend crashes and backend 500 errors with full stack traces.

---

## 4. AI & Data Science

### **Vector Database**
- **Why:** `scikit-learn` in-memory calculation is fine for 100 products. For 10,000 products, it will be slow and consume all RAM.
- **Action:** Switch to **pgvector** (Postgres extension) or **Qdrant**. This allows "Nearest Neighbor" search directly in the database.

### **User Segmentation**
- **Why:** Better personalization.
- **Action:** Implement a "User Persona" model that updates dynamically based on view history, not just purchase history.

---

## 5. Code Quality & Maintenance

### **Strict Linting**
- **Action:**
    - **Backend:** `flake8` and `black` (or `ruff`) to enforce Python style.
    - **Frontend:** Enable stricter `eslint` rules and `prettier`.

### **Testing Strategy**
- **Action:**
    - Maintain `playwright` tests (they are excellent!).
    - Add **Unit Tests** for complex backend logic (e.g., Discount calculations, Stock reservation).

---

## Summary of Immediate Next Steps
1. **Fix `DEBUG` setting handling.** (Doing this now)
2. **Add Docker support.** (Doing this now)
3. **Switch to Postgres** (Recommended for next session).
