import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { animateFlyToCart } from "@/lib/flyToCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Heart,
  Eye,
  Package,
  LogOut,
  LogIn,
  UserPlus,
  Search,
  Sparkles,
  ShoppingBag,
  Tag,
} from "lucide-react";

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

// Demo products with beautiful images
const DEMO_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Premium Wireless Headphones",
    description:
      "Experience crystal-clear audio with active noise cancellation and 30-hour battery life. Perfect for music lovers and professionals.",
    price: "299.99",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop",
    stock: 15,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 2,
    name: "Smart Fitness Watch",
    description:
      "Track your health and fitness goals with GPS, heart rate monitoring, and sleep tracking. Water-resistant up to 50m.",
    price: "249.99",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop",
    stock: 8,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 3,
    name: "Minimalist Leather Backpack",
    description:
      "Handcrafted genuine leather backpack with laptop compartment and multiple pockets. Perfect for daily commute.",
    price: "189.99",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop",
    stock: 12,
    category: { id: 2, name: "Fashion" },
  },
  {
    id: 4,
    name: "Organic Cotton T-Shirt",
    description:
      "Sustainably made from 100% organic cotton. Soft, breathable, and perfect for everyday wear.",
    price: "29.99",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=400&fit=crop",
    stock: 50,
    category: { id: 2, name: "Fashion" },
  },
  {
    id: 5,
    name: "Ceramic Coffee Mug Set",
    description:
      "Set of 4 handmade ceramic mugs. Microwave and dishwasher safe. Each mug holds 12oz.",
    price: "45.99",
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=400&fit=crop",
    stock: 25,
    category: { id: 3, name: "Home & Kitchen" },
  },
  {
    id: 6,
    name: "Yoga Mat Premium",
    description:
      "Non-slip, eco-friendly yoga mat with extra cushioning. Includes carrying strap. Perfect for all yoga styles.",
    price: "59.99",
    image:
      "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=400&fit=crop",
    stock: 20,
    category: { id: 4, name: "Sports" },
  },
  {
    id: 7,
    name: "Desk Plant Collection",
    description:
      "Set of 3 low-maintenance succulents in modern ceramic pots. Perfect for office or home decoration.",
    price: "34.99",
    image:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&h=400&fit=crop",
    stock: 18,
    category: { id: 3, name: "Home & Kitchen" },
  },
  {
    id: 8,
    name: "Professional Camera Kit",
    description:
      "24MP DSLR camera with 18-55mm lens, tripod, and camera bag. Ideal for beginners and enthusiasts.",
    price: "899.99",
    image:
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&h=400&fit=crop",
    stock: 5,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 9,
    name: "Running Sneakers",
    description:
      "Lightweight running shoes with responsive cushioning and breathable mesh upper. Available in multiple colors.",
    price: "119.99",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop",
    stock: 30,
    category: { id: 2, name: "Fashion" },
  },
  {
    id: 10,
    name: "Portable Bluetooth Speaker",
    description:
      "Waterproof speaker with 360° sound and 12-hour battery life. Perfect for outdoor adventures.",
    price: "79.99",
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=400&fit=crop",
    stock: 22,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 11,
    name: "Scented Candle Set",
    description:
      "Set of 6 aromatherapy candles with natural soy wax. Includes lavender, vanilla, and eucalyptus scents.",
    price: "39.99",
    image:
      "https://images.unsplash.com/photo-1602874801006-c2c0ff734d7e?w=600&h=400&fit=crop",
    stock: 40,
    category: { id: 3, name: "Home & Kitchen" },
  },
  {
    id: 12,
    name: "Stainless Steel Water Bottle",
    description:
      "Insulated bottle keeps drinks cold for 24 hours or hot for 12 hours. BPA-free and leak-proof.",
    price: "24.99",
    image:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=400&fit=crop",
    stock: 0,
    category: { id: 4, name: "Sports" },
  },
];

