import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/lib/password";

export function PasswordChangeForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage({
        type: "error",
        text: "New passwords do not match.",
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

    if (oldPassword === newPassword) {
      setMessage({
        type: "error",
        text: "New password must be different from your current password.",
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await changePassword(oldPassword, newPassword);
      setMessage({
        type: "success",
        text: result.detail,
      });

      // Reset form
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.old_password?.[0] ||
          error?.response?.data?.detail ||
          "Failed to change password. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Update your password to keep your account secure
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="oldPassword" className="text-sm font-medium">
              Current Password
            </label>
            <Input
              id="oldPassword"
              type="password"
              placeholder="Enter your current password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

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
              Confirm New Password
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

          <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/30 p-3 rounded">
            <p>Password requirements:</p>
            <p>• Minimum 8 characters</p>
            <p>• Must be different from current password</p>
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={isLoading || !oldPassword || !newPassword || !confirmPassword}
          >
            {isLoading ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
