import axios from "axios";

type AuthBridge = {
  isAuthenticated: () => boolean;
  refreshAccessToken: () => Promise<void>;
  getAccessToken: () => string | null;
  logout: () => void;
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export const MEDIA_BASE_URL =
  import.meta.env.VITE_MEDIA_URL ?? "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

let authBridge: AuthBridge | null = null;

export const registerApiAuthBridge = (bridge: AuthBridge) => {
  authBridge = bridge;
};

// Intercept 401 errors to refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!authBridge || !authBridge.isAuthenticated()) {
          return Promise.reject(error);
        }

        await authBridge.refreshAccessToken();

        const newAccessToken = authBridge.getAccessToken();
        if (newAccessToken) {
          originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        authBridge?.logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
