import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogOut, Plus, X } from "lucide-react";

const ADMIN_ORDER_NOTICE_KEY = "nobonir_admin_order_notice";

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

const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderFilters, setOrderFilters] = useState({
    status: "ALL",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([]);
  const [orderStatusDrafts, setOrderStatusDrafts] = useState<
    Record<number, string>
  >({});
  const [orderNotice, setOrderNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    loadProducts();
    loadOrders();

    const storedNotice = sessionStorage.getItem(ADMIN_ORDER_NOTICE_KEY);
    if (storedNotice) {
      try {
        const parsed = JSON.parse(storedNotice);
        if (parsed?.type && parsed?.message) {
          setOrderNotice(parsed);
        }
      } catch {
        // ignore malformed session notice
      }
      sessionStorage.removeItem(ADMIN_ORDER_NOTICE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!orderNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOrderNotice(null);
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [orderNotice]);

  const pushOrderNotice = (type: "success" | "error", message: string) => {
    const nextNotice = { type, message };
    setOrderNotice(nextNotice);
    sessionStorage.setItem(ADMIN_ORDER_NOTICE_KEY, JSON.stringify(nextNotice));
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await api.get("/products/products/");
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error("Failed to load products:", error);
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
    } catch (error) {
      console.error("Failed to load orders:", error);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const deleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await api.delete(`/products/products/${id}/`);
      setProducts(products.filter((p) => p.id !== id));
      alert("Product deleted successfully");
    } catch (error) {
      alert("Failed to delete product");
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

  const lowStockCount = products.filter((p) => p.stock < 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const pendingOrderCount = orders.filter(
    (order) => order.status === "PENDING",
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Admin Dashboard
            </h1>
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {orderNotice && (
          <div
            className={`mb-4 flex items-center justify-between rounded-md border px-4 py-3 text-sm shadow-sm ${
              orderNotice.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300"
            }`}
          >
            <span>{orderNotice.message}</span>
            <button
              type="button"
              onClick={() => setOrderNotice(null)}
              aria-label="Dismiss message"
              className="ml-3 inline-flex h-6 w-6 items-center justify-center rounded border border-current/30 bg-transparent text-xs opacity-80 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3 mb-8">
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

            {loadingOrders ? (
              <p className="text-center text-gray-600">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No orders found for the selected filters.
              </p>
            ) : (
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
                      const isExpanded = expandedOrderIds.includes(order.id);

                      return (
                        <Fragment key={`order-group-${order.id}`}>
                          <TableRow key={`order-${order.id}`}>
                            <TableCell className="font-medium">
                              #{order.id}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="font-medium">{order.user_name}</p>
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
                                    orderStatusDrafts[order.id] || order.status
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
                                  onClick={() => toggleOrderExpand(order.id)}
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
                                  <p className="font-semibold mb-2">Items</p>
                                  <ul className="space-y-1">
                                    {order.items.map((item) => (
                                      <li key={item.id}>
                                        {item.product_name} × {item.quantity} —{" "}
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <p className="text-center text-gray-600">Loading...</p>
            ) : (
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
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-xs text-muted-foreground">
          Out of stock products: {outOfStockCount}
        </p>
      </main>
    </div>
  );
}
