import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import {
  getErrorData,
  getErrorFieldMessages,
  getErrorMessage,
} from "@/lib/apiError";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowStateBanner, FlowStateCard } from "@/components/ui/flow-state";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Package,
  RefreshCw,
  Star,
  Truck,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

type TimelineStatus = Exclude<OrderStatus, "CANCELLED">;

interface OrderItem {
  id: number;
  product: number;
  product_name: string;
  unit_price: string | number;
  quantity: number;
}

interface MyReview {
  id: number;
  product: number;
  rating: number;
  comment: string;
}

interface Order {
  id: number;
  status: OrderStatus;
  subtotal_amount: string | number;
  discount_amount: string | number;
  coupon_code: string | null;
  total_amount: string | number;
  shipping_address: string;
  billing_address: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

const STATUS_STEPS: TimelineStatus[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Order Received",
  PAID: "Payment Confirmed",
  PROCESSING: "Preparing Items",
  SHIPPED: "On the Way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_TIMELINE_LABELS: Record<TimelineStatus, string> = {
  PENDING: "Order received",
  PAID: "Payment confirmed",
  PROCESSING: "Preparing items",
  SHIPPED: "Out for delivery",
  DELIVERED: "Delivered",
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PROCESSING: "bg-blue-100 text-blue-800 border-blue-200",
  SHIPPED: "bg-cyan-100 text-cyan-800 border-cyan-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
};

const FILTERS: Array<{ key: "ALL" | OrderStatus; label: string }> = [
  { key: "ALL", label: "All Orders" },
  { key: "PENDING", label: "Order Received" },
  { key: "PROCESSING", label: "Preparing" },
  { key: "SHIPPED", label: "On the Way" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

const toAmount = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getProgressPercent = (status: OrderStatus) => {
  if (status === "CANCELLED") {
    return 100;
  }

  const index = STATUS_STEPS.indexOf(status);
  if (index < 0) {
    return 0;
  }

  return ((index + 1) / STATUS_STEPS.length) * 100;
};

const getStatusIcon = (status: OrderStatus) => {
  if (status === "DELIVERED") {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (status === "SHIPPED") {
    return <Truck className="h-4 w-4" />;
  }
  if (status === "CANCELLED") {
    return <XCircle className="h-4 w-4" />;
  }
  return <Clock3 className="h-4 w-4" />;
};

export function OrdersPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(true);
  const [myReviewsError, setMyReviewsError] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<number, { rating: number; comment: string }>
  >({});
  const [reviewHoverRatings, setReviewHoverRatings] = useState<
    Record<number, number>
  >({});
  const [savingReviewProductId, setSavingReviewProductId] = useState<
    number | null
  >(null);

  const loadOrders = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/orders/my/");
      const data = Array.isArray(response.data) ? response.data : [];
      setOrders(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load your orders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = (params.get("status") || "").toUpperCase();

    const validStatuses: OrderStatus[] = [
      "PENDING",
      "PAID",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (statusParam === "ALL") {
      setActiveFilter("ALL");
      return;
    }

    if (validStatuses.includes(statusParam as OrderStatus)) {
      setActiveFilter(statusParam as OrderStatus);
    }
  }, [location.search]);

  const loadMyReviews = async () => {
    setMyReviewsLoading(true);
    setMyReviewsError(null);

    try {
      const response = await api.get("/reviews/my/");
      const mine = response.data.results || response.data;
      setMyReviews(Array.isArray(mine) ? mine : []);
    } catch {
      setMyReviews([]);
      setMyReviewsError("Couldn’t load your review status.");
    } finally {
      setMyReviewsLoading(false);
    }
  };

  useEffect(() => {
    loadMyReviews();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentParam = params.get("payment");
    const sessionFlashRaw = sessionStorage.getItem("nobonir_flash_notice");

    if (!paymentParam && sessionFlashRaw) {
      try {
        const sessionFlash = JSON.parse(sessionFlashRaw) as {
          variant?: "card" | "cod";
          message?: string;
        };

        if (sessionFlash.message) {
          if (sessionFlash.variant === "card") {
            showSuccess(sessionFlash.message);
          } else {
            showSuccess(sessionFlash.message);
          }
          sessionStorage.removeItem("nobonir_flash_notice");
          return;
        }
      } catch {
        sessionStorage.removeItem("nobonir_flash_notice");
      }
    }

    if (paymentParam === "success") {
      showSuccess("Payment successful. Your order is now being processed");
    } else if (paymentParam === "cod") {
      showSuccess(
        "Order placed with Cash on Delivery. Please keep payment ready upon delivery",
      );
    }

    if (paymentParam) {
      params.delete("payment");
      const query = params.toString();
      const nextUrl = `${location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [location.pathname, location.search, showSuccess]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "ALL") {
      return orders;
    }

    return orders.filter((order) => order.status === activeFilter);
  }, [orders, activeFilter]);

  const totals = useMemo(() => {
    const totalOrders = orders.length;
    const totalSpent = orders.reduce(
      (sum, order) => sum + toAmount(order.total_amount),
      0,
    );
    const inTransit = orders.filter(
      (order) => order.status === "SHIPPED",
    ).length;
    const delivered = orders.filter(
      (order) => order.status === "DELIVERED",
    ).length;

    return {
      totalOrders,
      totalSpent,
      inTransit,
      delivered,
    };
  }, [orders]);

  const toggleExpanded = (orderId: number) => {
    setExpandedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  };

  const hasReviewedProduct = (productId: number) =>
    myReviews.some((review) => Number(review.product) === Number(productId));

  const saveReview = async (productId: number) => {
    const draft = reviewDrafts[productId] || { rating: 5, comment: "" };
    setSavingReviewProductId(productId);
    try {
      await api.post("/reviews/", {
        product: productId,
        rating: draft.rating,
        comment: draft.comment,
      });
      showSuccess("Review submitted successfully");
      await loadMyReviews();
    } catch (error: unknown) {
      const data = getErrorData(error);
      const productError = getErrorFieldMessages(error, "product")[0];
      showError(
        (typeof data?.detail === "string" && data.detail) ||
          productError ||
          "Failed to submit review",
      );
    } finally {
      setSavingReviewProductId(null);
    }
  };

  const downloadInvoice = async (order: Order) => {
    try {
      const response = await api.get(`/orders/my/${order.id}/invoice.pdf/`, {
        responseType: "blob",
      });

      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const contentDisposition = String(
        response.headers["content-disposition"] || "",
      );
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      anchor.download = filenameMatch?.[1] || `invoice-order-${order.id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      showSuccess(`Invoice downloaded for order #${order.id}`);
    } catch {
      showError("Could not download invoice. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="ds-page-header">
        <div className="ds-page-header-row">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 shadow-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="ds-page-title text-xl">My Orders</h1>
              <p className="ds-page-subtitle text-xs">
                Track your purchases in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Shop
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={loadOrders}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="ds-page-container">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="ds-surface-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {totals.totalOrders}
              </p>
            </CardContent>
          </Card>
          <Card className="ds-surface-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatPrice(totals.totalSpent)}
              </p>
            </CardContent>
          </Card>
          <Card className="ds-surface-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">In Transit</p>
              <p className="mt-1 text-2xl font-bold text-cyan-700">
                {totals.inTransit}
              </p>
            </CardContent>
          </Card>
          <Card className="ds-surface-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Delivered</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {totals.delivered}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 ds-surface-card">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  size="sm"
                  variant={activeFilter === filter.key ? "default" : "outline"}
                  onClick={() => setActiveFilter(filter.key)}
                  className={
                    activeFilter === filter.key
                      ? "bg-gradient-to-r from-teal-500 to-cyan-600"
                      : ""
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <FlowStateCard
            className="ds-surface-card"
            message="Loading your orders..."
          />
        ) : error ? (
          <FlowStateCard
            className="ds-surface-card"
            title="Unable to load orders"
            message={error}
            messageClassName="text-rose-600"
            actionLabel="Try Again"
            actionVariant="default"
            onAction={loadOrders}
          />
        ) : filteredOrders.length === 0 ? (
          <FlowStateCard
            className="ds-surface-card"
            icon={Package}
            title="No orders yet"
            message="Once you place an order, it will appear here."
            actionLabel="Start Shopping"
            actionVariant="default"
            onAction={() => navigate("/")}
          />
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const expanded = expandedOrderIds.includes(order.id);
              const progress = getProgressPercent(order.status);
              const activeStepIndex =
                order.status === "CANCELLED"
                  ? -1
                  : STATUS_STEPS.indexOf(order.status);
              const groupedItems = order.items.reduce(
                (groups, item) => {
                  const existing = groups[item.product];

                  if (existing) {
                    existing.quantity += item.quantity;
                    existing.subtotal +=
                      toAmount(item.unit_price) * item.quantity;
                    existing.lineCount += 1;
                    return groups;
                  }

                  groups[item.product] = {
                    id: item.id,
                    product: item.product,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    subtotal: toAmount(item.unit_price) * item.quantity,
                    lineCount: 1,
                  };

                  return groups;
                },
                {} as Record<
                  number,
                  {
                    id: number;
                    product: number;
                    product_name: string;
                    quantity: number;
                    subtotal: number;
                    lineCount: number;
                  }
                >,
              );
              const displayItems = Object.values(groupedItems).sort((a, b) =>
                a.product_name.localeCompare(b.product_name),
              );
              const totalLines = order.items.length;
              const totalUnits = displayItems.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );

              return (
                <Card
                  key={order.id}
                  className="ds-surface-card overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-foreground">
                          Order #{order.id}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Placed on {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => downloadInvoice(order)}
                        >
                          <Download className="h-4 w-4" />
                          Download Invoice
                        </Button>
                        <Badge className={STATUS_CLASSES[order.status]}>
                          <span className="mr-1">
                            {getStatusIcon(order.status)}
                          </span>
                          {STATUS_LABELS[order.status]}
                        </Badge>
                        <span className="text-base font-bold text-foreground">
                          {formatPrice(order.total_amount)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Order timeline</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            order.status === "CANCELLED"
                              ? "bg-rose-500"
                              : "bg-gradient-to-r from-teal-500 to-cyan-600"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {order.status === "CANCELLED" ? (
                        <p className="mt-2 text-xs font-medium text-rose-600">
                          This order was cancelled on{" "}
                          {formatDate(order.updated_at)}.
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {STATUS_STEPS.map((step, index) => {
                            const complete = index <= activeStepIndex;
                            return (
                              <div
                                key={`${order.id}-${step}`}
                                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                  complete
                                    ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-700/50 dark:bg-teal-900/30 dark:text-teal-300"
                                    : "border-border bg-background text-muted-foreground"
                                }`}
                              >
                                {STATUS_TIMELINE_LABELS[step]}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                      <p className="font-medium text-foreground">
                        Shipping Address
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {order.shipping_address}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => toggleExpanded(order.id)}
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Hide Items
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          View Items ({displayItems.length} product
                          {displayItems.length > 1 ? "s" : ""}, {totalLines}{" "}
                          line
                          {totalLines > 1 ? "s" : ""})
                        </>
                      )}
                    </Button>

                    {expanded && (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-3 text-xs">
                          <p className="font-medium text-foreground">
                            {displayItems.length} grouped product
                            {displayItems.length > 1 ? "s" : ""}
                          </p>
                          <p className="text-muted-foreground">
                            {totalUnits} unit{totalUnits > 1 ? "s" : ""} across{" "}
                            {totalLines} line
                            {totalLines > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="hidden grid-cols-[1fr_auto_auto] gap-3 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                          <span>Item</span>
                          <span>Qty</span>
                          <span>Subtotal</span>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                          {displayItems.map((item) => {
                            return (
                              <div
                                key={item.id}
                                className="grid grid-cols-1 gap-2 px-4 py-3 text-sm text-foreground sm:grid-cols-[1fr_auto_auto] sm:gap-3"
                              >
                                <span className="font-medium text-foreground">
                                  <Link
                                    to={`/product/${item.product}#share-feedback`}
                                    className="underline-offset-4 hover:text-cyan-600 hover:underline dark:hover:text-cyan-400"
                                  >
                                    {item.product_name}
                                  </Link>
                                  <div className="mt-1 flex items-center gap-2 text-xs">
                                    <Link
                                      to={`/product/${item.product}#share-feedback`}
                                      className="font-medium text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-400"
                                    >
                                      View Product
                                    </Link>
                                    {item.lineCount > 1 && (
                                      <span className="text-muted-foreground">
                                        Grouped from {item.lineCount} lines
                                      </span>
                                    )}
                                  </div>
                                </span>
                                <span className="text-muted-foreground sm:text-right">
                                  x{item.quantity}
                                </span>
                                <span className="font-semibold text-foreground sm:text-right">
                                  {formatPrice(item.subtotal)}
                                </span>

                                {order.status === "DELIVERED" && (
                                  <div className="sm:col-span-3 rounded-md border border-border p-3">
                                    {myReviewsLoading ? (
                                      <FlowStateBanner
                                        tone="info"
                                        message="Loading review panel..."
                                        className="text-xs"
                                      />
                                    ) : myReviewsError ? (
                                      <FlowStateBanner
                                        tone="error"
                                        message={myReviewsError}
                                        actionLabel="Try Again"
                                        onAction={loadMyReviews}
                                        className="text-xs"
                                      />
                                    ) : hasReviewedProduct(item.product) ? (
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                          You already reviewed this product.
                                        </p>
                                        <Link
                                          to={`/product/${item.product}#share-feedback`}
                                        >
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                          >
                                            View / Edit Review
                                          </Button>
                                        </Link>
                                      </div>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <div>
                                          <div className="flex items-center gap-1">
                                            {Array.from({ length: 5 }).map(
                                              (_, index) => {
                                                const value = index + 1;
                                                const selectedRating =
                                                  reviewDrafts[item.product]
                                                    ?.rating ?? 5;
                                                const active =
                                                  (reviewHoverRatings[
                                                    item.product
                                                  ] || selectedRating) >= value;

                                                return (
                                                  <button
                                                    key={`order-review-${item.product}-${value}`}
                                                    type="button"
                                                    onMouseEnter={() =>
                                                      setReviewHoverRatings(
                                                        (current) => ({
                                                          ...current,
                                                          [item.product]: value,
                                                        }),
                                                      )
                                                    }
                                                    onMouseLeave={() =>
                                                      setReviewHoverRatings(
                                                        (current) => ({
                                                          ...current,
                                                          [item.product]: 0,
                                                        }),
                                                      )
                                                    }
                                                    onClick={() =>
                                                      setReviewDrafts(
                                                        (current) => ({
                                                          ...current,
                                                          [item.product]: {
                                                            rating: value,
                                                            comment:
                                                              current[
                                                                item.product
                                                              ]?.comment || "",
                                                          },
                                                        }),
                                                      )
                                                    }
                                                    className="rounded p-0.5 transition-transform duration-200 hover:scale-110"
                                                    aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                                                  >
                                                    <Star
                                                      className={`h-4 w-4 transition-all duration-200 ${
                                                        active
                                                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.45)]"
                                                          : "text-muted-foreground"
                                                      }`}
                                                    />
                                                  </button>
                                                );
                                              },
                                            )}
                                          </div>
                                          <p className="mt-1 text-[11px] text-muted-foreground">
                                            {reviewDrafts[item.product]
                                              ?.rating ?? 5}{" "}
                                            / 5 selected
                                          </p>
                                        </div>
                                        <input
                                          type="text"
                                          placeholder="Write review comment"
                                          value={
                                            reviewDrafts[item.product]
                                              ?.comment ?? ""
                                          }
                                          onChange={(event) =>
                                            setReviewDrafts((current) => ({
                                              ...current,
                                              [item.product]: {
                                                rating:
                                                  current[item.product]
                                                    ?.rating ?? 5,
                                                comment: event.target.value,
                                              },
                                            }))
                                          }
                                          className="h-9 rounded-md border bg-background px-3 text-xs"
                                        />
                                        <div className="sm:col-span-2 sm:flex sm:justify-end">
                                          <Button
                                            size="sm"
                                            onClick={() =>
                                              saveReview(item.product)
                                            }
                                            disabled={
                                              myReviewsLoading ||
                                              savingReviewProductId ===
                                                item.product
                                            }
                                          >
                                            {savingReviewProductId ===
                                            item.product
                                              ? "Saving..."
                                              : "Review"}
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
