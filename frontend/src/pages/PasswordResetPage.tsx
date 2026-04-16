import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/password";

export function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await requestPasswordReset(email.trim());
      setMessage({
        type: "success",
        text: result.detail,
      });
      setEmail("");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.response?.data?.detail || "Failed to send reset email. Please try again.",
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
            <Mail className="h-8 w-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password
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
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="pt-4 text-center text-sm">
            <p className="text-muted-foreground">
              Remember your password?{" "}
              <a href="/login" className="font-medium text-indigo-600 hover:underline">
                Login here
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
