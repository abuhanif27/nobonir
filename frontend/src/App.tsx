import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FloatingAssistantWidget } from "@/components/FloatingAssistantWidget";
import { CurrencyProvider } from "@/lib/currency";
import { FeedbackProvider } from "@/lib/feedback";

const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const PasswordResetPage = lazy(() => import("@/pages/PasswordResetPage").then((m) => ({ default: m.PasswordResetPage })));
const PasswordResetConfirmPage = lazy(() => import("@/pages/PasswordResetConfirmPage").then((m) => ({ default: m.PasswordResetConfirmPage })));
const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard").then((m) => ({ default: m.CustomerDashboard })));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const CartPage = lazy(() => import("@/pages/CartPage").then((m) => ({ default: m.CartPage })));
const ProductPage = lazy(() => import("@/pages/ProductPage").then((m) => ({ default: m.ProductPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const OrdersPage = lazy(() => import("@/pages/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const WishlistPage = lazy(() => import("@/pages/WishlistPage").then((m) => ({ default: m.WishlistPage })));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const AIAssistantPage = lazy(() => import("@/pages/AIAssistantPage").then((m) => ({ default: m.AIAssistantPage })));
const AdminProductFormPage = lazy(() => import("@/pages/AdminProductFormPage").then((m) => ({ default: m.AdminProductFormPage })));

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
            <Suspense fallback={<div className="px-4 py-10 text-sm text-muted-foreground">Loading page...</div>}>
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
              <Route
                path="/password-reset"
                element={
                  !isAuthenticated ? (
                    <PasswordResetPage />
                  ) : (
                    <Navigate to="/profile" replace />
                  )
                }
              />
              <Route
                path="/reset-password"
                element={
                  !isAuthenticated ? (
                    <PasswordResetConfirmPage />
                  ) : (
                    <Navigate to="/profile" replace />
                  )
                }
              />

              {/* Protected customer routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/assistant" element={<AIAssistantPage />} />
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
            </Suspense>
            <FloatingAssistantWidget />
            <ThemeToggle />
          </BrowserRouter>
        </FeedbackProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}

export default App;
