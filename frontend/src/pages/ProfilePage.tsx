import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api, { MEDIA_BASE_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedToast } from "@/components/ui/animated-toast";
import {
  Package,
  Heart,
  ShoppingCart,
  User,
  Edit2,
  Save,
  X,
  Camera,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Clock,
} from "lucide-react";

interface AccountStats {
  totalOrders: number;
  wishlistCount: number;
  cartCount: number;
}

interface ToastState {
  message: string;
  type: "success" | "error";
}

export function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<AccountStats>({
    totalOrders: 0,
    wishlistCount: 0,
    cartCount: 0,
  });

  // Profile edit form state
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone_number: user?.phone_number || "",
    address: user?.address || "",
    date_of_birth: user?.date_of_birth || "",
  });

  // Password change form state
  const [passwordData, setPasswordData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone_number: user.phone_number || "",
        address: user.address || "",
        date_of_birth: user.date_of_birth || "",
      });
    }
  }, [user]);

  useEffect(() => {
    loadAccountStats();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadAccountStats = async () => {
    try {
      const [ordersRes, wishlistRes, cartRes] = await Promise.all([
        api.get("/orders/my/"),
        api.get("/cart/wishlist/"),
        api.get("/cart/items/"),
      ]);
      setStats({
        totalOrders: ordersRes.data.length || 0,
        wishlistCount: wishlistRes.data.length || 0,
        cartCount: cartRes.data.length || 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setToast({ message: "Please select an image file", type: "error" });
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setToast({
          message: "Image size should be less than 5MB",
          type: "error",
        });
        return;
      }
      setSelectedImage(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("first_name", formData.first_name);
      formDataToSend.append("last_name", formData.last_name);
      formDataToSend.append("phone_number", formData.phone_number);
      formDataToSend.append("address", formData.address);
      formDataToSend.append("date_of_birth", formData.date_of_birth);

      if (selectedImage) {
        formDataToSend.append("profile_picture", selectedImage);
      }

      await api.patch("/accounts/me/", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      await fetchMe();
      setIsEditing(false);
      setSelectedImage(null);
      setImagePreview(null);
      setToast({ message: "Profile updated successfully", type: "success" });
    } catch (error: any) {
      setToast({
        message: error.response?.data?.detail || "Failed to update profile",
        type: "error",
      });
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone_number: user.phone_number || "",
        address: user.address || "",
        date_of_birth: user.date_of_birth || "",
      });
    }
    setSelectedImage(null);
    setImagePreview(null);
    setIsEditing(false);
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setToast({ message: "New passwords do not match", type: "error" });
      return;
    }

    if (passwordData.new_password.length < 8) {
      setToast({
        message: "Password must be at least 8 characters",
        type: "error",
      });
      return;
    }

    try {
      await api.post("/accounts/me/change-password/", {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      });
      setPasswordData({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
      setIsChangingPassword(false);
      setToast({ message: "Password changed successfully", type: "success" });
    } catch (error: any) {
      setToast({
        message:
          error.response?.data?.old_password?.[0] ||
          error.response?.data?.detail ||
          "Failed to change password",
        type: "error",
      });
    }
  };

  const getInitials = () => {
    if (!user) return "U";
    const first = user.first_name?.[0] || "";
    const last = user.last_name?.[0] || "";
    return (first + last).toUpperCase() || user.email[0].toUpperCase();
  };

  const memberSince = user?.id
    ? new Date().getFullYear() - (user.id % 5)
    : new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header with Profile Picture */}
        <Card className="border-none shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Profile Picture */}
              <div className="relative">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-xl">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : user?.profile_picture ? (
                    <img
                      src={`${MEDIA_BASE_URL}${user.profile_picture}`}
                      alt={user.first_name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove(
                          "hidden",
                        );
                      }}
                    />
                  ) : null}
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-400 to-teal-600 text-4xl font-bold text-white ${imagePreview || user?.profile_picture ? "hidden" : ""}`}
                  >
                    {getInitials()}
                  </div>
                </div>
                {isEditing && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 rounded-full bg-teal-600 p-2 text-white shadow-lg transition-transform hover:scale-110 hover:bg-teal-700"
                      title="Upload profile picture"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-3xl font-bold text-gray-900">
                  {user?.first_name} {user?.last_name}
                </h1>
                <p className="mt-1 text-gray-600">{user?.email}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge variant="secondary" className="gap-1 px-3 py-1">
                    <Shield className="h-3 w-3" />
                    {user?.role}
                  </Badge>
                  <Badge variant="outline" className="gap-1 px-3 py-1">
                    <Clock className="h-3 w-3" />
                    Member since {memberSince}
                  </Badge>
                </div>
              </div>

              {/* Edit Button */}
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSaveProfile} className="gap-2">
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      variant="outline"
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-none shadow-md transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-blue-100 p-3">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-pink-100 p-3">
                  <Heart className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Wishlist Items</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.wishlistCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-green-100 p-3">
                  <ShoppingCart className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cart Items</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.cartCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.first_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            first_name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.last_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            last_name: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        value={formData.phone_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone_number: e.target.value,
                          })
                        }
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <Input
                        id="dob"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            date_of_birth: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-2 h-4 w-4 text-gray-400" />
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        placeholder="123 Main Street, City, State, ZIP"
                        rows={3}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <Mail className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <Phone className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">
                        {user?.phone_number || "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Date of Birth</p>
                      <p className="font-medium text-gray-900">
                        {user?.date_of_birth
                          ? new Date(user.date_of_birth).toLocaleDateString()
                          : "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                    <MapPin className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-medium text-gray-900">
                        {user?.address || "Not provided"}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Security & Password */}
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isChangingPassword ? (
                <>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                      Keep your account secure by using a strong password and
                      updating it regularly.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsChangingPassword(true)}
                    variant="outline"
                    className="w-full"
                  >
                    Change Password
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label htmlFor="oldPassword">Current Password</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={passwordData.old_password}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          old_password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.new_password}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          new_password: e.target.value,
                        })
                      }
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirm_password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleChangePassword} className="flex-1">
                      Update Password
                    </Button>
                    <Button
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({
                          old_password: "",
                          new_password: "",
                          confirm_password: "",
                        });
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link to="/orders">
              <Button variant="outline" size="lg" className="gap-2">
                <Package className="h-5 w-5" />
                View Orders
              </Button>
            </Link>
            <Link to="/wishlist">
              <Button variant="outline" size="lg" className="gap-2">
                <Heart className="h-5 w-5" />
                My Wishlist
              </Button>
            </Link>
            <Link to="/cart">
              <Button variant="outline" size="lg" className="gap-2">
                <ShoppingCart className="h-5 w-5" />
                Shopping Cart
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                Continue Shopping
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <AnimatedToast
          visible={!!toast}
          message={toast.message}
          type={toast.type}
        />
      )}
    </div>
  );
}
