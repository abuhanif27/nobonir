import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Search, ShoppingCart, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { endpoints } from "@/lib/api";
import type { CartItem, Category, Order, Product, WishlistItem } from "@/types";

const CUSTOMER_KEY = "nobonir-customer-id";

function getCustomerId() {
  const existing = localStorage.getItem(CUSTOMER_KEY);
  if (existing) return existing;
  const created = `customer-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(CUSTOMER_KEY, created);
  return created;
}

function App() {
  const [customerId, setCustomerId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [stockOnly, setStockOnly] = useState(false);

  const [checkoutForm, setCheckoutForm] = useState({
    customer_name: "",
    customer_email: "",
    shipping_address: "",
  });

  const [reviewForm, setReviewForm] = useState({
    product_id: "",
    customer_name: "",
    rating: "5",
    comment: "",
  });

  const loadCatalog = useCallback(async () => {
    const [categoryRes, productRes] = await Promise.all([
      endpoints.categories(),
      endpoints.products({
        search,
        category,
        sort,
        in_stock: stockOnly || undefined,
      }),
    ]);
    setCategories(categoryRes.data);
    setProducts(productRes.data);
  }, [category, search, sort, stockOnly]);

  const loadUserData = useCallback(async (id: string) => {
    const [cartRes, wishlistRes, aiRes] = await Promise.all([
      endpoints.cart.list(id),
      endpoints.wishlist.list(id),
      endpoints.recommendations(id),
    ]);
    setCartItems(cartRes.data);
    setWishlistItems(wishlistRes.data);
    setRecommended(aiRes.data);
  }, []);

  const loadOrders = useCallback(async (email?: string) => {
    const response = await endpoints.orders(email);
    setOrders(response.data);
  }, []);

  const refreshAll = useCallback(
    async (id: string, email?: string) => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadCatalog(), loadUserData(id), loadOrders(email)]);
      } catch {
        setError("Failed to load data. Make sure backend server is running.");
      } finally {
        setLoading(false);
      }
    },
    [loadCatalog, loadOrders, loadUserData],
  );

  useEffect(() => {
    const id = getCustomerId();
    setCustomerId(id);
    void refreshAll(id);
  }, [refreshAll]);

  useEffect(() => {
    if (!customerId) return;
    void loadCatalog();
  }, [customerId, loadCatalog]);

  const wishlistProductIds = useMemo(
    () => new Set(wishlistItems.map((item) => item.product.id)),
    [wishlistItems],
  );
  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.product.discounted_price * item.quantity,
        0,
      ),
    [cartItems],
  );

  const addToCart = async (productId: number) => {
    await endpoints.cart.add({
      customer_id: customerId,
      product_id: productId,
      quantity: 1,
    });
    await loadUserData(customerId);
  };

  const toggleWishlist = async (productId: number) => {
    const existing = wishlistItems.find(
      (item) => item.product.id === productId,
    );
    if (existing) {
      await endpoints.wishlist.remove(existing.id);
    } else {
      await endpoints.wishlist.add({
        customer_id: customerId,
        product_id: productId,
      });
    }
    await loadUserData(customerId);
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      await endpoints.cart.remove(itemId);
    } else {
      await endpoints.cart.update(itemId, quantity);
    }
    await loadUserData(customerId);
  };

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await endpoints.checkout({ customer_id: customerId, ...checkoutForm });
    await refreshAll(customerId, checkoutForm.customer_email);
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewForm.product_id) return;
    await endpoints.reviews.create(Number(reviewForm.product_id), {
      customer_name: reviewForm.customer_name,
      rating: Number(reviewForm.rating),
      comment: reviewForm.comment,
    });
    setReviewForm({
      product_id: "",
      customer_name: "",
      rating: "5",
      comment: "",
    });
    await loadCatalog();
    await loadUserData(customerId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-primary py-8 text-primary-foreground">
        <div className="container">
          <h1 className="text-4xl font-bold tracking-wide">
            NOBONIR E-COMMERCE
          </h1>
          <p className="mt-2 text-lg font-semibold text-primary-foreground/90">
            SOFT STYLE SMART SHOPPING
          </p>
          <p className="mt-4 text-sm text-primary-foreground/90">
            Customer Session: {customerId}
          </p>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card className="border-none bg-secondary">
            <CardHeader>
              <CardTitle>Abstract</CardTitle>
              <CardDescription>
                Complete React + Django + AI commerce platform with product
                discovery, cart, wishlist, reviews, checkout, and order
                tracking.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-none bg-secondary">
            <CardHeader>
              <CardTitle>Problem Domain</CardTitle>
              <CardDescription>
                Product module, inventory management, secure checkout, and AI
                recommendations integrated in one system.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="mb-6 border-none bg-card">
          <CardHeader>
            <CardTitle>UI/UX Shop Panel</CardTitle>
            <CardDescription>
              Styled close to your reference with rounded cards and teal
              dashboard layout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name</option>
              </Select>
              <Button
                variant={stockOnly ? "default" : "outline"}
                onClick={() => setStockOnly((previous) => !previous)}
              >
                <Search className="mr-2 h-4 w-4" /> In Stock Only
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="mb-4 text-sm font-medium text-red-600">{error}</p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="bg-secondary/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  {product.offer_percent > 0 && (
                    <Badge>{product.offer_percent}% OFF</Badge>
                  )}
                </div>
                <CardDescription>{product.category.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm text-muted-foreground">
                  {product.description}
                </p>
                <p className="font-semibold">
                  ৳{product.discounted_price.toFixed(2)}
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Stock: {product.stock}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => addToCart(product.id)}
                    disabled={product.stock === 0}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" /> Add Cart
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleWishlist(product.id)}
                  >
                    <Heart className="mr-2 h-4 w-4" />{" "}
                    {wishlistProductIds.has(product.id) ? "Saved" : "Wishlist"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>
                Personalized products based on cart, wishlist, and rating
                behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommended.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category.name}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Sparkles className="mr-1 h-3 w-3" /> ৳
                    {item.discounted_price.toFixed(0)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cart & Checkout</CardTitle>
              <CardDescription>
                Complete checkout module with stock-aware order creation and
                tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_110px_60px] items-center gap-2 rounded-lg border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ৳{item.product.discounted_price.toFixed(2)}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        updateQuantity(item.id, Number(event.target.value))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateQuantity(item.id, 0)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm font-semibold">
                Total: ৳{cartTotal.toFixed(2)}
              </p>
              <form className="mt-4 space-y-2" onSubmit={submitCheckout}>
                <Input
                  placeholder="Customer Name"
                  value={checkoutForm.customer_name}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      customer_name: event.target.value,
                    }))
                  }
                  required
                />
                <Input
                  type="email"
                  placeholder="Customer Email"
                  value={checkoutForm.customer_email}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      customer_email: event.target.value,
                    }))
                  }
                  required
                />
                <Textarea
                  placeholder="Shipping Address"
                  value={checkoutForm.shipping_address}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      shipping_address: event.target.value,
                    }))
                  }
                  required
                />
                <Button type="submit" disabled={!cartItems.length || loading}>
                  Confirm Checkout
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add Review</CardTitle>
              <CardDescription>
                Submit product ratings and comments for trustworthy customer
                feedback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-2" onSubmit={submitReview}>
                <Select
                  value={reviewForm.product_id}
                  onChange={(event) =>
                    setReviewForm((previous) => ({
                      ...previous,
                      product_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select Product</option>
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Your Name"
                  value={reviewForm.customer_name}
                  onChange={(event) =>
                    setReviewForm((previous) => ({
                      ...previous,
                      customer_name: event.target.value,
                    }))
                  }
                  required
                />
                <Select
                  value={reviewForm.rating}
                  onChange={(event) =>
                    setReviewForm((previous) => ({
                      ...previous,
                      rating: event.target.value,
                    }))
                  }
                >
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Poor</option>
                  <option value="1">1 - Bad</option>
                </Select>
                <Textarea
                  placeholder="Review Comment"
                  value={reviewForm.comment}
                  onChange={(event) =>
                    setReviewForm((previous) => ({
                      ...previous,
                      comment: event.target.value,
                    }))
                  }
                  required
                />
                <Button type="submit">Submit Review</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Tracking</CardTitle>
              <CardDescription>
                Track complete order lifecycle for customer and admin
                monitoring.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold">Order #{order.id}</p>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.customer_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ৳{Number(order.total_amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

export default App;
