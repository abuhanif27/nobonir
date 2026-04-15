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
  refreshCart: () => Promise<void>;
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

  refreshCart: async () => {
    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.results)
          ? response.data.results
          : [];
      const count = apiItems.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
      set({ cartItems: apiItems, cartCount: count });
    } catch (error) {
      // On error, try to get count from local storage
      const localCart = localStorage.getItem("nobonir_demo_cart");
      if (localCart) {
        try {
          const parsed = JSON.parse(localCart);
          const items = Array.isArray(parsed) ? parsed : [];
          const count = items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 0), 0);
          set({ cartItems: items, cartCount: count });
        } catch {
          set({ cartItems: [], cartCount: 0 });
        }
      } else {
        set({ cartItems: [], cartCount: 0 });
      }
    }
  },
}));
