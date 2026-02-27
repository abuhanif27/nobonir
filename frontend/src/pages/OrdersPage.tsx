import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Package,
  RefreshCw,
  Star,
  Truck,
  CheckCircle2,
  Clock3,
  X,
  XCircle,
} from "lucide-react";

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

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
  total_amount: string | number;
  shipping_address: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

const STATUS_STEPS: OrderStatus[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
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
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "Shipped" },
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
  const { formatPrice } = useCurrency();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentNoticeVariant, setPaymentNoticeVariant] = useState<
    "card" | "cod" | null
  >(null);
  const [activeFilter, setActiveFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
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
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load your orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const loadMyReviews = async () => {
      try {
        const response = await api.get("/reviews/my/");
        const mine = response.data.results || response.data;
        setMyReviews(Array.isArray(mine) ? mine : []);
      } catch {
        setMyReviews([]);
      }
    };

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
          setPaymentNoticeVariant(sessionFlash.variant ?? "cod");
          setPaymentNotice(sessionFlash.message);
          sessionStorage.removeItem("nobonir_flash_notice");
          return;
        }
      } catch {
        sessionStorage.removeItem("nobonir_flash_notice");
      }
    }

    if (paymentParam === "success") {
      setPaymentNoticeVariant("card");
      setPaymentNotice(
        "Payment successful. Your order is now being processed.",
      );
    } else if (paymentParam === "cod") {
      setPaymentNoticeVariant("cod");
      setPaymentNotice(
        "Order placed with Cash on Delivery. Please keep payment ready upon delivery.",
      );
    } else {
      setPaymentNotice("");
      setPaymentNoticeVariant(null);
    }

    if (paymentParam) {
      params.delete("payment");
      const query = params.toString();
      const nextUrl = `${location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [location.search]);

  useEffect(() => {
    if (!paymentNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPaymentNotice("");
      setPaymentNoticeVariant(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [paymentNotice]);

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
      setPaymentNoticeVariant("card");
      setPaymentNotice("Review submitted successfully.");
      const response = await api.get("/reviews/my/");
      const mine = response.data.results || response.data;
      setMyReviews(Array.isArray(mine) ? mine : []);
    } catch (error: any) {
      setPaymentNoticeVariant(null);
      setPaymentNotice(
        error.response?.data?.detail ||
          error.response?.data?.product?.[0] ||
          "Unable to submit review.",
      );
    } finally {
      setSavingReviewProductId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 shadow-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">My Orders</h1>
              <p className="text-xs text-slate-500">
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
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {paymentNotice && (
          <Card
            className={`mb-6 shadow-sm ${
              paymentNoticeVariant === "card"
                ? "border-emerald-300 bg-emerald-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <CardContent className="py-4 text-sm text-emerald-800">
              {paymentNoticeVariant === "card" ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-100 p-2">
                      <CheckCircle2 className="h-5 w-5 animate-pulse text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-900">
                        Payment Successful
                      </p>
                      <p>{paymentNotice}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
                    onClick={() => {
                      setPaymentNotice("");
                      setPaymentNoticeVariant(null);
                    }}
                    aria-label="Close notification"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p>{paymentNotice}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
                    onClick={() => {
                      setPaymentNotice("");
                      setPaymentNoticeVariant(null);
                    }}
                    aria-label="Close notification"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Total Orders</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {totals.totalOrders}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Total Spent</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatPrice(totals.totalSpent)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">In Transit</p>
              <p className="mt-1 text-2xl font-bold text-cyan-700">
                {totals.inTransit}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Delivered</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {totals.delivered}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-0 bg-white shadow-sm">
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
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="py-16 text-center text-slate-500">
              Loading your orders...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-rose-600">{error}</p>
              <Button className="mt-4" onClick={loadOrders}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="py-16 text-center">
              <Package className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-xl font-semibold text-slate-900">
                No orders yet
              </h3>
              <p className="mt-2 text-slate-500">
                Once you place an order, it will appear here.
              </p>
              <Link to="/" className="inline-block">
                <Button className="mt-5 bg-gradient-to-r from-teal-500 to-cyan-600">
                  Start Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const expanded = expandedOrderIds.includes(order.id);
              const progress = getProgressPercent(order.status);
              const productLineCounts = order.items.reduce(
                (counts, item) => {
                  counts[item.product] = (counts[item.product] || 0) + 1;
                  return counts;
                },
                {} as Record<number, number>,
              );
              const renderedProducts = new Set<number>();

              return (
                <Card
                  key={order.id}
                  className="overflow-hidden border-0 bg-white shadow-sm"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg text-slate-900">
                          Order #{order.id}
                        </CardTitle>
                        <p className="text-sm text-slate-500">
                          Placed on {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_CLASSES[order.status]}>
                          <span className="mr-1">
                            {getStatusIcon(order.status)}
                          </span>
                          {STATUS_LABELS[order.status]}
                        </Badge>
                        <span className="text-base font-bold text-slate-900">
                          {formatPrice(order.total_amount)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                        <span>Order Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            order.status === "CANCELLED"
                              ? "bg-rose-500"
                              : "bg-gradient-to-r from-teal-500 to-cyan-600"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-800">
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
                          View Items ({order.items.length})
                        </>
                      )}
                    </Button>

                    {expanded && (
                      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="hidden grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:grid">
                          <span>Item</span>
                          <span>Qty</span>
                          <span>Subtotal</span>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                          {order.items.map((item) => {
                            const isFirstProductLine = !renderedProducts.has(
                              item.product,
                            );
                            if (isFirstProductLine) {
                              renderedProducts.add(item.product);
                            }

                            return (
                              <div
                                key={item.id}
                                className="grid grid-cols-1 gap-2 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-[1fr_auto_auto] sm:gap-3"
                              >
                                <span className="font-medium text-slate-800 dark:text-slate-100">
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
                                    {productLineCounts[item.product] > 1 && (
                                      <span className="text-slate-500 dark:text-slate-400">
                                        Ordered in{" "}
                                        {productLineCounts[item.product]} lines
                                      </span>
                                    )}
                                  </div>
                                </span>
                                <span className="text-slate-600 dark:text-slate-300 sm:text-right">
                                  x{item.quantity}
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100 sm:text-right">
                                  {formatPrice(
                                    toAmount(item.unit_price) * item.quantity,
                                  )}
                                </span>

                                {order.status === "DELIVERED" &&
                                  isFirstProductLine && (
                                    <div className="sm:col-span-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                                      {hasReviewedProduct(item.product) ? (
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
                                                    ] || selectedRating) >=
                                                    value;

                                                  return (
                                                    <button
                                                      key={`order-review-${item.product}-${value}`}
                                                      type="button"
                                                      onMouseEnter={() =>
                                                        setReviewHoverRatings(
                                                          (current) => ({
                                                            ...current,
                                                            [item.product]:
                                                              value,
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
                                                                ]?.comment ||
                                                                "",
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
                                                            : "text-slate-400"
                                                        }`}
                                                      />
                                                    </button>
                                                  );
                                                },
                                              )}
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
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
