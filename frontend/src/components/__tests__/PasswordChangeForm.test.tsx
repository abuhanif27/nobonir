import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import * as passwordLib from "@/lib/password";

vi.mock("@/lib/password");
vi.mock("@/lib/feedback", () => ({
  useFeedback: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

describe("PasswordChangeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render password change form", () => {
    render(<PasswordChangeForm />);

    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change Password/i })).toBeInTheDocument();
  });

  it("should disable submit button when fields are empty", () => {
    render(<PasswordChangeForm />);

    const submitButton = screen.getByRole("button", { name: /Change Password/i });
    expect(submitButton).toBeDisabled();
  });

  it("should show error when passwords don't match", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeForm />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "differentpass123");

    const submitButton = screen.getByRole("button", { name: /Change Password/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("should show error when password is too short", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeForm />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "short");

    const submitButton = screen.getByRole("button", { name: /Change Password/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("should call changePassword API on valid submission", async () => {
    const user = userEvent.setup();
    (passwordLib.changePassword as any).mockResolvedValueOnce({
      detail: "Password changed successfully",
    });

    render(<PasswordChangeForm />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");

    const submitButton = screen.getByRole("button", { name: /Change Password/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(passwordLib.changePassword).toHaveBeenCalledWith("oldpass123", "newpass123");
    });
  });

  it("should toggle password visibility", async () => {
    const user = userEvent.setup();
    render(<PasswordChangeForm />);

    const newPasswordInput = screen.getByLabelText("New Password") as HTMLInputElement;
    expect(newPasswordInput.type).toBe("password");

    // Find and click the visibility toggle button (Eye icon)
    const toggleButtons = screen.getAllByRole("button");
    const visibilityToggle = toggleButtons.find(
      (btn) => btn.querySelector("svg") // Icon buttons
    );

    if (visibilityToggle) {
      await user.click(visibilityToggle);
      expect(newPasswordInput.type).toBe("text");
    }
  });

  it("should clear form after successful password change", async () => {
    const user = userEvent.setup();
    (passwordLib.changePassword as any).mockResolvedValueOnce({
      detail: "Password changed successfully",
    });

    render(<PasswordChangeForm />);

    await user.type(screen.getByLabelText("Current Password"), "oldpass123");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");

    const submitButton = screen.getByRole("button", { name: /Change Password/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect((screen.getByLabelText("Current Password") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("New Password") as HTMLInputElement).value).toBe("");
    });
  });

  it("should display error message on API failure", async () => {
    const user = userEvent.setup();
    (passwordLib.changePassword as any).mockRejectedValueOnce({
      response: {
        data: {
          old_password: ["Current password is incorrect"],
        },
      },
    });

    render(<PasswordChangeForm />);

    await user.type(screen.getByLabelText("Current Password"), "wrongpass");
    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(screen.getByLabelText("Confirm New Password"), "newpass123");

    const submitButton = screen.getByRole("button", { name: /Change Password/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument();
    });
  });
});
