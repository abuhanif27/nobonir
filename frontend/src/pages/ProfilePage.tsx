import { Link } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Heart, ShoppingCart, User } from "lucide-react";

export function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              My Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">First Name</p>
                <p className="font-medium text-gray-900">
                  {user?.first_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Name</p>
                <p className="font-medium text-gray-900">
                  {user?.last_name || "-"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900">
                  {user?.email || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Role</p>
                <Badge variant="secondary" className="mt-1">
                  {user?.role || "CUSTOMER"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link to="/orders">
              <Button variant="outline" className="gap-2">
                <Package className="h-4 w-4" />
                Orders
              </Button>
            </Link>
            <Link to="/wishlist">
              <Button variant="outline" className="gap-2">
                <Heart className="h-4 w-4" />
                Wishlist
              </Button>
            </Link>
            <Link to="/cart">
              <Button variant="outline" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Cart
              </Button>
            </Link>
            <Link to="/">
              <Button>Back to Shopping</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
