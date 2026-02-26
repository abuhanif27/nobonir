import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Heart,
  Search,
  ShoppingCart,
  Trash2,
  RefreshCw,
  Sparkles,
  PackageCheck,
  PackageX,
} from "lucide-react";

interface WishlistProduct {
  id: number;
  name: string;
  description: string;
  price: string | number;
  stock: number;
  image_url?: string;
  image?: string;
  category?: {
    id: number;
    name: string;
    slug?: string;
  };
}

interface WishlistItem {
  id: number;
  product: WishlistProduct;
  created_at: string;
}

const parseAmount = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function WishlistPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingItemId, setWorkingItemId] = useState<number | null>(null);
  const [movingAll, setMovingAll] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const loadWishlist = async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const response = await api.get("/cart/wishlist/");
      const data = Array.isArray(response.data) ? response.data : [];
      setItems(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load wishlist");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, []);

  const categories = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => {
      const categoryName = item.product.category?.name;
      if (categoryName) {
        names.add(categoryName);
      }
    });
    return ["ALL", ...Array.from(names)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter((item) => {
      const categoryName = item.product.category?.name || "";
      const categoryPass =
        activeCategory === "ALL" || categoryName === activeCategory;
      if (!categoryPass) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return (
        item.product.name.toLowerCase().includes(normalized) ||
        item.product.description.toLowerCase().includes(normalized) ||
        categoryName.toLowerCase().includes(normalized)
      );
    });
  }, [items, query, activeCategory]);

  const summary = useMemo(() => {
    const totalSaved = items.length;
    const inStock = items.filter((item) => item.product.stock > 0).length;
    const outOfStock = totalSaved - inStock;
    const estValue = items.reduce(
      (sum, item) => sum + parseAmount(item.product.price),
      0,
    );

    return {
      totalSaved,
      inStock,
      outOfStock,
      estValue,
    };
  }, [items]);

  const removeItem = async (itemId: number) => {
    setWorkingItemId(itemId);
    try {
      await api.delete(`/cart/wishlist/${itemId}/`);
      setItems((current) => current.filter((item) => item.id !== itemId));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to remove item");
    } finally {
      setWorkingItemId(null);
    }
  };

  const addItemToCart = async (item: WishlistItem) => {
    if (item.product.stock <= 0) {
      return;
    }

    setWorkingItemId(item.id);
    try {
      await api.post("/cart/items/", {
        product_id: item.product.id,
        quantity: 1,
      });
      await api.delete(`/cart/wishlist/${item.id}/`);
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to move item to cart");
    } finally {
      setWorkingItemId(null);
    }
  };

  const moveAllAvailableToCart = async () => {
    const movable = filteredItems.filter((item) => item.product.stock > 0);
    if (movable.length === 0) {
      return;
    }

    setMovingAll(true);
    try {
      for (const item of movable) {
        await api.post("/cart/items/", {
          product_id: item.product.id,
          quantity: 1,
        });
        await api.delete(`/cart/wishlist/${item.id}/`);
      }
      setItems((current) =>
        current.filter(
          (item) => !movable.some((moved) => moved.id === item.id),
        ),
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to move all items");
      await loadWishlist(true);
    } finally {
      setMovingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-orange-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 p-2.5 shadow-lg">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">My Wishlist</h1>
              <p className="text-xs text-slate-500">
                Save favorites and move to cart when ready
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
              onClick={() => loadWishlist(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Saved Items</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {summary.totalSaved}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">In Stock</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {summary.inStock}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Out of Stock</p>
              <p className="mt-1 text-2xl font-bold text-rose-700">
                {summary.outOfStock}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-500">Estimated Value</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatPrice(summary.estValue)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-0 bg-white shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full flex-1 sm:min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search in wishlist..."
                  className="pl-9"
                />
              </div>
              <Button
                onClick={moveAllAvailableToCart}
                disabled={
                  movingAll ||
                  filteredItems.every((item) => item.product.stock <= 0)
                }
                className="w-full gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                {movingAll ? "Moving..." : "Move All Available to Cart"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={activeCategory === category ? "default" : "outline"}
                  onClick={() => setActiveCategory(category)}
                  className={
                    activeCategory === category
                      ? "bg-gradient-to-r from-pink-500 to-rose-600"
                      : ""
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="py-16 text-center text-slate-500">
              Loading your wishlist...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="py-16 text-center">
              <p className="text-rose-600">{error}</p>
              <Button className="mt-4" onClick={() => loadWishlist()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="border-0 bg-white shadow-sm">
            <CardContent className="py-16 text-center">
              <Heart className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-xl font-semibold text-slate-900">
                Your wishlist is empty
              </h3>
              <p className="mt-2 text-slate-500">
                Save products you love to revisit them quickly.
              </p>
              <Button className="mt-5" onClick={() => navigate("/")}>
                Explore Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const image =
                item.product.image_url ||
                item.product.image ||
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop";
              const disabled = workingItemId === item.id || movingAll;

              return (
                <Card
                  key={item.id}
                  className="group overflow-hidden border-0 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative">
                    <img
                      src={image}
                      alt={item.product.name}
                      className="h-48 w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src =
                          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop";
                      }}
                    />
                    <div className="absolute left-3 top-3 flex gap-2">
                      {item.product.category?.name && (
                        <Badge variant="secondary" className="bg-white/90">
                          {item.product.category.name}
                        </Badge>
                      )}
                      {item.product.stock > 0 ? (
                        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                          <PackageCheck className="mr-1 h-3 w-3" /> In Stock
                        </Badge>
                      ) : (
                        <Badge className="border-rose-200 bg-rose-100 text-rose-800">
                          <PackageX className="mr-1 h-3 w-3" /> Out of Stock
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">
                      {item.product.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {item.product.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-2xl font-bold text-slate-900">
                        {formatPrice(item.product.price)}
                      </p>
                      <p className="text-xs text-slate-500">Saved item</p>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={() => addItemToCart(item)}
                        disabled={disabled || item.product.stock <= 0}
                        className="flex-1 gap-2 bg-gradient-to-r from-teal-500 to-cyan-600"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Move to Cart
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => removeItem(item.id)}
                        disabled={disabled}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
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
