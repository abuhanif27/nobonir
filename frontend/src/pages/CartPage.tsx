import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingCart,
  Trash2,
  ArrowLeft,
  LogIn,
  Minus,
  Plus,
  AlertTriangle,
  CreditCard,
  Banknote,
  ShieldCheck,
  Truck,
  TicketPercent,
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

interface CouponPreview {
  code: string;
  discount_percent: number;
  subtotal: string;
  discount: string;
  total: string;
  expires_at: string;
}

export function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { formatPrice } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "COD">("CARD");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(
    null,
  );
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponNotice, setCouponNotice] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
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

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentState = params.get("payment");
    const orderId = params.get("order_id");

    if (paymentState === "cancelled") {
      const cancelPendingOrder = async () => {
        if (!orderId) {
          setPaymentNotice("Payment was cancelled.");
          return;
        }

        try {
          await api.post("/payments/stripe/cancel/", {
            order_id: Number(orderId),
          });
          setPaymentNotice(
            "Payment was cancelled and the pending order has been cancelled.",
          );
        } catch (error: any) {
          const message =
            error.response?.data?.detail ||
            "Payment was cancelled. Unable to auto-cancel order.";
          setPaymentNotice(message);
        }
      };

      cancelPendingOrder();
      return;
    }

    setPaymentNotice("");
  }, [location.search]);

  useEffect(() => {
    if (useShippingAsBilling) {
      setBillingAddress(shippingAddress);
    }
  }, [shippingAddress, useShippingAsBilling]);

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

  const syncLocalCartToServer = async () => {
    const localItems = getLocalCartItems();
    if (localItems.length === 0) {
      return;
    }

    for (const item of localItems) {
      await api.post("/cart/items/", {
        product_id: item.product.id,
        quantity: item.quantity,
      });
    }

    setLocalCartItems([]);
    await loadCart();
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      setPaymentNotice(
        "Please login or create an account to continue checkout.",
      );
      return;
    }

    if (!shippingAddress.trim()) {
      setPaymentNotice("Please enter your shipping address.");
      return;
    }

    const resolvedBillingAddress = useShippingAsBilling
      ? shippingAddress.trim()
      : billingAddress.trim();

    if (!resolvedBillingAddress) {
      setPaymentNotice("Please enter your billing address.");
      return;
    }

    void trackEvent("begin_checkout", {
      payment_method: paymentMethod,
      coupon_code: couponPreview?.code || "",
      item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      cart_total: cartItems.reduce(
        (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
        0,
      ),
      is_authenticated: isAuthenticated,
    });

    setCheckoutLoading(true);
    setPaymentNotice("");

    try {
      await syncLocalCartToServer();

      const orderResponse = await api.post("/orders/checkout/", {
        shipping_address: shippingAddress.trim(),
        billing_address: resolvedBillingAddress,
        payment_method: paymentMethod,
        coupon_code: couponPreview?.code || "",
      });

      const orderId = orderResponse.data?.id;
      if (!orderId) {
        throw new Error("Order creation failed");
      }

      if (paymentMethod === "COD") {
        await api.post("/payments/cod/confirm/", {
          order_id: orderId,
        });

        sessionStorage.setItem(
          "nobonir_flash_notice",
          JSON.stringify({
            variant: "cod",
            message:
              "Order placed with Cash on Delivery. Please keep payment ready upon delivery.",
          }),
        );

        setShippingAddress("");
        setBillingAddress("");
        navigate("/orders?payment=cod");
        return;
      }

      const stripeResponse = await api.post(
        "/payments/stripe/checkout-session/",
        {
          order_id: orderId,
        },
      );

      const checkoutUrl = stripeResponse.data?.checkout_url;
      if (!checkoutUrl) {
        throw new Error("Stripe checkout URL is missing");
      }

      setShippingAddress("");
      setBillingAddress("");
      setCouponCode("");
      setCouponPreview(null);

      window.location.href = checkoutUrl;
    } catch (error: any) {
      setPaymentNotice(
        error.response?.data?.detail || "Checkout failed. Please try again.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const applyCoupon = async () => {
    if (!isAuthenticated) {
      setCouponNotice("Please login to use coupons.");
      return;
    }

    if (!couponCode.trim()) {
      setCouponNotice("Please enter a coupon code.");
      return;
    }

    setCouponLoading(true);
    setCouponNotice("");

    try {
      await syncLocalCartToServer();

      const response = await api.post("/orders/coupon/validate/", {
        coupon_code: couponCode.trim(),
      });

      setCouponPreview(response.data);
      setCouponCode(response.data.code);
      setCouponNotice(`Coupon ${response.data.code} applied successfully.`);
    } catch (error: any) {
      setCouponPreview(null);
      const responseData = error.response?.data;
      const parsedMessage =
        responseData?.detail ||
        responseData?.coupon_code?.[0] ||
        responseData?.non_field_errors?.[0] ||
        (typeof responseData === "string" ? responseData : "") ||
        "Unable to apply coupon.";
      setCouponNotice(parsedMessage);
    } finally {
      setCouponLoading(false);
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0,
  );

  const deliveryFee = 0;
  const discountAmount = couponPreview ? parseFloat(couponPreview.discount) : 0;
  const grandTotal = Math.max(0, total + deliveryFee - discountAmount);

  const paymentMethodMeta = {
    CARD: {
      title: "Card Payment",
      description: "Instant confirmation with secure processing.",
      icon: CreditCard,
    },
    COD: {
      title: "Cash on Delivery",
      description: "Pay in cash when the package arrives.",
      icon: Banknote,
    },
  };

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
                              className="h-9 rounded-r-none px-2"
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
                              className="h-9 rounded-l-none px-2"
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

            <div>
              <Card className="border-slate-200/80 bg-card/80 shadow-lg backdrop-blur dark:border-slate-700/80">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Order Summary</CardTitle>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Secure Checkout
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentNotice && (
                    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                      {paymentNotice}
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200/70 bg-background/70 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
                    <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="mb-2 flex items-center justify-between text-sm text-emerald-600 dark:text-emerald-400">
                        <span className="inline-flex items-center gap-1.5">
                          <TicketPercent className="h-4 w-4" />
                          Coupon ({couponPreview?.code})
                        </span>
                        <span>-{formatPrice(discountAmount)}</span>
                      </div>
                    )}
                    <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="h-4 w-4" />
                        Delivery Fee
                      </span>
                      <span>
                        {deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}
                      </span>
                    </div>
                    <div className="mt-3 h-px bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-3 flex items-center justify-between text-lg font-semibold text-foreground">
                      <span>Total</span>
                      <span>{formatPrice(grandTotal)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Coupon Code</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter coupon (e.g. NOBONIR)"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponNotice("");
                          setCouponPreview(null);
                        }}
                        disabled={!isAuthenticated || couponLoading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyCoupon}
                        disabled={!isAuthenticated || couponLoading}
                      >
                        {couponLoading ? "Applying..." : "Apply"}
                      </Button>
                    </div>
                    {couponNotice && (
                      <p
                        className={`text-xs ${couponPreview ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                      >
                        {couponNotice}
                      </p>
                    )}
                  </div>

                  {!isAuthenticated && (
                    <div className="rounded-md bg-yellow-50 p-4">
                      <p className="text-sm text-yellow-800">
                        You&apos;re browsing as a guest. Please{" "}
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Billing Address
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={useShippingAsBilling}
                          onChange={(event) =>
                            setUseShippingAsBilling(event.target.checked)
                          }
                          disabled={!isAuthenticated}
                        />
                        Same as shipping
                      </label>
                    </div>
                    <Textarea
                      placeholder="Enter your billing address..."
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      disabled={!isAuthenticated || useShippingAsBilling}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {(
                        Object.keys(paymentMethodMeta) as Array<"CARD" | "COD">
                      ).map((method) => {
                        const methodInfo = paymentMethodMeta[method];
                        const MethodIcon = methodInfo.icon;
                        const isSelected = paymentMethod === method;

                        return (
                          <button
                            key={method}
                            type="button"
                            disabled={!isAuthenticated}
                            onClick={() => setPaymentMethod(method)}
                            className={`w-full rounded-xl border p-3 text-left transition-all ${
                              isSelected
                                ? "border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/50"
                                : "border-slate-300/80 bg-background hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                            } ${!isAuthenticated ? "cursor-not-allowed opacity-70" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  <MethodIcon className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {methodInfo.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {methodInfo.description}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                                  Selected
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-lg bg-slate-100/80 p-2.5 dark:bg-slate-800/70">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        Your payment and personal details are securely
                        protected.
                      </p>
                    </div>
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
                    ) : paymentMethod === "CARD" ? (
                      "Pay Securely"
                    ) : (
                      "Place COD Order"
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
