import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingCart,
  Trash2,
  ArrowLeft,
  LogIn,
  Minus,
  Plus,
  AlertTriangle,
} from "lucide-react";

interface CartItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
    image_url?: string;
    stock: number;
  };
  quantity: number;
  isLocal?: boolean;
}

export function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const getLocalCartItems = (): CartItem[] => {
    const raw = localStorage.getItem("nobonir_demo_cart");
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((item) => ({ ...item, isLocal: true }))
        : [];
    } catch {
      return [];
    }
  };

  const setLocalCartItems = (items: CartItem[]) => {
    localStorage.setItem("nobonir_demo_cart", JSON.stringify(items));
  };

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const response = await api.get("/cart/");
      const apiItems = response.data;
      if (Array.isArray(apiItems) && apiItems.length > 0) {
        setCartItems(apiItems);
      } else {
        setCartItems(getLocalCartItems());
      }
    } catch (error) {
      console.error("Failed to load cart:", error);
      setCartItems(getLocalCartItems());
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    const localItem = cartItems.find(
      (item) => item.id === itemId && item.isLocal,
    );
    if (localItem) {
      const updated =
        quantity <= 0
          ? cartItems.filter((item) => item.id !== itemId)
          : cartItems.map((item) =>
              item.id === itemId ? { ...item, quantity } : item,
            );
      setCartItems(updated);
      setLocalCartItems(updated.filter((item) => item.isLocal));
      return;
    }

    try {
      if (quantity <= 0) {
        await api.delete(`/cart/items/${itemId}/`);
      } else {
        await api.patch(`/cart/items/${itemId}/`, { quantity });
      }
      await loadCart();
    } catch (error) {
      console.error("Failed to update quantity:", error);
    }
  };

  const removeItem = async (itemId: number) => {
    const localItem = cartItems.find(
      (item) => item.id === itemId && item.isLocal,
    );
    if (localItem) {
      const updated = cartItems.filter((item) => item.id !== itemId);
      setCartItems(updated);
      setLocalCartItems(updated.filter((item) => item.isLocal));
      return;
    }

    try {
      await api.delete(`/cart/items/${itemId}/`);
      await loadCart();
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const requestClearAllCart = () => {
    if (cartItems.length === 0) {
      return;
    }

    setClearConfirmOpen(true);
  };

  const clearAllCart = async () => {
    setClearingAll(true);

    const hasLocalItems = cartItems.some((item) => item.isLocal);
    if (hasLocalItems) {
      setLocalCartItems([]);
      setCartItems([]);
      setClearingAll(false);
      setClearConfirmOpen(false);
      return;
    }

    try {
      await Promise.all(
        cartItems.map((item) => api.delete(`/cart/items/${item.id}/`)),
      );
      setCartItems([]);
      setClearConfirmOpen(false);
    } catch (error) {
      console.error("Failed to clear cart:", error);
      await loadCart();
    } finally {
      setClearingAll(false);
    }
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      if (confirm("You must be logged in to checkout. Go to login page?")) {
        navigate("/login");
      }
      return;
    }

    if (!shippingAddress.trim()) {
      alert("Please enter a shipping address");
      return;
    }

    setCheckoutLoading(true);
    try {
      await api.post("/orders/checkout/", {
        shipping_address: shippingAddress,
      });
      alert("Order placed successfully!");
      setShippingAddress("");
      await loadCart();
      navigate("/orders");
    } catch (error: any) {
      alert(error.response?.data?.detail || "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-background">
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-all duration-300 ${
          clearConfirmOpen
            ? "pointer-events-auto bg-black/45 opacity-100 backdrop-blur-sm"
            : "pointer-events-none bg-black/0 opacity-0 backdrop-blur-0"
        }`}
      >
        <div
          className={`w-full max-w-md transform transition-all duration-300 ${
            clearConfirmOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-6 scale-95 opacity-0"
          }`}
        >
          <Card className="overflow-hidden border-0 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2 text-red-600 shadow-sm">
                  <AlertTriangle className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Clear all cart items?
                  </h3>
                  <p className="text-sm text-gray-600">
                    This will remove everything from your cart.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setClearConfirmOpen(false)}
                  disabled={clearingAll}
                  className="border-slate-300 bg-white text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-100 hover:shadow-md active:translate-y-0"
                >
                  Cancel
                </Button>
                <Button
                  onClick={clearAllCart}
                  disabled={clearingAll}
                  className="group relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 text-white transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:from-red-700 hover:to-rose-700 hover:shadow-[0_12px_24px_rgba(220,38,38,0.35)] active:translate-y-0"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  {clearingAll ? "Clearing..." : "Yes, Clear All"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Header */}
      <header className="bg-card shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Shopping Cart
            </h1>
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-center text-gray-600">Loading cart...</p>
        ) : cartItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="mx-auto h-16 w-16 text-gray-400" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                Your cart is empty
              </h2>
              <p className="mt-2 text-gray-600">
                Add some products to get started!
              </p>
              <Link to="/">
                <Button className="mt-4">Browse Products</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-col items-start justify-between gap-2 space-y-0 sm:flex-row sm:items-center">
                  <CardTitle>Cart Items ({cartItems.length})</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestClearAllCart}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <img
                          src={
                            item.product.image ||
                            item.product.image_url ||
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop"
                          }
                          alt={item.product.name}
                          className="h-20 w-20 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop";
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.product.name}</h3>
                          <p className="text-sm text-gray-600">
                            {formatPrice(item.product.price)} each
                          </p>
                          <p className="text-sm text-gray-500">
                            Stock: {item.product.stock}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center rounded-md border bg-white">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 px-2 rounded-r-none"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-10 text-center text-sm font-semibold">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 px-2 rounded-l-none"
                              onClick={() =>
                                updateQuantity(
                                  item.id,
                                  Math.min(
                                    item.product.stock,
                                    item.quantity + 1,
                                  ),
                                )
                              }
                              disabled={item.quantity >= item.product.stock}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold">
                            {formatPrice(
                              parseFloat(item.product.price) * item.quantity,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Checkout Section */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span>{formatPrice(total)}</span>
                  </div>

                  {!isAuthenticated && (
                    <div className="rounded-md bg-yellow-50 p-4">
                      <p className="text-sm text-yellow-800">
                        You're browsing as a guest. Please{" "}
                        <Link to="/login" className="font-semibold underline">
                          login
                        </Link>{" "}
                        or{" "}
                        <Link
                          to="/register"
                          className="font-semibold underline"
                        >
                          create an account
                        </Link>{" "}
                        to checkout.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Shipping Address
                    </label>
                    <Textarea
                      placeholder="Enter your shipping address..."
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      disabled={!isAuthenticated}
                      rows={4}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCheckout}
                    disabled={!isAuthenticated || checkoutLoading}
                  >
                    {!isAuthenticated ? (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Login to Checkout
                      </>
                    ) : checkoutLoading ? (
                      "Processing..."
                    ) : (
                      "Place Order"
                    )}
                  </Button>

                  {!isAuthenticated && (
                    <Link to="/login">
                      <Button variant="outline" className="w-full">
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
