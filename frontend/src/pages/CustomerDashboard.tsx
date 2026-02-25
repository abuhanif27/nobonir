import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Heart, Package, LogOut } from "lucide-react";

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
  const { user, logout } = useAuthStore();
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Nobonir E-Commerce
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.first_name}!
              </span>
              <Link to="/cart">
                <Button variant="outline" size="sm">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Cart
                </Button>
              </Link>
              <Link to="/wishlist">
                <Button variant="outline" size="sm">
                  <Heart className="mr-2 h-4 w-4" />
                  Wishlist
                </Button>
              </Link>
              <Link to="/orders">
                <Button variant="outline" size="sm">
                  <Package className="mr-2 h-4 w-4" />
                  Orders
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
        {/* Search */}
        <div className="mb-8 flex gap-4">
          <Input
            type="text"
            placeholder="Search products with AI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch}>Search</Button>
        </div>

        {/* Products */}
        {loading ? (
          <p className="text-center text-gray-600">Loading products...</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <Card key={product.id}>
                <CardHeader>
                  <img
                    src={product.image || "/placeholder.png"}
                    alt={product.name}
                    className="h-48 w-full object-cover rounded"
                  />
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <p className="text-sm text-gray-500">
                    {product.category.name}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-gray-600 line-clamp-2">
                    {product.description}
                  </p>
                  <p className="mb-4 text-xl font-bold">${product.price}</p>
                  <p className="mb-4 text-sm text-gray-500">
                    Stock: {product.stock}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => addToCart(product.id)}
                      className="flex-1"
                      disabled={product.stock === 0}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Add to Cart
                    </Button>
                    <Button
                      onClick={() => addToWishlist(product.id)}
                      variant="outline"
                      className="w-10 p-0"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
