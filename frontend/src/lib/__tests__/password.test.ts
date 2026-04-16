import { describe, it, expect, beforeEach, vi } from "vitest";
import * as passwordLib from "@/lib/password";
import api from "@/lib/api";

vi.mock("@/lib/api");

describe("Password Reset Library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requestPasswordReset", () => {
    it("should make POST request to password-reset endpoint", async () => {
      const mockResponse = { data: { detail: "Reset email sent" } };
      (api.post as any).mockResolvedValueOnce(mockResponse);

      const result = await passwordLib.requestPasswordReset("test@example.com");

      expect(api.post).toHaveBeenCalledWith("/accounts/password-reset/", {
        email: "test@example.com",
      });
      expect(result.detail).toBe("Reset email sent");
    });

    it("should handle errors when requesting reset", async () => {
      const error = new Error("Network error");
      (api.post as any).mockRejectedValueOnce(error);

      await expect(passwordLib.requestPasswordReset("test@example.com")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("confirmPasswordReset", () => {
    it("should make POST request with token and password", async () => {
      const mockResponse = {
        data: {
          detail: "Password reset successful",
          user: { id: 1, email: "test@example.com", username: "testuser" },
        },
      };
      (api.post as any).mockResolvedValueOnce(mockResponse);

      const result = await passwordLib.confirmPasswordReset("token123", "newpass123");

      expect(api.post).toHaveBeenCalledWith("/accounts/password-reset/confirm/", {
        token: "token123",
        new_password: "newpass123",
      });
      expect(result.user.email).toBe("test@example.com");
    });

    it("should handle invalid token error", async () => {
      const error = {
        response: {
          data: {
            detail: "Invalid password reset token.",
          },
        },
      };
      (api.post as any).mockRejectedValueOnce(error);

      await expect(passwordLib.confirmPasswordReset("badtoken", "newpass123")).rejects.toThrow();
    });
  });

  describe("changePassword", () => {
    it("should make POST request with old and new passwords", async () => {
      const mockResponse = { data: { detail: "Password changed successfully" } };
      (api.post as any).mockResolvedValueOnce(mockResponse);

      const result = await passwordLib.changePassword("oldpass123", "newpass123");

      expect(api.post).toHaveBeenCalledWith("/accounts/me/change-password/", {
        old_password: "oldpass123",
        new_password: "newpass123",
      });
      expect(result.detail).toBe("Password changed successfully");
    });

    it("should handle incorrect old password error", async () => {
      const error = {
        response: {
          data: {
            old_password: ["Current password is incorrect"],
          },
        },
      };
      (api.post as any).mockRejectedValueOnce(error);

      await expect(passwordLib.changePassword("wrongpass", "newpass123")).rejects.toThrow();
    });
  });
});
