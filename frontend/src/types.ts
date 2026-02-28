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
  available_stock?: number;
  availability_status?: string;
  merchandising_tags?: string[];
  total_sold_30d?: number;
  media?: Array<{
    id: number;
    url: string;
    variant_id?: number | null;
    alt_text?: string;
    sort_order?: number;
    is_primary?: boolean;
  }>;
  variants?: Array<{
    id: number;
    color?: string;
    size?: string;
    sku?: string;
    stock?: number | null;
    media?: string[];
  }>;
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
