import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Heart,
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

export function CustomerDashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await api.get("/products/products/");
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) {
      loadProducts();
      return;
    }

    try {
      const response = await api.get("/ai/search/", {
        params: { query: search },
      });
      setProducts(response.data);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const addToCart = async (productId: number) => {
    try {
      await api.post("/cart/items/", {
        product: productId,
        quantity: 1,
      });
      alert("Added to cart!");
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to add to cart");
    }
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
              <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Nobonir E-Commerce
                </h1>
                <p className="text-xs text-gray-500">
                  AI-Powered Shopping Experience
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
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
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
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
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
      <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white py-12 mb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
              <Sparkles className="h-8 w-8" />
              Discover Amazing Products
              <Sparkles className="h-8 w-8" />
            </h2>
            <p className="text-lg text-white/90 mb-8">
              Find exactly what you need with our AI-powered search
            </p>

            {/* Enhanced Search */}
            <div className="flex gap-3 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Try 'wireless headphones' or 'summer dress'..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-12 h-14 text-lg bg-white/95 backdrop-blur-sm border-0 shadow-lg focus-visible:ring-2 focus-visible:ring-white"
                />
              </div>
              <Button
                onClick={handleSearch}
                size="lg"
                className="h-14 px-8 bg-white text-teal-600 hover:bg-gray-50 font-semibold shadow-lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
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
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-gray-200"></div>
              <div className="absolute top-0 left-0 h-20 w-20 rounded-full border-4 border-t-teal-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>
            <p className="mt-6 text-lg text-gray-600 font-medium">
              Loading amazing products...
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 rounded-full mb-6">
              <ShoppingBag className="h-20 w-20 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              No Products Found
            </h3>
            <p className="text-gray-600 mb-6 text-center max-w-md">
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {search ? "Search Results" : "All Products"}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Found {products.length}{" "}
                  {products.length === 1 ? "product" : "products"}
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
                  className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-md overflow-hidden bg-white"
                >
                  <CardHeader className="p-0">
                    <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                      <img
                        src={
                          product.image ||
                          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
                        }
                        alt={product.name}
                        className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
                        }}
                      />
                      <div className="absolute top-3 right-3">
                        <Badge
                          variant="secondary"
                          className="bg-white/90 backdrop-blur-sm text-gray-700 gap-1.5"
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
                  <CardContent className="p-5">
                    <CardTitle className="text-lg mb-2 line-clamp-1 group-hover:text-teal-600 transition-colors">
                      {product.name}
                    </CardTitle>
                    <p className="mb-3 text-sm text-gray-600 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                    <div className="flex items-baseline justify-between mb-4">
                      <p className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
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
                        className="text-xs"
                      >
                        {product.stock > 0 ? `${product.stock} left` : "Out"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => addToCart(product.id)}
                        className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-md"
                        disabled={product.stock === 0}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {product.stock === 0 ? "Unavailable" : "Add to Cart"}
                      </Button>
                      <Button
                        onClick={() => addToWishlist(product.id)}
                        variant="outline"
                        size="icon"
                        className="hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        <Heart className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-600">
            <p className="font-semibold text-gray-900 mb-2">
              Nobonir E-Commerce
            </p>
            <p>© 2026 All rights reserved. Powered by AI.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
