import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  image?: string;
  image_url?: string;
  stock: number;
  available_stock?: number;
  media?: Array<{
    id: number;
    url: string;
    variant_id?: number | null;
    is_primary?: boolean;
    sort_order?: number;
  }>;
  variants?: Array<{
    id: number;
    color?: string;
    size?: string;
    media?: string[];
  }>;
  category: {
    id: number;
    name: string;
  };
}

export interface ProductReview {
  id: number;
  user_name: string;
  product: number;
  rating: number;
  comment: string;
  created_at: string;
}

// Fetch single product
const fetchProduct = async (id: string): Promise<Product> => {
  // Try endpoints (legacy support)
  try {
    const { data } = await api.get<Product>(`/products/${id}/`);
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
        // Try alternate path if exists (based on original code)
        const { data } = await api.get<Product>(`/products/products/${id}/`);
        return data;
    }
    throw error;
  }
};

export const useProduct = (id: string | undefined) => {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id!),
    enabled: !!id,
    retry: (failureCount, error: any) => {
        if (error.response?.status === 404) return false;
        return failureCount < 2;
    }
  });
};

// Fetch public reviews
const fetchReviews = async (productId: string): Promise<ProductReview[]> => {
  const { data } = await api.get(`/reviews/`, { params: { product: productId } });
  return Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
};

export const useProductReviews = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => fetchReviews(productId!),
    enabled: !!productId,
  });
};

// Fetch user's own reviews
const fetchMyReviews = async (): Promise<ProductReview[]> => {
  const { data } = await api.get(`/reviews/my/`);
  return Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
};

export const useMyReviews = (isAuthenticated: boolean) => {
  return useQuery({
    queryKey: ["myReviews"],
    queryFn: fetchMyReviews,
    enabled: isAuthenticated,
  });
};

// Check eligibility
const checkReviewEligibility = async (productId: string): Promise<boolean> => {
  try {
    const { data } = await api.get(`/reviews/can-review/`, { params: { product: productId } });
    return !!data.can_review;
  } catch {
    return false;
  }
};

export const useReviewEligibility = (productId: string | undefined, isAuthenticated: boolean) => {
  return useQuery({
    queryKey: ["reviewEligibility", productId],
    queryFn: () => checkReviewEligibility(productId!),
    enabled: !!productId && isAuthenticated,
  });
};
