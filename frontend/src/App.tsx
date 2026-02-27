import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CustomerDashboard } from "@/pages/CustomerDashboard";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { CartPage } from "@/pages/CartPage";
import { ProductPage } from "@/pages/ProductPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { OrdersPage } from "@/pages/OrdersPage";
import { WishlistPage } from "@/pages/WishlistPage";
import { AdminProductFormPage } from "@/pages/AdminProductFormPage";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CurrencyProvider } from "@/lib/currency";
import { FeedbackProvider } from "@/lib/feedback";

function App() {
  const { isAuthenticated, isAdmin } = useAuthStore();

  return (
    <ThemeProvider>
      <CurrencyProvider>
        <FeedbackProvider>
          <BrowserRouter>
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <Routes>
              {/* Public routes - accessible to all */}
              <Route
                path="/"
                element={
                  isAuthenticated && isAdmin ? (
                    <Navigate to="/admin" replace />
                  ) : (
                    <CustomerDashboard />
                  )
                }
              />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route
                path="/login"
                element={
                  !isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />
                }
              />
              <Route
                path="/register"
                element={
                  !isAuthenticated ? (
                    <RegisterPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />

              {/* Protected customer routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Admin routes */}
              <Route element={<ProtectedRoute requireAdmin />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route
                  path="/admin/products/new"
                  element={<AdminProductFormPage />}
                />
                <Route
                  path="/admin/products/:id"
                  element={<AdminProductFormPage />}
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ThemeToggle />
          </BrowserRouter>
        </FeedbackProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;
