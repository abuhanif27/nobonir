import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Trash2, ArrowLeft, LogIn } from "lucide-react";

interface CartItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
    stock: number;
  };
  quantity: number;
}

export function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const response = await api.get("/cart/");
      setCartItems(response.data);
    } catch (error) {
      console.error("Failed to load cart:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
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
    try {
      await api.delete(`/cart/items/${itemId}/`);
      await loadCart();
    } catch (error) {
      console.error("Failed to remove item:", error);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
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
                <CardHeader>
                  <CardTitle>Cart Items ({cartItems.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-lg border p-4"
                    >
                      <img
                        src={item.product.image || "/placeholder.png"}
                        alt={item.product.name}
                        className="h-20 w-20 rounded object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.product.name}</h3>
                        <p className="text-sm text-gray-600">
                          ${item.product.price} each
                        </p>
                        <p className="text-sm text-gray-500">
                          Stock: {item.product.stock}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={item.product.stock}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.id, parseInt(e.target.value))
                          }
                          className="w-20"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          $
                          {(
                            parseFloat(item.product.price) * item.quantity
                          ).toFixed(2)}
                        </p>
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
                    <span>${total.toFixed(2)}</span>
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
