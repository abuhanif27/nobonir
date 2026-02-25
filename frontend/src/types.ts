export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  category: Category;
  price: number;
  discounted_price: number;
  stock: number;
  image_url: string;
  offer_percent: number;
  is_active: boolean;
  average_rating: number | null;
  created_at: string;
};

export type CartItem = {
  id: number;
  customer_id: string;
  product: Product;
  quantity: number;
  updated_at: string;
};

export type WishlistItem = {
  id: number;
  customer_id: string;
  product: Product;
  created_at: string;
};

export type OrderItem = {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
};

export type Order = {
  id: number;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  status: string;
  total_amount: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};
