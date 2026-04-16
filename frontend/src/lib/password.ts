import api from "./api";

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

export interface PasswordChange {
  old_password: string;
  new_password: string;
}

/**
 * Request a password reset link for an email address
 */
export async function requestPasswordReset(email: string): Promise<{ detail: string }> {
  const response = await api.post("/accounts/password-reset/", {
    email,
  });
  return response.data;
}

/**
 * Confirm password reset with token and new password
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ detail: string; user: { id: number; email: string; username: string } }> {
  const response = await api.post("/accounts/password-reset/confirm/", {
    token,
    new_password: newPassword,
  });
  return response.data;
}

/**
 * Change password for authenticated user
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ detail: string }> {
  const response = await api.post("/accounts/me/change-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return response.data;
}
