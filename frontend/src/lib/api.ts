import axios from "axios";

import type { CartItem, Category, Order, Product, WishlistItem } from "@/types";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const endpoints = {
  health: () => api.get<{ status: string }>("/health/"),
  categories: () => api.get<Category[]>("/categories/"),
  products: (params: Record<string, string | number | boolean | undefined>) =>
    api.get<Product[]>("/products/", { params }),
  reviews: {
    list: (productId: number) => api.get(`/products/${productId}/reviews/`),
    create: (
      productId: number,
      payload: { customer_name: string; rating: number; comment: string },
    ) => api.post(`/products/${productId}/reviews/`, payload),
  },
  recommendations: (customerId: string) =>
    api.get<Product[]>("/ai/recommendations/", {
      params: { customer_id: customerId },
    }),
  cart: {
    list: (customerId: string) =>
      api.get<CartItem[]>("/cart/", { params: { customer_id: customerId } }),
    add: (payload: {
      customer_id: string;
      product_id: number;
      quantity: number;
    }) => api.post<CartItem>("/cart/", payload),
    update: (itemId: number, quantity: number) =>
      api.patch<CartItem>(`/cart/${itemId}/`, { quantity }),
    remove: (itemId: number) => api.delete(`/cart/${itemId}/`),
  },
  wishlist: {
    list: (customerId: string) =>
      api.get<WishlistItem[]>("/wishlist/", {
        params: { customer_id: customerId },
      }),
    add: (payload: { customer_id: string; product_id: number }) =>
      api.post<WishlistItem>("/wishlist/", payload),
    remove: (itemId: number) => api.delete(`/wishlist/${itemId}/`),
  },
  checkout: (payload: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    shipping_address: string;
  }) => api.post<Order>("/checkout/", payload),
  orders: (email?: string) =>
    api.get<Order[]>("/orders/", { params: { customer_email: email } }),
};
