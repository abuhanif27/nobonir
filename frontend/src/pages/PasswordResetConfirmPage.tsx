import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { confirmPasswordReset } from "@/lib/password";

export function PasswordResetConfirmPage() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const navigate = useNavigate();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setMessage({
        type: "error",
        text: "Invalid reset link. Please request a new one.",
      });
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!token) {
      setMessage({
        type: "error",
        text: "Invalid reset link. Please request a new one.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "Passwords do not match.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Password must be at least 8 characters long.",
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await confirmPasswordReset(token, newPassword);
      setMessage({
        type: "success",
        text: result.detail,
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.detail ||
          error?.response?.data?.token?.[0] ||
          "Failed to reset password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <Lock className="h-8 w-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl">Create New Password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your new password below to reset your account
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div
              className={`flex items-gap-2 rounded-lg p-3 text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {token ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="text-xs text-muted-foreground">
                <p>• Password must be at least 8 characters long</p>
                <p>• Use a mix of letters, numbers, and symbols for security</p>
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          ) : (
            <div className="text-center py-4">
              <Button
                onClick={() => navigate("/password-reset")}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Request New Reset Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
