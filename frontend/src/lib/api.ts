import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export const MEDIA_BASE_URL =
  import.meta.env.VITE_MEDIA_URL ?? "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Intercept 401 errors to refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Import dynamically to avoid circular dependency
        const { useAuthStore } = await import("./auth");
        const { isAuthenticated, refreshAccessToken } = useAuthStore.getState();

        // Only try to refresh if user is authenticated
        if (isAuthenticated) {
          await refreshAccessToken();

          // Retry original request with new token
          const newAccessToken = useAuthStore.getState().accessToken;
          originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        const { useAuthStore } = await import("./auth");
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
