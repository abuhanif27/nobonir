import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { MEDIA_BASE_URL } from "@/lib/api";
import {
  getErrorData,
  getErrorFieldMessages,
  getErrorMessage,
  getErrorStatus,
} from "@/lib/apiError";
import { trackEvent } from "@/lib/analytics";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowStateBanner, FlowStateCard } from "@/components/ui/flow-state";
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
  variant?: {
    id: number;
    color?: string;
    size?: string;
    sku?: string;
    stock_override?: number | null;
  } | null;
  variant_id?: number | null;
  variant_key?: string;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
    image_url?: string;
    primary_image?: string;
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

const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop";

export function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  const location = useLocation();
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartLoadError, setCartLoadError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "COD">("CARD");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(
    null,
  );
  const [couponLoading, setCouponLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [pendingOrderIdForPayment, setPendingOrderIdForPayment] = useState<
    number | null
  >(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const resolveProductImage = useCallback((product: CartItem["product"]) => {
    const imageUrl =
      product.primary_image || product.image_url || product.image || "";

    if (!imageUrl) {
      return FALLBACK_PRODUCT_IMAGE;
    }

    if (imageUrl.startsWith("http")) {
      return imageUrl;
    }

    const normalizedPath = imageUrl.startsWith("/")
      ? imageUrl
      : `/${imageUrl}`;
    return `${MEDIA_BASE_URL}${normalizedPath}`;
  }, []);

  const getLocalCartItems = useCallback((): CartItem[] => {
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
  }, []);

  const setLocalCartItems = (items: CartItem[]) => {
    localStorage.setItem("nobonir_demo_cart", JSON.stringify(items));
  };

  const loadCart = useCallback(async () => {
    setCartLoadError(null);

    if (!isAuthenticated) {
      setCartItems(getLocalCartItems());
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data) ? response.data : [];
      const localItems = getLocalCartItems();

      // Merge server and local items (for guests with split cart state)
      const mergedItems: CartItem[] = [];
      const seenKeys = new Set<string>();

      // Add server items first (they are "official" if they exist)
      for (const item of apiItems) {
        const key = `${item.product?.id}:${item.variant_id || "null"}`;
        mergedItems.push(item);
        seenKeys.add(key);
      }

      // Add local items that are not already in server
      for (const localItem of localItems) {
        const key = `${localItem.product?.id}:${localItem.variant_id || "null"}`;
        if (!seenKeys.has(key)) {
          mergedItems.push(localItem);
        }
      }

      if (mergedItems.length > 0) {
        setCartItems(mergedItems);
      } else {
        setCartItems([]);
      }

      if (apiItems.length === 0 && localItems.length > 0) {
        // Auto-sync local items to server
        try {
          for (const item of localItems) {
            await api.post("/cart/items/", {
              product_id: item.product.id,
              variant_id: item.variant_id ?? null,
              quantity: item.quantity,
            });
          }
          setLocalCartItems([]);
          const syncedResponse = await api.get("/cart/");
          setCartItems(Array.isArray(syncedResponse.data) ? syncedResponse.data : []);
        } catch {
          // If sync fails, keep showing local items without error
        }
      }
    } catch (error) {
      console.error("Failed to load cart:", error);
      const fallbackItems = getLocalCartItems();
      setCartItems(fallbackItems);
      setCartLoadError(
        fallbackItems.length > 0
          ? "Couldn’t load your server cart. Showing locally saved items."
          : "Couldn’t load your cart right now. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [getLocalCartItems, isAuthenticated]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentState = params.get("payment");
    const orderId = params.get("order_id");

    if (paymentState === "cancelled") {
      const cancelPendingOrder = async () => {
        if (!orderId) {
          showError("Payment was canceled");
          return;
        }

        try {
          await api.post("/payments/stripe/cancel/", {
            order_id: Number(orderId),
          });
          showError("Payment was canceled and the pending order was canceled");
        } catch (error: unknown) {
          const message = getErrorMessage(
            error,
            "Payment was canceled. Failed to auto-cancel the order.",
          );
          showError(message);
        }
      };

      cancelPendingOrder();
      return;
    }
  }, [location.search, showError]);

  useEffect(() => {
    if (useShippingAsBilling) {
      setBillingAddress(shippingAddress);
    }
  }, [shippingAddress, useShippingAsBilling]);

  useEffect(() => {
    if (!clearConfirmOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setClearConfirmOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [clearConfirmOpen]);

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (!isAuthenticated) {
      const updated =
        quantity <= 0
          ? cartItems.filter((item) => item.id !== itemId)
          : cartItems.map((item) =>
              item.id === itemId ? { ...item, quantity } : item,
            );
      setCartItems(updated);
      setLocalCartItems(updated);
      return;
    }

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
    if (!isAuthenticated) {
      const updated = cartItems.filter((item) => item.id !== itemId);
      setCartItems(updated);
      setLocalCartItems(updated);
      return;
    }

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

    if (!isAuthenticated) {
      setLocalCartItems([]);
      setCartItems([]);
      setClearingAll(false);
      setClearConfirmOpen(false);
      return;
    }

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
        variant_id: item.variant_id ?? null,
        quantity: item.quantity,
      });
    }

    setLocalCartItems([]);
    await loadCart();
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      showError("Please log in or create an account to continue checkout");
      return;
    }

    if (!shippingAddress.trim()) {
      showError("Please enter your shipping address");
      return;
    }

    const resolvedBillingAddress =
      paymentMethod === "COD"
        ? useShippingAsBilling
          ? shippingAddress.trim()
          : billingAddress.trim()
        : "";

    if (paymentMethod === "COD" && !resolvedBillingAddress) {
      showError("Please enter your billing address");
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

    try {
      let orderId = pendingOrderIdForPayment;

      // If there is no pending order from a previous failed card attempt,
      // create a fresh order from cart.
      if (!orderId) {
        await syncLocalCartToServer();

        const orderResponse = await api.post("/orders/checkout/", {
          shipping_address: shippingAddress.trim(),
          billing_address: resolvedBillingAddress,
          payment_method: paymentMethod,
          coupon_code: couponPreview?.code || "",
        });

        orderId = orderResponse.data?.id;
        if (!orderId) {
          throw new Error("Order creation failed");
        }

        if (paymentMethod === "CARD") {
          setPendingOrderIdForPayment(orderId);
        }
      }

      if (paymentMethod === "COD") {
        await api.post("/payments/cod/confirm/", {
          order_id: orderId,
        });

        setPendingOrderIdForPayment(null);

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
      setPendingOrderIdForPayment(null);

      window.location.href = checkoutUrl;
    } catch (error: unknown) {
      const fallbackMessage =
        getErrorStatus(error) === 0
          ? "Network error during checkout. Please check your connection and try again."
          : (error as { message?: string })?.message ||
            "Checkout failed. Please try again.";
      showError(getErrorMessage(error, fallbackMessage));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const applyCoupon = async () => {
    if (!isAuthenticated) {
      showError("Please log in to use coupons");
      return;
    }

    if (!couponCode.trim()) {
      showError("Please enter a coupon code");
      return;
    }

    setCouponLoading(true);

    try {
      await syncLocalCartToServer();

      const response = await api.post("/orders/coupon/validate/", {
        coupon_code: couponCode.trim(),
      });

      setCouponPreview(response.data);
      setCouponCode(response.data.code);
      showSuccess(`Coupon ${response.data.code} applied successfully`);
    } catch (error: unknown) {
      setCouponPreview(null);
      const responseData = getErrorData(error);
      const couponCodeError = getErrorFieldMessages(error, "coupon_code")[0];
      const nonFieldError = getErrorFieldMessages(error, "non_field_errors")[0];
      const parsedMessage =
        (typeof responseData?.detail === "string" ? responseData.detail : "") ||
        couponCodeError ||
        nonFieldError ||
        (typeof responseData === "string" ? responseData : "") ||
        "Failed to apply coupon.";
      showError(parsedMessage);
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
        aria-hidden={!clearConfirmOpen}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-cart-title"
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
                  <h3
                    id="clear-cart-title"
                    className="text-lg font-semibold text-foreground"
                  >
                    Clear all cart items?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This will remove everything from your cart.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setClearConfirmOpen(false)}
                  disabled={clearingAll}
                  className="border-border bg-background text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-border/80 hover:bg-muted hover:shadow-md active:translate-y-0"
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

      <header className="ds-page-header">
        <div className="ds-page-header-row">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="ds-page-title">Shopping Cart</h1>
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="ds-page-container">
        {loading ? (
          <FlowStateCard message="Loading cart..." contentClassName="py-12" />
        ) : cartLoadError && cartItems.length === 0 ? (
          <FlowStateCard
            icon={AlertTriangle}
            title="Unable to load cart"
            message={cartLoadError}
            actionLabel="Try Again"
            onAction={loadCart}
            contentClassName="py-12"
          />
        ) : cartItems.length === 0 ? (
          <FlowStateCard
            icon={ShoppingCart}
            title="Your cart is empty"
            message="Add some products to get started!"
            actionLabel="Browse Products"
            actionVariant="default"
            onAction={() => navigate("/")}
            contentClassName="py-12"
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {cartLoadError && (
                <FlowStateBanner
                  className="mb-4"
                  message={cartLoadError}
                  tone="warning"
                  actionLabel="Try Again"
                  onAction={loadCart}
                />
              )}
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
                          src={resolveProductImage(item.product)}
                          alt={item.product.name}
                          className="h-20 w-20 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.product.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.product.price)} each
                          </p>
                          {item.variant && (
                            <p className="text-sm text-muted-foreground">
                              Variant: {item.variant.color || "Default"}
                              {item.variant.size ? ` / ${item.variant.size}` : ""}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Stock: {item.variant?.stock_override ?? item.product.stock}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center rounded-md border bg-background">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-9 rounded-r-none px-2"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              aria-label={`Decrease quantity for ${item.product.name}`}
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
                                    item.variant?.stock_override ?? item.product.stock,
                                    item.quantity + 1,
                                  ),
                                )
                              }
                              disabled={
                                item.quantity >=
                                (item.variant?.stock_override ?? item.product.stock)
                              }
                              aria-label={`Increase quantity for ${item.product.name}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.product.name} from cart`}
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
              <Card className="border-border/70 bg-card/80 shadow-lg backdrop-blur">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Order Summary</CardTitle>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Secure Checkout
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-background/70 p-4">
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
                    <div className="mt-3 h-px bg-border" />
                    <div className="mt-3 flex items-center justify-between text-lg font-semibold text-foreground">
                      <span>Total</span>
                      <span>{formatPrice(grandTotal)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="coupon-code"
                      className="text-sm font-medium"
                    >
                      Coupon Code
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="coupon-code"
                        placeholder="Enter coupon (e.g. NOBONIR)"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
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
                    <label
                      htmlFor="shipping-address"
                      className="text-sm font-medium"
                    >
                      Shipping Address
                    </label>
                    <Textarea
                      id="shipping-address"
                      placeholder="Enter your shipping address..."
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      disabled={!isAuthenticated}
                      rows={4}
                    />
                  </div>

                  {paymentMethod === "COD" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="billing-address"
                          className="text-sm font-medium"
                        >
                          Billing Address
                          <span className="ml-1 text-xs text-muted-foreground">
                            (required for COD)
                          </span>
                        </label>
                        <label
                          htmlFor="same-as-shipping"
                          className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <input
                            id="same-as-shipping"
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
                        id="billing-address"
                        placeholder="Enter your billing address..."
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        disabled={!isAuthenticated || useShippingAsBilling}
                        rows={4}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Payment Method
                    </label>
                    <div
                      className="grid grid-cols-1 gap-2"
                      role="radiogroup"
                      aria-label="Payment method"
                    >
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
                            role="radio"
                            aria-checked={isSelected}
                            className={`w-full rounded-xl border p-3 text-left transition-all ${
                              isSelected
                                ? "border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/50"
                                : "border-border bg-background hover:border-border/80"
                            } ${!isAuthenticated ? "cursor-not-allowed opacity-70" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-muted p-2 text-foreground">
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
                    <div className="rounded-lg bg-muted/80 p-2.5">
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
