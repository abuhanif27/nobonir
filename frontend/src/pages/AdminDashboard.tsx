import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowStateBanner, FlowStateSection } from "@/components/ui/flow-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogOut, Plus } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  category: {
    name: string;
  };
}

interface AdminOrderItem {
  id: number;
  product_name: string;
  unit_price: string;
  quantity: number;
}

interface AdminOrder {
  id: number;
  user_email: string;
  user_name: string;
  item_count: number;
  status:
    | "PENDING"
    | "PAID"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
  subtotal_amount: string;
  discount_amount: string;
  coupon_code: string;
  total_amount: string;
  shipping_address: string;
  billing_address: string;
  items: AdminOrderItem[];
  created_at: string;
}

interface AdminCoupon {
  id: number;
  code: string;
  discount_percent: number;
  expires_at: string;
  is_active: boolean;
  is_expired: boolean;
  usage_count: number;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "CUSTOMER";
  is_active: boolean;
  is_staff: boolean;
}

interface AdminReview {
  id: number;
  user_email: string;
  product_name: string;
  product: number;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

interface AnalyticsSummaryResponse {
  window: {
    days: number;
    from: string;
    to: string;
  };
  events: string[];
  totals: Record<string, number>;
  rates: {
    view_to_add_to_cart_pct: number | null;
    add_to_cart_to_begin_checkout_pct: number | null;
    begin_checkout_to_order_created_pct: number | null;
    order_created_to_payment_success_pct: number | null;
    payment_success_to_review_submitted_pct: number | null;
  };
  daily: Array<{
    date: string;
    counts: Record<string, number>;
    rates: Record<string, number | null>;
  }>;
}

const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

type AdminSection = "orders" | "coupons" | "users" | "products" | "reviews";

export function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderFilters, setOrderFilters] = useState({
    status: "ALL",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [savingCouponId, setSavingCouponId] = useState<number | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);
  const [orderStatusDrafts, setOrderStatusDrafts] = useState<
    Record<number, string>
  >({});
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [couponsError, setCouponsError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [savingReviewId, setSavingReviewId] = useState<number | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<AnalyticsSummaryResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_percent: 10,
    expires_at: "",
    is_active: true,
  });
  const [activeSection, setActiveSection] = useState<AdminSection>("orders");

  useEffect(() => {
    loadProducts();
    loadOrders();
    loadCoupons();
    loadUsers();
    loadReviews();
  }, []);

  useEffect(() => {
    loadAnalyticsSummary(analyticsDays);
  }, [analyticsDays]);

  const pushOrderNotice = (type: "success" | "error", message: string) => {
    if (type === "success") {
      showSuccess(message);
      return;
    }

    showError(message);
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    setProductsError(null);
    try {
      const response = await api.get("/products/products/");
      setProducts(response.data.results || response.data);
    } catch (error: any) {
      console.error("Failed to load products:", error);
      setProducts([]);
      setProductsError(
        error.response?.data?.detail || "Failed to load products.",
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadOrders = async (
    filters: {
      status: string;
      dateFrom: string;
      dateTo: string;
      search: string;
    } = orderFilters,
  ) => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.status !== "ALL") {
        params.status = filters.status;
      }
      if (filters.dateFrom) {
        params.date_from = filters.dateFrom;
      }
      if (filters.dateTo) {
        params.date_to = filters.dateTo;
      }
      if (filters.search.trim()) {
        params.search = filters.search.trim();
      }

      const response = await api.get("/orders/admin/", { params });
      const fetchedOrders = response.data.results || response.data;
      setOrders(fetchedOrders);
      setOrderStatusDrafts(
        Object.fromEntries(
          fetchedOrders.map((order: AdminOrder) => [order.id, order.status]),
        ),
      );
    } catch (error: any) {
      console.error("Failed to load orders:", error);
      setOrders([]);
      setOrdersError(error.response?.data?.detail || "Failed to load orders.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadCoupons = async () => {
    setLoadingCoupons(true);
    setCouponsError(null);
    try {
      const response = await api.get("/orders/admin/coupons/");
      setCoupons(response.data.results || response.data);
    } catch (error: any) {
      console.error("Failed to load coupons:", error);
      setCoupons([]);
      setCouponsError(
        error.response?.data?.detail || "Failed to load coupons.",
      );
    } finally {
      setLoadingCoupons(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const response = await api.get("/accounts/users/");
      setUsers(response.data.results || response.data);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      setUsers([]);
      setUsersError(error.response?.data?.detail || "Failed to load users.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadReviews = async () => {
    setLoadingReviews(true);
    setReviewsError(null);
    try {
      const response = await api.get("/reviews/admin/");
      setReviews(response.data.results || response.data);
    } catch (error: any) {
      console.error("Failed to load reviews:", error);
      setReviews([]);
      setReviewsError(
        error.response?.data?.detail || "Failed to load reviews.",
      );
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadAnalyticsSummary = async (days = analyticsDays) => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const response = await api.get("/analytics/summary/", {
        params: { days },
      });
      setAnalyticsSummary(response.data);
    } catch (error: any) {
      console.error("Failed to load analytics summary:", error);
      setAnalyticsSummary(null);
      setAnalyticsError(
        error.response?.data?.detail || "Failed to load analytics summary.",
      );
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await api.delete(`/products/products/${id}/`);
      setProducts(products.filter((p) => p.id !== id));
      showSuccess("Product deleted successfully");
    } catch (error) {
      showError("Failed to delete product");
    }
  };

  const saveOrderStatus = async (orderId: number) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }

    const nextStatus = orderStatusDrafts[orderId] || order.status;
    if (nextStatus === order.status) {
      pushOrderNotice("error", "No changes to save for this order.");
      return;
    }

    setSavingOrderId(orderId);
    try {
      const response = await api.patch(`/orders/admin/${orderId}/`, {
        status: nextStatus,
      });

      setOrders((current) =>
        current.map((order) => (order.id === orderId ? response.data : order)),
      );
      setOrderStatusDrafts((current) => ({
        ...current,
        [orderId]: response.data.status,
      }));
      pushOrderNotice(
        "success",
        `Order #${orderId} status saved successfully.`,
      );
    } catch (error: any) {
      pushOrderNotice(
        "error",
        error.response?.data?.detail || "Failed to save order status.",
      );
    } finally {
      setSavingOrderId(null);
    }
  };

  const toggleOrderExpand = (orderId: number) => {
    setExpandedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  };

  const createCoupon = async () => {
    if (!newCoupon.code.trim() || !newCoupon.expires_at) {
      pushOrderNotice("error", "Coupon code and expiry date are required.");
      return;
    }

    try {
      await api.post("/orders/admin/coupons/", {
        ...newCoupon,
        code: newCoupon.code.trim().toUpperCase(),
      });
      setNewCoupon({
        code: "",
        discount_percent: 10,
        expires_at: "",
        is_active: true,
      });
      pushOrderNotice("success", "Coupon created successfully.");
      loadCoupons();
    } catch (error: any) {
      pushOrderNotice(
        "error",
        error.response?.data?.detail || "Failed to create coupon.",
      );
    }
  };

  const updateCoupon = async (
    couponId: number,
    payload: Partial<AdminCoupon>,
  ) => {
    setSavingCouponId(couponId);
    try {
      const response = await api.patch(
        `/orders/admin/coupons/${couponId}/`,
        payload,
      );
      setCoupons((current) =>
        current.map((coupon) =>
          coupon.id === couponId ? response.data : coupon,
        ),
      );
      pushOrderNotice("success", `Coupon ${response.data.code} updated.`);
    } catch (error: any) {
      pushOrderNotice(
        "error",
        error.response?.data?.detail || "Failed to update coupon.",
      );
    } finally {
      setSavingCouponId(null);
    }
  };

  const updateUser = async (userId: number, payload: Partial<AdminUser>) => {
    setSavingUserId(userId);
    try {
      const response = await api.patch(`/accounts/users/${userId}/`, payload);
      setUsers((current) =>
        current.map((u) => (u.id === userId ? response.data : u)),
      );
      pushOrderNotice(
        "success",
        `Permissions updated for ${response.data.email}.`,
      );
    } catch (error: any) {
      pushOrderNotice(
        "error",
        error.response?.data?.detail || "Failed to update user permissions.",
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleReviewApproval = async (review: AdminReview) => {
    setSavingReviewId(review.id);
    try {
      const response = await api.patch(`/reviews/admin/${review.id}/`, {
        is_approved: !review.is_approved,
      });
      setReviews((current) =>
        current.map((item) => (item.id === review.id ? response.data : item)),
      );
      pushOrderNotice(
        "success",
        `Review #${review.id} ${response.data.is_approved ? "approved" : "hidden"}.`,
      );
    } catch (error: any) {
      pushOrderNotice(
        "error",
        error.response?.data?.detail || "Failed to update review status.",
      );
    } finally {
      setSavingReviewId(null);
    }
  };

  const deleteReview = async (reviewId: number) => {
    if (!confirm("Delete this review permanently?")) {
      return;
    }

    setSavingReviewId(reviewId);
    try {
      await api.delete(`/reviews/admin/${reviewId}/`);
      setReviews((current) =>
        current.filter((review) => review.id !== reviewId),
      );
      pushOrderNotice("success", `Review #${reviewId} deleted.`);
    } catch (error: any) {
      pushOrderNotice(
        "error",
        error.response?.data?.detail || "Failed to delete review.",
      );
    } finally {
      setSavingReviewId(null);
    }
  };

  const lowStockCount = products.filter((p) => p.stock < 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const pendingOrderCount = orders.filter(
    (order) => order.status === "PENDING",
  ).length;
  const sectionMeta: Array<{ key: AdminSection; label: string }> = [
    { key: "orders", label: "Orders" },
    { key: "coupons", label: "Coupons" },
    { key: "users", label: "Users" },
    { key: "reviews", label: "Reviews" },
    { key: "products", label: "Products" },
  ];
  const formatRate = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(2)}%`;
  const getRateToneClass = (value: number | null) => {
    if (value === null) {
      return "text-muted-foreground";
    }
    if (value >= 60) {
      return "text-emerald-600 dark:text-emerald-400";
    }
    if (value >= 30) {
      return "text-amber-600 dark:text-amber-400";
    }
    return "text-rose-600 dark:text-rose-400";
  };

  return (
    <div className="ds-page">
      {/* Header */}
      <header className="ds-page-header">
        <div className="ds-page-header-row">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="ds-page-title">Admin Dashboard</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.first_name}!
              </span>
              <Link to="/admin/products/new">
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ds-page-container">
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{lowStockCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{pendingOrderCount}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {sectionMeta.map((section) => (
                <Button
                  key={section.key}
                  type="button"
                  size="sm"
                  variant={
                    activeSection === section.key ? "default" : "outline"
                  }
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {activeSection === "orders" && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Funnel Analytics</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Green ≥ 60%
                      </span>
                      {" · "}
                      <span className="text-amber-600 dark:text-amber-400">
                        Amber ≥ 30%
                      </span>
                      {" · "}
                      <span className="text-rose-600 dark:text-rose-400">
                        Rose &lt; 30%
                      </span>
                      {" · "}
                      <span className="text-muted-foreground">Muted = N/A</span>
                    </p>
                  </div>
                  <select
                    value={analyticsDays}
                    onChange={(event) =>
                      setAnalyticsDays(Number(event.target.value))
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={60}>Last 60 days</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <FlowStateSection
                  loading={loadingAnalytics}
                  error={analyticsError}
                  loadingMessage="Loading funnel analytics..."
                  onRetry={() => loadAnalyticsSummary(analyticsDays)}
                >
                  {!analyticsSummary ? (
                    <FlowStateBanner
                      tone="warning"
                      message="Analytics summary is unavailable."
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">
                            Product Views
                          </p>
                          <p className="text-2xl font-semibold">
                            {analyticsSummary.totals.view_product ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Base event
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">
                            Add to Cart
                          </p>
                          <p className="text-2xl font-semibold">
                            {analyticsSummary.totals.add_to_cart ?? 0}
                          </p>
                          <p
                            className={`text-xs ${getRateToneClass(
                              analyticsSummary.rates.view_to_add_to_cart_pct,
                            )}`}
                          >
                            {formatRate(
                              analyticsSummary.rates.view_to_add_to_cart_pct,
                            )}{" "}
                            from views
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">
                            Begin Checkout
                          </p>
                          <p className="text-2xl font-semibold">
                            {analyticsSummary.totals.begin_checkout ?? 0}
                          </p>
                          <p
                            className={`text-xs ${getRateToneClass(
                              analyticsSummary.rates
                                .add_to_cart_to_begin_checkout_pct,
                            )}`}
                          >
                            {formatRate(
                              analyticsSummary.rates
                                .add_to_cart_to_begin_checkout_pct,
                            )}{" "}
                            from cart
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">
                            Orders Created
                          </p>
                          <p className="text-2xl font-semibold">
                            {analyticsSummary.totals.order_created ?? 0}
                          </p>
                          <p
                            className={`text-xs ${getRateToneClass(
                              analyticsSummary.rates
                                .begin_checkout_to_order_created_pct,
                            )}`}
                          >
                            {formatRate(
                              analyticsSummary.rates
                                .begin_checkout_to_order_created_pct,
                            )}{" "}
                            from checkout
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">
                            Payment Success
                          </p>
                          <p className="text-2xl font-semibold">
                            {analyticsSummary.totals.payment_success ?? 0}
                          </p>
                          <p
                            className={`text-xs ${getRateToneClass(
                              analyticsSummary.rates
                                .order_created_to_payment_success_pct,
                            )}`}
                          >
                            {formatRate(
                              analyticsSummary.rates
                                .order_created_to_payment_success_pct,
                            )}{" "}
                            from orders
                          </p>
                        </div>
                      </div>

                      <div className="rounded-md border">
                        <div className="border-b px-3 py-2">
                          <p className="text-sm font-medium">Daily Trend</p>
                        </div>
                        {analyticsSummary.daily.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-muted-foreground">
                            No analytics events in this date range.
                          </p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Views</TableHead>
                                  <TableHead>Add</TableHead>
                                  <TableHead>Checkout</TableHead>
                                  <TableHead>Orders</TableHead>
                                  <TableHead>Paid</TableHead>
                                  <TableHead>View→Cart</TableHead>
                                  <TableHead>Order→Paid</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {analyticsSummary.daily.map((item) => (
                                  <TableRow key={item.date}>
                                    <TableCell className="font-medium">
                                      {new Date(item.date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                      {item.counts.view_product ?? 0}
                                    </TableCell>
                                    <TableCell>
                                      {item.counts.add_to_cart ?? 0}
                                    </TableCell>
                                    <TableCell>
                                      {item.counts.begin_checkout ?? 0}
                                    </TableCell>
                                    <TableCell>
                                      {item.counts.order_created ?? 0}
                                    </TableCell>
                                    <TableCell>
                                      {item.counts.payment_success ?? 0}
                                    </TableCell>
                                    <TableCell
                                      className={getRateToneClass(
                                        item.rates.view_to_add_to_cart_pct,
                                      )}
                                    >
                                      {formatRate(
                                        item.rates.view_to_add_to_cart_pct,
                                      )}
                                    </TableCell>
                                    <TableCell
                                      className={getRateToneClass(
                                        item.rates
                                          .order_created_to_payment_success_pct,
                                      )}
                                    >
                                      {formatRate(
                                        item.rates
                                          .order_created_to_payment_success_pct,
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </FlowStateSection>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Order Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 md:grid-cols-5">
                  <select
                    value={orderFilters.status}
                    onChange={(event) =>
                      setOrderFilters((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="ALL">All Statuses</option>
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={orderFilters.dateFrom}
                    onChange={(event) =>
                      setOrderFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  />

                  <input
                    type="date"
                    value={orderFilters.dateTo}
                    onChange={(event) =>
                      setOrderFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  />

                  <input
                    type="text"
                    value={orderFilters.search}
                    onChange={(event) =>
                      setOrderFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    placeholder="Search by ID/email/name"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  />

                  <div className="flex gap-2">
                    <Button
                      onClick={() => loadOrders()}
                      className="flex-1"
                      size="sm"
                    >
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const reset = {
                          status: "ALL",
                          dateFrom: "",
                          dateTo: "",
                          search: "",
                        };
                        setOrderFilters(reset);
                        loadOrders(reset);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                <FlowStateSection
                  loading={loadingOrders}
                  error={ordersError}
                  isEmpty={orders.length === 0}
                  loadingMessage="Loading orders..."
                  emptyTitle="No orders found"
                  emptyMessage="No orders found for the selected filters."
                  onRetry={() => loadOrders()}
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => {
                          const isExpanded = expandedOrderIds.includes(
                            order.id,
                          );

                          return (
                            <Fragment key={`order-group-${order.id}`}>
                              <TableRow key={`order-${order.id}`}>
                                <TableCell className="font-medium">
                                  #{order.id}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    <p className="font-medium">
                                      {order.user_name}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {order.user_email}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>{order.item_count}</TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    <p className="font-semibold">
                                      {formatPrice(order.total_amount)}
                                    </p>
                                    {Number(order.discount_amount) > 0 && (
                                      <p className="text-emerald-600 text-xs">
                                        Discount{" "}
                                        {formatPrice(order.discount_amount)}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="rounded border px-2 py-1 text-xs font-semibold">
                                    {order.status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {new Date(order.created_at).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <select
                                      value={
                                        orderStatusDrafts[order.id] ||
                                        order.status
                                      }
                                      onChange={(event) =>
                                        setOrderStatusDrafts((current) => ({
                                          ...current,
                                          [order.id]: event.target.value,
                                        }))
                                      }
                                      className="h-8 rounded-md border bg-background px-2 text-xs"
                                      disabled={savingOrderId === order.id}
                                    >
                                      {ORDER_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                    <Button
                                      size="sm"
                                      onClick={() => saveOrderStatus(order.id)}
                                      disabled={
                                        savingOrderId === order.id ||
                                        (orderStatusDrafts[order.id] ||
                                          order.status) === order.status
                                      }
                                    >
                                      {savingOrderId === order.id
                                        ? "Saving..."
                                        : "Save"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        toggleOrderExpand(order.id)
                                      }
                                    >
                                      {isExpanded ? "Hide" : "View"}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {isExpanded && (
                                <TableRow key={`order-${order.id}-details`}>
                                  <TableCell colSpan={7}>
                                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                                      <p className="font-semibold mb-2">
                                        Shipping Address
                                      </p>
                                      <p className="mb-3">
                                        {order.shipping_address || "N/A"}
                                      </p>
                                      <p className="font-semibold mb-2">
                                        Items
                                      </p>
                                      <ul className="space-y-1">
                                        {order.items.map((item) => (
                                          <li key={item.id}>
                                            {item.product_name} ×{" "}
                                            {item.quantity} —{" "}
                                            {formatPrice(item.unit_price)}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </FlowStateSection>
              </CardContent>
            </Card>
          </>
        )}

        {activeSection === "coupons" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Coupon Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-5">
                <input
                  type="text"
                  value={newCoupon.code}
                  onChange={(event) =>
                    setNewCoupon((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Coupon code"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newCoupon.discount_percent}
                  onChange={(event) =>
                    setNewCoupon((current) => ({
                      ...current,
                      discount_percent: Number(event.target.value || 0),
                    }))
                  }
                  placeholder="Discount %"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
                <input
                  type="datetime-local"
                  value={newCoupon.expires_at}
                  onChange={(event) =>
                    setNewCoupon((current) => ({
                      ...current,
                      expires_at: event.target.value,
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                />
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={newCoupon.is_active}
                    onChange={(event) =>
                      setNewCoupon((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  Active coupon
                </label>
                <Button size="sm" onClick={createCoupon}>
                  Create Coupon
                </Button>
              </div>

              <FlowStateSection
                loading={loadingCoupons}
                error={couponsError}
                isEmpty={coupons.length === 0}
                loadingMessage="Loading coupons..."
                emptyTitle="No coupons found"
                emptyMessage="Create a new coupon to get started."
                onRetry={loadCoupons}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map((coupon) => (
                        <TableRow key={coupon.id}>
                          <TableCell className="font-semibold">
                            {coupon.code}
                          </TableCell>
                          <TableCell>{coupon.discount_percent}%</TableCell>
                          <TableCell>{coupon.usage_count}</TableCell>
                          <TableCell>
                            {new Date(coupon.expires_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="rounded border px-2 py-1 text-xs font-semibold">
                              {coupon.is_active
                                ? coupon.is_expired
                                  ? "EXPIRED"
                                  : "ACTIVE"
                                : "INACTIVE"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingCouponId === coupon.id}
                                onClick={() =>
                                  updateCoupon(coupon.id, {
                                    is_active: !coupon.is_active,
                                  })
                                }
                              >
                                {coupon.is_active ? "Disable" : "Enable"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </FlowStateSection>
            </CardContent>
          </Card>
        )}

        {activeSection === "users" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>User & Permission Management</CardTitle>
            </CardHeader>
            <CardContent>
              <FlowStateSection
                loading={loadingUsers}
                error={usersError}
                isEmpty={users.length === 0}
                loadingMessage="Loading users..."
                emptyTitle="No users found"
                emptyMessage="No users are available right now."
                onRetry={loadUsers}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((managedUser) => (
                        <TableRow key={managedUser.id}>
                          <TableCell>
                            {`${managedUser.first_name} ${managedUser.last_name}`.trim() ||
                              managedUser.username}
                          </TableCell>
                          <TableCell>{managedUser.email}</TableCell>
                          <TableCell>
                            <select
                              value={managedUser.role}
                              onChange={(event) =>
                                updateUser(managedUser.id, {
                                  role: event.target.value as
                                    | "ADMIN"
                                    | "CUSTOMER",
                                })
                              }
                              className="h-8 rounded-md border bg-background px-2 text-xs"
                              disabled={savingUserId === managedUser.id}
                            >
                              <option value="CUSTOMER">CUSTOMER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`rounded border px-2 py-1 text-xs font-semibold ${
                                managedUser.is_active
                                  ? "text-emerald-600"
                                  : "text-red-500"
                              }`}
                            >
                              {managedUser.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {managedUser.is_staff ? "Yes" : "No"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingUserId === managedUser.id}
                                onClick={() =>
                                  updateUser(managedUser.id, {
                                    is_active: !managedUser.is_active,
                                  })
                                }
                              >
                                {managedUser.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingUserId === managedUser.id}
                                onClick={() =>
                                  updateUser(managedUser.id, {
                                    is_staff: !managedUser.is_staff,
                                  })
                                }
                              >
                                {managedUser.is_staff
                                  ? "Unset Staff"
                                  : "Make Staff"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </FlowStateSection>
            </CardContent>
          </Card>
        )}

        {activeSection === "products" && (
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
              <FlowStateSection
                loading={loadingProducts}
                error={productsError}
                isEmpty={products.length === 0}
                loadingMessage="Loading products..."
                emptyTitle="No products found"
                emptyMessage="Add products to start managing inventory."
                onRetry={loadProducts}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>{product.id}</TableCell>
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell>{product.category.name}</TableCell>
                          <TableCell>{formatPrice(product.price)}</TableCell>
                          <TableCell>
                            <span
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                product.stock === 0
                                  ? "bg-red-100 text-red-800"
                                  : product.stock < 10
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {product.stock}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link to={`/admin/products/${product.id}`}>
                                <Button variant="outline" size="sm">
                                  Edit
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteProduct(product.id)}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </FlowStateSection>
            </CardContent>
          </Card>
        )}

        {activeSection === "reviews" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Review Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              <FlowStateSection
                loading={loadingReviews}
                error={reviewsError}
                isEmpty={reviews.length === 0}
                loadingMessage="Loading reviews..."
                emptyTitle="No reviews found"
                emptyMessage="Customer reviews will appear here for moderation."
                onRetry={loadReviews}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>{review.id}</TableCell>
                          <TableCell className="font-medium">
                            {review.product_name}
                          </TableCell>
                          <TableCell>{review.user_email}</TableCell>
                          <TableCell>{review.rating}/5</TableCell>
                          <TableCell className="max-w-md">
                            <p className="line-clamp-2">
                              {review.comment || "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="rounded border px-2 py-1 text-xs font-semibold">
                              {review.is_approved ? "APPROVED" : "HIDDEN"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {new Date(review.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={savingReviewId === review.id}
                                onClick={() => toggleReviewApproval(review)}
                              >
                                {review.is_approved ? "Hide" : "Approve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-600 text-white hover:bg-red-700"
                                disabled={savingReviewId === review.id}
                                onClick={() => deleteReview(review.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </FlowStateSection>
            </CardContent>
          </Card>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Out of stock products: {outOfStockCount}
        </p>
      </main>
    </div>
  );
}