export function CustomerDashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    loadProducts();
    refreshCartCount();
  }, []);

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

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get("/products/products/");
      const apiProducts = response.data.results || response.data;
      // Use API products if available, otherwise show demo products
      setProducts(apiProducts.length > 0 ? apiProducts : DEMO_PRODUCTS);
    } catch (error) {
      console.error("Failed to load products:", error);
      // Fallback to demo products if API fails
      setProducts(DEMO_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const query = search.trim();

    if (!query) {
      loadProducts();
      return;
    }

    setLoading(true);
    try {
      const response = await api.get("/ai/search/", {
        params: { q: query },
      });
      setProducts(response.data);
    } catch (error) {
      console.error("Search failed:", error);

      try {
        const fallbackResponse = await api.get("/products/products/", {
          params: { search: query },
        });
        const fallbackProducts =
          fallbackResponse.data.results || fallbackResponse.data;
        setProducts(Array.isArray(fallbackProducts) ? fallbackProducts : []);
      } catch {
        const normalized = query.toLowerCase();
        const filtered = DEMO_PRODUCTS.filter(
          (p) =>
            p.name.toLowerCase().includes(normalized) ||
            p.description.toLowerCase().includes(normalized) ||
            p.category.name.toLowerCase().includes(normalized),
        );
        setProducts(filtered);
      }
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product: Product, sourceElement?: HTMLElement) => {
    const addToLocalDemoCart = () => {
      const selectedProduct = products.find((item) => item.id === product.id);
      if (!selectedProduct) {
        return;
      }

      const key = "nobonir_demo_cart";
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingIndex = existing.findIndex(
        (item: any) => item.product.id === selectedProduct.id,
      );

      if (existingIndex >= 0) {
        existing[existingIndex].quantity += 1;
      } else {
        existing.push({
          id: selectedProduct.id,
          quantity: 1,
          isLocal: true,
          product: {
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            image: selectedProduct.image,
            stock: selectedProduct.stock,
          },
        });
      }

      localStorage.setItem(key, JSON.stringify(existing));
    };

    animateFlyToCart({
      fromElement: sourceElement,
      imageSrc: product.image,
    });

    try {
      await api.post("/cart/items/", {
        product: product.id,
        quantity: 1,
      });
      await refreshCartCount();
      return true;
    } catch (error: any) {
      addToLocalDemoCart();
      await refreshCartCount();
      return false;
    }
  };

  const viewProduct = (product: Product) => {
    sessionStorage.setItem("nobonir_selected_product", JSON.stringify(product));
    navigate(`/product/${product.id}`);
  };

  const addToWishlist = async (productId: number) => {
    if (!isAuthenticated) {
      if (confirm("Please login to add items to wishlist. Go to login page?")) {
        navigate("/login");
      }
      return;
    }

    try {
      await api.post("/cart/wishlist/", {
        product: productId,
      });
      alert("Added to wishlist!");
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to add to wishlist");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-600 blur-lg opacity-70 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-2.5 rounded-xl shadow-lg">
                  <ShoppingBag className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent drop-shadow-sm">
                    No
                  </span>
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-sm">
                    Bonir
                  </span>
                </h1>
                <p className="text-xs font-semibold bg-gradient-to-r from-gray-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent tracking-wide">
                  Soft Style Smart Shopping
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-2 rounded-full">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm">
                      {user?.first_name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {user?.first_name}
                    </span>
                  </div>
                  <Link to="/cart">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 relative"
                      data-cart-nav="true"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Link to="/wishlist">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Heart className="h-4 w-4" />
                      <span className="hidden sm:inline">Wishlist</span>
                    </Button>
                  </Link>
                  <Link to="/orders">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Package className="h-4 w-4" />
                      <span className="hidden sm:inline">Orders</span>
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </>
              ) : (
                <>
                  <Badge
                    variant="secondary"
                    className="hidden sm:flex gap-1.5 py-1.5 px-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    Browsing as Guest
                  </Badge>
                  <Link to="/cart">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 relative"
                      data-cart-nav="true"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" size="sm" className="gap-2">
                      <LogIn className="h-4 w-4" />
                      Login
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button
                      size="sm"
                      className="gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 text-white py-16 mb-8">
        {/* Animated Background Circles */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="mb-6 flex items-center justify-center gap-3">
              <Sparkles className="h-10 w-10 text-yellow-300 animate-pulse" />
              <h2 className="text-5xl md:text-6xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent drop-shadow-lg">
                  Discover
                </span>
              </h2>
              <Sparkles className="h-10 w-10 text-yellow-300 animate-pulse" />
            </div>
            <p className="text-2xl font-light text-white/95 mb-8 tracking-wide">
              Find exactly what you need with intelligent search
            </p>

            {/* Enhanced Search */}
            <div className="flex gap-3 max-w-2xl mx-auto">
              <div className="relative flex-1 group">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-300 rounded-2xl"></div>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                <Input
                  type="text"
                  placeholder="Try 'wireless headphones' or 'summer dress'..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="relative pl-12 h-14 text-lg bg-white/98 backdrop-blur-md border-0 shadow-2xl focus-visible:ring-2 focus-visible:ring-white/50 rounded-2xl font-medium"
                />
              </div>
              <Button
                onClick={handleSearch}
                size="lg"
                className="h-14 px-8 bg-white text-teal-600 hover:bg-gray-50 font-bold shadow-2xl hover:shadow-xl transition-all hover:scale-105"
              >
                <Sparkles className="mr-2 h-5 w-5 text-yellow-500" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Products */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              {/* Multiple spinning rings */}
              <div className="h-24 w-24 rounded-full border-4 border-gray-200/50"></div>
              <div className="absolute top-0 left-0 h-24 w-24 rounded-full border-4 border-t-teal-500 border-r-cyan-500 border-b-transparent border-l-transparent animate-spin"></div>
              <div
                className="absolute top-2 left-2 h-20 w-20 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-purple-500 border-l-transparent animate-spin"
                style={{
                  animationDuration: "1.5s",
                  animationDirection: "reverse",
                }}
              ></div>
            </div>
            <p className="mt-8 text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Loading amazing products...
            </p>
            <p className="text-sm font-semibold bg-gradient-to-r from-gray-500 via-teal-500 to-cyan-600 bg-clip-text text-transparent mt-2 tracking-wide">
              Soft Style Smart Shopping
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-cyan-500 blur-2xl opacity-20 rounded-full"></div>
              <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 p-10 rounded-full shadow-xl">
                <ShoppingBag className="h-24 w-24 text-gray-400" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-3">
              No Products Found
            </h3>
            <p className="text-gray-600 mb-8 text-center max-w-md text-lg">
              {search ? (
                <>
                  We couldn't find any products matching "
                  <span className="font-semibold">{search}</span>". Try a
                  different search term!
                </>
              ) : (
                "It looks like there are no products available right now. Check back soon!"
              )}
            </p>
            {search && (
              <Button
                onClick={() => {
                  setSearch("");
                  loadProducts();
                }}
                variant="outline"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                  {search ? "🔍 Search Results" : "✨ All Products"}
                </h3>
                <p className="text-sm text-gray-600 mt-2 font-medium">
                  Found {products.length}{" "}
                  {products.length === 1
                    ? "amazing product"
                    : "amazing products"}
                </p>
              </div>
              {search && (
                <Button
                  onClick={() => {
                    setSearch("");
                    loadProducts();
                  }}
                  variant="outline"
                  size="sm"
                >
                  Clear Search
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="group relative hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 border-0 shadow-lg overflow-hidden bg-white rounded-2xl"
                >
                  {/* Hover Gradient Border Effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl -z-10"
                    style={{ padding: "2px" }}
                  ></div>

                  <CardHeader className="p-0">
                    <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                      <img
                        src={
                          product.image ||
                          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
                        }
                        alt={product.name}
                        className="h-56 w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
                        }}
                      />
                      {/* Shimmer Effect on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full transform"></div>

                      <div className="absolute top-3 right-3">
                        <Badge
                          variant="secondary"
                          className="bg-white/95 backdrop-blur-md text-gray-700 gap-1.5 shadow-lg font-semibold"
                        >
                          <Tag className="h-3 w-3" />
                          {product.category.name}
                        </Badge>
                      </div>
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge
                            variant="destructive"
                            className="text-sm px-4 py-2"
                          >
                            Out of Stock
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 bg-gradient-to-br from-white to-gray-50">
                    <CardTitle className="text-lg font-bold mb-2 line-clamp-1 group-hover:bg-gradient-to-r group-hover:from-teal-600 group-hover:to-cyan-600 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                      {product.name}
                    </CardTitle>
                    <p className="mb-4 text-sm text-gray-600 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                    <div className="flex items-baseline justify-between mb-5">
                      <p className="text-3xl font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent drop-shadow-sm">
                        ${product.price}
                      </p>
                      <Badge
                        variant={
                          product.stock > 10
                            ? "default"
                            : product.stock > 0
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs font-bold shadow-sm"
                      >
                        {product.stock > 0 ? `${product.stock} left` : "Out"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={(e) => addToCart(product, e.currentTarget)}
                        className="w-full bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-semibold"
                        disabled={product.stock === 0}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {product.stock === 0 ? "Unavailable" : "Add to Cart"}
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => viewProduct(product)}
                          variant="outline"
                          className="hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-cyan-700 hover:border-cyan-300 transition-all shadow-md"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Product
                        </Button>
                        <Button
                          onClick={() => addToWishlist(product.id)}
                          variant="outline"
                          className="hover:bg-gradient-to-br hover:from-red-50 hover:to-pink-50 hover:text-red-600 hover:border-red-300 transition-all shadow-md"
                        >
                          <Heart className="mr-2 h-4 w-4" />
                          Wishlist
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white border-t border-gray-700 mt-16">
        <div className="absolute inset-0 bg-grid-white/5"></div>
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-3xl font-black mb-3">
              <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                No
              </span>
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                Bonir
              </span>
            </h3>
            <p className="text-sm font-semibold bg-gradient-to-r from-gray-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent mb-2 tracking-wide">
              Soft Style Smart Shopping
            </p>
            <p className="text-xs text-gray-500">© 2026 All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
