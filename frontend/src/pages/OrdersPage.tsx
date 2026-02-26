import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

interface OrderItem {
  id: number;
  product_name: string;
  unit_price: string | number;
  quantity: number;
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);

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
                      <div className="overflow-hidden rounded-lg border">
                        <div className="hidden grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                          <span>Item</span>
                          <span>Qty</span>
                          <span>Subtotal</span>
                        </div>
                        <div className="divide-y">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:gap-3"
                            >
                              <span className="font-medium text-slate-800">
                                {item.product_name}
                              </span>
                              <span className="text-slate-600 sm:text-right">
                                x{item.quantity}
                              </span>
                              <span className="font-semibold text-slate-900 sm:text-right">
                                {formatPrice(
                                  toAmount(item.unit_price) * item.quantity,
                                )}
                              </span>
                            </div>
                          ))}
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
