import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { animateFlyToCart } from "@/lib/flyToCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Minus, Plus, ShoppingCart, Tag } from "lucide-react";

interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  image: string;
  stock: number;
  category: {
    id: number;
    name: string;
  };
}

export function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const getLocalCartCount = () => {
    const raw = localStorage.getItem("nobonir_demo_cart");
    if (!raw) {
      return 0;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return 0;
      }

      return parsed.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );
    } catch {
      return 0;
    }
  };

  const refreshCartCount = async () => {
    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data) ? response.data : [];
      const apiCount = apiItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );
      setCartCount(apiCount > 0 ? apiCount : getLocalCartCount());
    } catch {
      setCartCount(getLocalCartCount());
    }
  };

  useEffect(() => {
    refreshCartCount();

    const loadProduct = async () => {
      const selectedRaw = sessionStorage.getItem("nobonir_selected_product");
      if (selectedRaw) {
        try {
          const selected = JSON.parse(selectedRaw);
          if (String(selected.id) === String(id)) {
            setProduct(selected);
            setLoading(false);
            return;
          }
        } catch {
          // ignore invalid cache
        }
      }

      try {
        const response = await api.get(`/products/products/${id}/`);
        setProduct(response.data);
      } catch (error) {
        console.error("Failed to load product details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const addToCart = async (sourceElement?: HTMLElement) => {
    if (!product) {
      return;
    }

    animateFlyToCart({
      fromElement: sourceElement,
      imageSrc: product.image,
    });

    const addToLocalDemoCart = () => {
      const key = "nobonir_demo_cart";
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingIndex = existing.findIndex(
        (item: any) => item.product.id === product.id,
      );

      if (existingIndex >= 0) {
        existing[existingIndex].quantity += quantity;
      } else {
        existing.push({
          id: product.id,
          quantity,
          isLocal: true,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            stock: product.stock,
          },
        });
      }

      localStorage.setItem(key, JSON.stringify(existing));
    };

    try {
      await api.post("/cart/items/", {
        product_id: product.id,
        quantity,
      });
      await refreshCartCount();
    } catch {
      addToLocalDemoCart();
      await refreshCartCount();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-600">Loading product...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Product not found
              </h1>
              <p className="mt-2 text-gray-600">
                This product is unavailable right now.
              </p>
              <Link to="/">
                <Button className="mt-6">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Products
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b dark:bg-slate-900/80 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Link to="/cart">
            <Button variant="outline" className="relative" data-cart-nav="true">
              <ShoppingCart className="mr-2 h-4 w-4" />
              View Cart
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="overflow-hidden border-0 shadow-xl">
            <img
              src={
                product.image ||
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=700&fit=crop"
              }
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </Card>

          <Card className="border-0 bg-white/90 shadow-xl dark:bg-slate-900/85">
            <CardContent className="p-5 sm:p-8">
              <Badge variant="secondary" className="mb-4 gap-1.5">
                <Tag className="h-3 w-3" />
                {product.category.name}
              </Badge>

              <h1 className="mb-4 text-3xl font-black text-gray-900 dark:text-slate-100 sm:text-4xl">
                {product.name}
              </h1>

              <p className="text-gray-600 leading-relaxed mb-6">
                {product.description}
              </p>

              <p className="text-4xl font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-6">
                {formatPrice(product.price)}
              </p>

              <p className="text-sm text-gray-600 mb-6">
                Stock: {product.stock}
              </p>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Quantity</p>
                <div className="inline-flex items-center rounded-lg border bg-white">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-semibold">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-l-none"
                    onClick={() =>
                      setQuantity((prev) =>
                        Math.min(product.stock || 1, prev + 1),
                      )
                    }
                    disabled={quantity >= product.stock || product.stock === 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  onClick={(e) => addToCart(e.currentTarget)}
                  disabled={product.stock === 0}
                  className="bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {product.stock === 0 ? "Unavailable" : "Add to Cart"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/wishlist")}>
                  <Heart className="mr-2 h-4 w-4" />
                  Wishlist
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
