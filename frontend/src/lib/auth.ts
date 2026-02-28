import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "./api";
import { getErrorStatus } from "./apiError";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "CUSTOMER";
  profile_picture?: string;
  phone_number?: string;
  address?: string;
  date_of_birth?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isAdmin: false,
      hasHydrated: false,

      setHasHydrated: (value: boolean) => {
        set({ hasHydrated: value });
      },

      login: async (email: string, password: string) => {
        const response = await api.post("/auth/token/", {
          email,
          password,
        });
        const { access, refresh, user } = response.data;

        set({
          user,
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
          isAdmin: user.role === "ADMIN",
        });

        // Set default authorization header
        api.defaults.headers.common["Authorization"] = `Bearer ${access}`;
      },

      register: async (
        email: string,
        password: string,
        firstName: string,
        lastName: string,
      ) => {
        await api.post("/accounts/register/", {
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        });

        // Auto-login after registration
        await get().login(email, password);
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isAdmin: false,
        });

        delete api.defaults.headers.common["Authorization"];
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().logout();
          throw new Error("No refresh token available");
        }

        try {
          const response = await api.post("/auth/token/refresh/", {
            refresh: refreshToken,
          });

          const { access } = response.data;
          set({ accessToken: access });
          api.defaults.headers.common["Authorization"] = `Bearer ${access}`;
        } catch (error) {
          get().logout();
          throw error;
        }
      },

      fetchMe: async () => {
        try {
          const response = await api.get("/accounts/me/");
          const user = response.data;

          set({
            user,
            isAuthenticated: true,
            isAdmin: user.role === "ADMIN",
          });
        } catch (error: unknown) {
          const status = getErrorStatus(error);
          if (status === 401 || status === 403) {
            get().logout();
          }
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }

        // Restore authorization header on page reload
        if (state?.accessToken) {
          api.defaults.headers.common["Authorization"] =
            `Bearer ${state.accessToken}`;
          state
            .fetchMe()
            .catch((error: unknown) => {
              const status = getErrorStatus(error);

              // Token expired, try to refresh
              if (status === 401 || status === 403) {
                state
                  .refreshAccessToken()
                  .catch(() => {
                    state.logout();
                  })
                  .finally(() => {
                    state.setHasHydrated(true);
                  });
                return;
              }

              state.setHasHydrated(true);
            })
            .finally(() => {
              state.setHasHydrated(true);
            });
          return;
        }

        state.setHasHydrated(true);
      },
    },
  ),
);
