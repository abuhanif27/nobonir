import { create } from "zustand";
import api from "./api";

interface CartItem {
  id?: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
}

interface CartState {
  cartCount: number;
  cartItems: CartItem[];
  setCartCount: (count: number) => void;
  setCartItems: (items: CartItem[]) => void;
  refreshCart: (isAuthenticated: boolean) => Promise<void>;
}

export const useCartStore = create<CartState>((set) => ({
  cartCount: 0,
  cartItems: [],

  setCartCount: (count: number) => {
    set({ cartCount: count });
  },

  setCartItems: (items: CartItem[]) => {
    const count = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    set({ cartItems: items, cartCount: count });
  },

  refreshCart: async (isAuthenticated: boolean) => {
    const loadLocalCart = () => {
      const raw = localStorage.getItem("nobonir_demo_cart");
      if (!raw) {
        set({ cartItems: [], cartCount: 0 });
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : [];
        const count = items.reduce(
          (sum: number, item: CartItem) => sum + (item.quantity || 0),
          0,
        );
        set({ cartItems: items, cartCount: count });
      } catch {
        set({ cartItems: [], cartCount: 0 });
      }
    };

    // Guest cart is browser-only by design.
    if (!isAuthenticated) {
      loadLocalCart();
      return;
    }

    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.results)
          ? response.data.results
          : [];
      const count = apiItems.reduce(
        (sum: number, item: CartItem) => sum + (item.quantity || 0),
        0,
      );
      set({ cartItems: apiItems, cartCount: count });
    } catch {
      loadLocalCart();
    }
  },
}));
