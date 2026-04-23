import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import { useCartStore } from "@/lib/cart";
import api, { MEDIA_BASE_URL } from "@/lib/api";
import { getErrorData, getErrorStatus } from "@/lib/apiError";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { animateFlyToCart } from "@/lib/flyToCart";
import { useTheme } from "@/lib/theme";
import {
  getUserNotifications,
  markNotificationAsRead,
  StatusNotificationInput,
  onNotificationsChanged,
  syncStatusNotifications,
  UserNotification,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowStateBanner, FlowStateCard } from "@/components/ui/flow-state";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Heart,
  Eye,
  Package,
  User,
  LogOut,
  LogIn,
  UserPlus,
  Search,
  Sparkles,
  ShoppingBag,
  Tag,
  Trophy,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Globe2,
  Menu,
  X,
  BellRing,
  Clock3,
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  image: string;
  stock: number;
  available_stock?: number;
  availability_status?: string;
  merchandising_tags?: string[];
  total_sold_30d?: number;
  media?: Array<{ url?: string; is_primary?: boolean; sort_order?: number }>;
  category: {
    id: number;
    name: string;
  };
}

type MerchandisingResponse = {
  trending_now?: Product[];
  almost_gone?: Product[];
  just_restocked?: Product[];
  back_in_stock?: Product[];
};

interface PreferenceForm {
  age: string;
  location: string;
  continent: string;
  preferred_categories: number[];
}

type ProductPayload = {
  id?: number;
  name?: string;
  description?: string;
  price?: string | number;
  image?: string;
  image_url?: string;
  stock?: number;
  available_stock?: number;
  availability_status?: string;
  merchandising_tags?: string[];
  total_sold_30d?: number;
  media?: Array<{ url?: string; is_primary?: boolean; sort_order?: number }>;
  category?: {
    id?: number;
    name?: string;
  };
};

type QuantityPayload = { quantity?: number };

type GeoPayload = {
  country?: string;
  country_name?: string;
  country_code?: string;
  continent?: string;
  continent_code?: string;
};

type LocalWishlistItem = {
  product?: {
    id?: number;
  };
};

type OrderNotificationSource = {
  id: number;
  status: string;
  updated_at: string;
};

const SUGGESTION_CAROUSEL_AUTOPLAY_MS = 3000;
const DEMO_WISHLIST_KEY = "nobonir_demo_wishlist";
const PRODUCTS_PAGE_SIZE = 12;
const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
const NOTIFICATION_SECTION_SESSION_KEY = "nobonir_notification_section";

const formatRelativeTime = (isoDate: string) => {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return "just now";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

export function CustomerDashboard() {
  const { user, isAuthenticated, accessToken, logout } = useAuthStore();
  const { cartCount, refreshCart } = useCartStore();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState("1");
  const [isJumpInputFocused, setIsJumpInputFocused] = useState(false);
  const [merchandising, setMerchandising] = useState<MerchandisingResponse>({});
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isTopSellingView, setIsTopSellingView] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<
    UserNotification[]
  >([]);
  const [orderNotificationSource, setOrderNotificationSource] = useState<
    OrderNotificationSource[]
  >([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState<number>(Date.now());
  const [preferenceForm, setPreferenceForm] = useState<PreferenceForm>({
    age: "",
    location: "",
    continent: "",
    preferred_categories: [],
  });
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>(
    [],
  );
  const [activeSuggestionCategory, setActiveSuggestionCategory] =
    useState("All");
  const [suggestionStartIndex, setSuggestionStartIndex] = useState(0);
  const [isSuggestionAutoplayEnabled, setIsSuggestionAutoplayEnabled] =
    useState(true);
  const [isSuggestionInteracting, setIsSuggestionInteracting] = useState(false);
  const [isAutoPersonalizing, setIsAutoPersonalizing] = useState(false);
  const [isPreferenceHydrated, setIsPreferenceHydrated] = useState(false);
  const [isDetectingGeo, setIsDetectingGeo] = useState(false);
  const [detectedCountryCode, setDetectedCountryCode] = useState("");
  const [detectedCountryName, setDetectedCountryName] = useState("");
  const [detectedContinent, setDetectedContinent] = useState("");
  const [geoDetectionFailed, setGeoDetectionFailed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const lastAutoPersonalizeKeyRef = useRef("");

  const getAgeFromBirthDate = (dateOfBirth?: string) => {
    if (!dateOfBirth) {
      return null;
    }

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age >= 0 ? age : null;
  };

  const calculatedAge = getAgeFromBirthDate(user?.date_of_birth);

  const countryCodeToFlag = (code: string) => {
    if (!code || code.length !== 2) {
      return "🌍";
    }

    return code
      .toUpperCase()
      .split("")
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join("");
  };

  const getCountryFlagUrl = (code: string) => {
    const normalizedCode = code.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(normalizedCode)) {
      return "";
    }

    return `https://flagcdn.com/w40/${normalizedCode}.png`;
  };

  useEffect(() => {
    if (user?.profile_picture) {
      setAvatarVersion(Date.now());
    }
  }, [user?.profile_picture]);

  useEffect(() => {
    setJumpPageInput(String(productPage));
  }, [productPage]);

  const userImageSrc = user?.profile_picture
    ? user.profile_picture.startsWith("http")
      ? `${user.profile_picture}?v=${avatarVersion}`
      : `${MEDIA_BASE_URL}${user.profile_picture}?v=${avatarVersion}`
    : null;

  const resolveProductImage = useCallback((imageUrl?: string) => {
    if (!imageUrl) {
      return FALLBACK_PRODUCT_IMAGE;
    }

    if (imageUrl.startsWith("http")) {
      return imageUrl;
    }

    const normalizedPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return `${MEDIA_BASE_URL}${normalizedPath}`;
  }, []);

  const normalizeProducts = useCallback((items: unknown[]): Product[] => {
    if (!Array.isArray(items)) {
      return [];
    }

    const normalized: Product[] = [];
    items.forEach((rawItem) => {
      const item = rawItem as ProductPayload;
      const normalizedId = Number(item.id ?? 0);
      const normalizedName = String(item.name || "").trim();
      if (!normalizedId || !normalizedName) {
        return;
      }

      const primaryMediaUrl = Array.isArray(item.media)
        ? item.media.find((mediaItem) => mediaItem?.is_primary)?.url
        : "";

      normalized.push({
        id: normalizedId,
        name: normalizedName,
        description: item.description || "",
        price: String(item.price ?? ""),
        image:
          primaryMediaUrl ||
          item.image ||
          item.image_url ||
          item.media?.[0]?.url ||
          "",
        stock: Number(item.stock ?? 0),
        available_stock: Number(item.available_stock ?? item.stock ?? 0),
        availability_status: String(item.availability_status || "IN_STOCK"),
        merchandising_tags: Array.isArray(item.merchandising_tags)
          ? item.merchandising_tags
          : [],
        total_sold_30d: Number(item.total_sold_30d ?? 0),
        media: item.media || [],
        category: {
          id: item.category?.id ?? 0,
          name: item.category?.name ?? "Uncategorized",
        },
      });
    });

    return normalized;
  }, []);

  const suggestionCategories = useMemo(() => {
    const unique = new Set(
      personalizedProducts
        .map((product) => product.category.name)
        .filter(Boolean),
    );

    return ["All", ...Array.from(unique)];
  }, [personalizedProducts]);

  const totalProductPages = useMemo(() => {
    if (productTotalCount <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(productTotalCount / PRODUCTS_PAGE_SIZE));
  }, [productTotalCount]);

  const visibleProductPages = useMemo(() => {
    if (totalProductPages <= 7) {
      return Array.from({ length: totalProductPages }, (_, index) => index + 1);
    }

    const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
    const windowStart = Math.max(2, productPage - 1);
    const windowEnd = Math.min(totalProductPages - 1, productPage + 1);

    if (windowStart > 2) {
      pages.push("ellipsis-left");
    }

    for (let page = windowStart; page <= windowEnd; page += 1) {
      pages.push(page);
    }

    if (windowEnd < totalProductPages - 1) {
      pages.push("ellipsis-right");
    }

    pages.push(totalProductPages);
    return pages;
  }, [productPage, totalProductPages]);

  const paginationAnnouncement = useMemo(() => {
    if (loading) {
      return "Loading products";
    }

    const contextLabel = search.trim()
      ? "search results"
      : isTopSellingView
        ? "top selling products"
        : "all products";

    return `Loaded page ${productPage} of ${totalProductPages}. Showing ${contextLabel}. Total ${productTotalCount} products.`;
  }, [
    loading,
    search,
    isTopSellingView,
    productPage,
    totalProductPages,
    productTotalCount,
  ]);

  const visibleSuggestions = useMemo(() => {
    if (activeSuggestionCategory === "All") {
      return personalizedProducts;
    }

    return personalizedProducts.filter(
      (product) => product.category.name === activeSuggestionCategory,
    );
  }, [personalizedProducts, activeSuggestionCategory]);

  const isSuggestionAutoplayPaused =
    !isSuggestionAutoplayEnabled || isSuggestionInteracting;

  const getSuggestionStockLabel = (product: Product) => {
    const stockCount = Number(product.available_stock ?? product.stock ?? 0);

    if (stockCount <= 0) {
      return "Out of stock";
    }

    if (stockCount <= 3) {
      return `${stockCount} left`;
    }

    return "Ready to ship";
  };

  const suggestionWindowProducts = useMemo(() => {
    if (visibleSuggestions.length === 0) {
      return [];
    }

    const windowSize = Math.min(3, visibleSuggestions.length);
    return Array.from({ length: windowSize }, (_, offset) => {
      const index = (suggestionStartIndex + offset) % visibleSuggestions.length;
      return visibleSuggestions[index];
    });
  }, [visibleSuggestions, suggestionStartIndex]);

  const statusNotifications = useMemo<StatusNotificationInput[]>(() => {
    const items: StatusNotificationInput[] = [];
    const orderStatusLabels: Record<string, string> = {
      PENDING: "Order received",
      PAID: "Payment confirmed",
      PROCESSING: "Preparing items",
      SHIPPED: "Shipped",
      DELIVERED: "Delivered",
      CANCELLED: "Cancelled",
    };

    const orderItems = [...orderNotificationSource]
      .sort(
        (left, right) =>
          new Date(right.updated_at).getTime() -
          new Date(left.updated_at).getTime(),
      )
      .slice(0, 5);

    orderItems.forEach((order) => {
      const statusLabel = orderStatusLabels[order.status] || order.status;
      const tone: StatusNotificationInput["tone"] =
        order.status === "CANCELLED"
          ? "warning"
          : order.status === "DELIVERED"
            ? "success"
            : "info";

      items.push({
        term: "Order Update",
        message: `Order #${order.id} is now ${statusLabel}.`,
        tone,
        sectionKey: `order_status:${order.status}`,
      });
    });

    const trending = merchandising.trending_now?.[0];
    const almostGone = merchandising.almost_gone?.[0];
    const restocked = merchandising.just_restocked?.[0];
    const backInStock = merchandising.back_in_stock?.[0];

    if (almostGone) {
      items.push({
        term: "Low Stock Alert",
        message: `${almostGone.name} is almost gone. Order soon to avoid missing out.`,
        tone: "warning",
        sectionKey: "almost_gone",
      });
    }

    if (restocked) {
      items.push({
        term: "Restock Update",
        message: `${restocked.name} is freshly restocked and available now.`,
        tone: "success",
        sectionKey: "just_restocked",
      });
    }

    if (backInStock) {
      items.push({
        term: "Back In Stock",
        message: `${backInStock.name} has returned to stock.`,
        tone: "success",
        sectionKey: "back_in_stock",
      });
    }

    if (trending) {
      items.push({
        term: "Trending Now",
        message: `${trending.name} is currently trending with high customer demand.`,
        tone: "info",
        sectionKey: "trending_now",
      });
    }

    if (productsError) {
      items.push({
        term: "Catalog Sync",
        message:
          "Live product updates are delayed right now. Some availability may refresh shortly.",
        tone: "warning",
      });
    }

    return items.slice(0, 10);
  }, [merchandising, orderNotificationSource, productsError]);

  const unreadNotificationCount = useMemo(
    () => notificationItems.filter((item) => !item.read).length,
    [notificationItems],
  );

  const recentNotificationItems = useMemo(
    () => notificationItems.slice(0, 6),
    [notificationItems],
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotificationItems([]);
      return;
    }

    setNotificationItems(getUserNotifications(user.id));
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    return onNotificationsChanged((changedUserId) => {
      if (changedUserId !== user.id) {
        return;
      }

      setNotificationItems(getUserNotifications(user.id));
    });
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const updated = syncStatusNotifications(user.id, statusNotifications);
    setNotificationItems(updated);
  }, [isAuthenticated, statusNotifications, user?.id]);

  const loadOrderNotificationSource = useCallback(async () => {
    if (!isAuthenticated) {
      setOrderNotificationSource([]);
      return;
    }

    try {
      const response = await api.get("/orders/my/");
      const rows = Array.isArray(response.data) ? response.data : [];
      const normalized = rows
        .map((row) => ({
          id: Number(row?.id || 0),
          status: String(row?.status || "").toUpperCase(),
          updated_at: String(row?.updated_at || row?.created_at || ""),
        }))
        .filter((row) => row.id > 0 && row.status);
      setOrderNotificationSource(normalized);
    } catch {
      setOrderNotificationSource([]);
    }
  }, [isAuthenticated]);

  const applyOrderNotificationRows = useCallback((rows: unknown[]) => {
    const normalized = rows
      .map((row) => {
        const item = row as {
          id?: number;
          status?: string;
          updated_at?: string;
          created_at?: string;
        };

        return {
          id: Number(item?.id || 0),
          status: String(item?.status || "").toUpperCase(),
          updated_at: String(item?.updated_at || item?.created_at || ""),
        };
      })
      .filter((row) => row.id > 0 && row.status);

    setOrderNotificationSource(normalized);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const baseUrl = String(api.defaults.baseURL || "").replace(/\/$/, "");
    if (!baseUrl) {
      return;
    }

    let fallbackTimer: number | null = null;
    const streamUrl = `${baseUrl}/orders/my/updates/stream/?token=${encodeURIComponent(accessToken)}`;
    const stream = new EventSource(streamUrl);

    stream.addEventListener("order_status", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data || "{}");
        const rows = Array.isArray(data?.orders) ? data.orders : [];
        applyOrderNotificationRows(rows);
      } catch {
        // Ignore malformed stream payload
      }
    });

    stream.onerror = () => {
      if (fallbackTimer !== null) {
        return;
      }

      fallbackTimer = window.setInterval(() => {
        void loadOrderNotificationSource();
      }, 15000);
    };

    return () => {
      stream.close();
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
      }
    };
  }, [accessToken, applyOrderNotificationRows, isAuthenticated, loadOrderNotificationSource]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadOrderNotificationSource();
    const timer = window.setInterval(() => {
      void loadOrderNotificationSource();
    }, 45000);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, loadOrderNotificationSource]);

  useEffect(() => {
    if (
      activeSuggestionCategory !== "All" &&
      !suggestionCategories.includes(activeSuggestionCategory)
    ) {
      setActiveSuggestionCategory("All");
    }
  }, [activeSuggestionCategory, suggestionCategories]);

  useEffect(() => {
    setSuggestionStartIndex(0);
  }, [activeSuggestionCategory]);

  useEffect(() => {
    if (visibleSuggestions.length === 0) {
      setSuggestionStartIndex(0);
      return;
    }

    setSuggestionStartIndex((prev) => prev % visibleSuggestions.length);
  }, [visibleSuggestions.length]);

  useEffect(() => {
    if (visibleSuggestions.length <= 1 || isSuggestionAutoplayPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      setSuggestionStartIndex((prev) => (prev + 1) % visibleSuggestions.length);
    }, SUGGESTION_CAROUSEL_AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, [
    visibleSuggestions.length,
    activeSuggestionCategory,
    isSuggestionAutoplayPaused,
  ]);

  useEffect(() => {
    detectGeoDetails();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isPreferenceHydrated || isDetectingGeo) {
      return;
    }

    const payload = {
      age:
        calculatedAge !== null
          ? calculatedAge
          : preferenceForm.age
            ? Number(preferenceForm.age)
            : null,
      location: preferenceForm.location.trim(),
      continent: preferenceForm.continent.trim(),
      preferred_categories: [...preferenceForm.preferred_categories].sort(
        (left, right) => left - right,
      ),
    };

    const key = JSON.stringify(payload);
    if (key === lastAutoPersonalizeKeyRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsAutoPersonalizing(true);
      try {
        await api.put("/ai/preferences/", payload);
        const response = await api.post("/ai/preferences/train/");
        setPersonalizedProducts(
          normalizeProducts(response.data?.recommendations || []).filter(
            (product) => product.stock > 0,
          ),
        );
        lastAutoPersonalizeKeyRef.current = key;
      } catch (error) {
        console.error("Automatic personalization failed:", error);
      } finally {
        setIsAutoPersonalizing(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    isAuthenticated,
    isPreferenceHydrated,
    isDetectingGeo,
    normalizeProducts,
    calculatedAge,
    preferenceForm.age,
    preferenceForm.location,
    preferenceForm.continent,
    preferenceForm.preferred_categories,
  ]);

  useEffect(() => {
    if (calculatedAge === null) {
      return;
    }

    setPreferenceForm((prev) => ({
      ...prev,
      age: String(calculatedAge),
    }));
  }, [calculatedAge]);

  useEffect(() => {
    if (!isUserMenuOpen && !isNotificationMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }

      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setIsNotificationMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isUserMenuOpen, isNotificationMenuOpen]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsUserMenuOpen(false);
      setIsNotificationMenuOpen(false);
      setIsMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, []);

  const loadPreferenceData = useCallback(async () => {
    try {
      const [preferenceResult, recommendationsResult] =
        await Promise.allSettled([
          api.get("/ai/preferences/"),
          api.get("/ai/recommendations/personalized/"),
        ]);

      if (preferenceResult.status === "fulfilled") {
        setPreferenceForm({
          age: preferenceResult.value.data?.age
            ? String(preferenceResult.value.data.age)
            : "",
          location: preferenceResult.value.data?.location || "",
          continent: preferenceResult.value.data?.continent || "",
          preferred_categories:
            preferenceResult.value.data?.preferred_categories || [],
        });
      }

      if (recommendationsResult.status === "fulfilled") {
        setPersonalizedProducts(
          normalizeProducts(recommendationsResult.value.data || []).filter(
            (product) => product.stock > 0,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to load preference data:", error);
    } finally {
      setIsPreferenceHydrated(true);
    }
  }, [normalizeProducts]);

  const loadMerchandising = useCallback(async () => {
    try {
      // Add cache-busting timestamp to ensure fresh data on every load
      const timestamp = Date.now();
      const response = await api.get(`/products/merchandising/?t=${timestamp}`);
      const payload = (response.data || {}) as Record<string, unknown[]>;
      setMerchandising({
        trending_now: normalizeProducts(payload.trending_now || []),
        almost_gone: normalizeProducts(payload.almost_gone || []),
        just_restocked: normalizeProducts(payload.just_restocked || []),
        back_in_stock: normalizeProducts(payload.back_in_stock || []),
      });
    } catch (error) {
      console.error("Failed to load merchandising:", error);
      setMerchandising({});
    }
  }, [normalizeProducts]);

  const detectGeoDetails = async () => {
    setIsDetectingGeo(true);
    setGeoDetectionFailed(false);
    setDetectedCountryCode("");
    setDetectedCountryName("");
    setDetectedContinent("");

    const applyGeoData = (data: unknown) => {
      const continentMap: Record<string, string> = {
        AF: "Africa",
        AN: "Antarctica",
        AS: "Asia",
        EU: "Europe",
        NA: "North America",
        OC: "Oceania",
        SA: "South America",
      };

      const payload =
        data && typeof data === "object" ? (data as GeoPayload) : {};

      const country = payload.country || payload.country_name || "";
      const countryCode = payload.country_code || "";
      const continent =
        payload.continent ||
        continentMap[String(payload.continent_code || "").toUpperCase()] ||
        "";

      if (countryCode) {
        setDetectedCountryCode(countryCode);
      }

      if (country) {
        setDetectedCountryName(country);
      }

      if (continent) {
        setDetectedContinent(continent);
      }

      if (!country && !countryCode && !continent) {
        return false;
      }

      setPreferenceForm((prev) => ({
        ...prev,
        location: country || prev.location,
        continent: continent || prev.continent,
      }));

      return true;
    };

    const fetchWithTimeout = async (
      url: string,
      options: RequestInit = {},
      timeout = 3000,
    ) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    try {
      let browserGeo: unknown = null;

      try {
        const browserResponse = await fetchWithTimeout("https://ipwho.is/", {
          cache: "no-store",
        });
        if (browserResponse.ok) {
          const browserData = await browserResponse.json();
          if (browserData?.success) {
            browserGeo = browserData;
          }
        }
      } catch {
        browserGeo = null;
      }

      if (browserGeo && applyGeoData(browserGeo)) {
        return;
      }

      try {
        const getPublicIp = async () => {
          try {
            const response = await fetchWithTimeout(
              "https://api64.ipify.org?format=json",
              { cache: "no-store" },
              2000,
            );
            if (response.ok) {
              const data = await response.json();
              if (data?.ip) {
                return String(data.ip);
              }
            }
          } catch {
            // Continue
          }

          try {
            const response = await fetchWithTimeout(
              "https://ifconfig.co/json",
              { cache: "no-store" },
              2000,
            );
            if (response.ok) {
              const data = await response.json();
              if (data?.ip) {
                return String(data.ip);
              }
            }
          } catch {
            // Continue
          }

          return "";
        };

        const publicIp = await getPublicIp();
        const response = await api.get("/ai/geo-detect/", {
          params: {
            ...(publicIp ? { ip: publicIp } : {}),
            _ts: Date.now(),
          },
        });

        if (applyGeoData(response.data)) {
          return;
        }
      } catch {
        // Continue
      }

      // Last resort external
      try {
        const browserResponse = await fetchWithTimeout(
          "https://ipapi.co/json/",
          { cache: "no-store" },
          2000,
        );
        if (browserResponse.ok) {
          const browserData = await browserResponse.json();
          if (applyGeoData(browserData)) {
            return;
          }
        }
      } catch {
        // Continue to final fallback
      }

      const fallbackResponse = await api.get("/ai/geo-detect/", {
        params: { _ts: Date.now() },
      });
      if (!applyGeoData(fallbackResponse.data)) {
        setGeoDetectionFailed(true);
      }
    } catch (error) {
      console.error("Automatic geo detection failed:", error);
      setGeoDetectionFailed(true);
    } finally {
      setIsDetectingGeo(false);
    }
  };

  const loadProducts = useCallback(
    async (page: number = 1, availabilityOverride?: string) => {
      setLoading(true);
      setIsTopSellingView(false);
      setProductsError(null);
      try {
        const activeAvailability = availabilityOverride ?? availabilityFilter;
        const response = await api.get("/products/", {
          params:
            activeAvailability !== "ALL"
              ? {
                  availability_status: activeAvailability,
                  page,
                  page_size: PRODUCTS_PAGE_SIZE,
                }
              : { page, page_size: PRODUCTS_PAGE_SIZE },
        });
        const isPaginated = Array.isArray(response.data?.results);
        const rows = isPaginated ? response.data.results : response.data;
        const apiProducts = normalizeProducts(rows || []);
        setProducts(apiProducts);
        setProductPage(page);
        setProductTotalCount(
          isPaginated
            ? Number(response.data?.count || apiProducts.length)
            : apiProducts.length,
        );
        setHasNextPage(Boolean(isPaginated && response.data?.next));
        setHasPrevPage(Boolean(isPaginated && response.data?.previous));
        await loadMerchandising();
      } catch (error) {
        console.error("Failed to load products:", error);
        setProducts([]);
        setProductTotalCount(0);
        setHasNextPage(false);
        setHasPrevPage(false);
        setProductsError("Couldn't load products right now.");
      } finally {
        setLoading(false);
      }
    },
    [availabilityFilter, loadMerchandising, normalizeProducts],
  );

  const loadTopSellingProducts = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      setIsTopSellingView(true);
      setSearch("");
      setProductsError(null);

      try {
        const response = await api.get("/products/top-selling/", {
          params: { page, page_size: PRODUCTS_PAGE_SIZE },
        });
        const isPaginated = Array.isArray(response.data?.results);
        const rows = isPaginated ? response.data.results : response.data;
        const topSellingProducts = normalizeProducts(rows || []);
        setProducts(topSellingProducts);
        setProductPage(page);
        setProductTotalCount(
          isPaginated
            ? Number(response.data?.count || topSellingProducts.length)
            : topSellingProducts.length,
        );
        setHasNextPage(Boolean(isPaginated && response.data?.next));
        setHasPrevPage(Boolean(isPaginated && response.data?.previous));
      } catch (error) {
        console.error("Failed to load top selling products:", error);
        setProducts([]);
        setProductTotalCount(0);
        setHasNextPage(false);
        setHasPrevPage(false);
        setProductsError("Couldn't load top selling products right now.");
      } finally {
        setLoading(false);
      }
    },
    [normalizeProducts],
  );

  const loadSearchedProducts = useCallback(
    async (query: string, page: number = 1) => {
      setLoading(true);
      setIsTopSellingView(false);
      setProductsError(null);
      try {
        const response = await api.get("/products/", {
          params: { search: query, page, page_size: PRODUCTS_PAGE_SIZE },
        });
        const isPaginated = Array.isArray(response.data?.results);
        const rows = isPaginated ? response.data.results : response.data;
        const searchedProducts = normalizeProducts(rows || []);
        setProducts(searchedProducts);
        setProductPage(page);
        setProductTotalCount(
          isPaginated
            ? Number(response.data?.count || searchedProducts.length)
            : searchedProducts.length,
        );
        setHasNextPage(Boolean(isPaginated && response.data?.next));
        setHasPrevPage(Boolean(isPaginated && response.data?.previous));
      } catch (error) {
        console.error("Search failed:", error);
        setProducts([]);
        setProductTotalCount(0);
        setHasNextPage(false);
        setHasPrevPage(false);
        setProductsError("Search is temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    },
    [normalizeProducts],
  );

  const handleSearch = useCallback(async () => {
    const query = search.trim();

    if (!query) {
      setIsTopSellingView(false);
      await loadProducts(1);
      return;
    }

    await loadSearchedProducts(query, 1);
  }, [loadProducts, loadSearchedProducts, search]);

  const handleMerchandisingSectionClick = useCallback(
    async (sectionKey: string) => {
      setIsNotificationMenuOpen(false);
      setSearch("");

      if (sectionKey === "trending_now") {
        setAvailabilityFilter("ALL");
        await loadTopSellingProducts(1);
        return;
      }

      const availabilityBySection: Record<string, string> = {
        almost_gone: "ALMOST_GONE",
        just_restocked: "JUST_RESTOCKED",
        back_in_stock: "BACK_IN_STOCK",
      };

      const targetAvailability = availabilityBySection[sectionKey];
      if (!targetAvailability) {
        return;
      }

      setAvailabilityFilter(targetAvailability);
      await loadProducts(1, targetAvailability);
    },
    [loadProducts, loadTopSellingProducts],
  );

  const handleNotificationItemClick = useCallback(
    async (item: UserNotification) => {
      if (user?.id) {
        setNotificationItems(markNotificationAsRead(user.id, item.id));
      }

      if (item.sectionKey) {
        if (item.sectionKey.startsWith("order_status:")) {
          const statusValue = item.sectionKey.replace("order_status:", "");
          setIsNotificationMenuOpen(false);
          navigate(`/orders?status=${encodeURIComponent(statusValue)}`);
          return;
        }

        await handleMerchandisingSectionClick(item.sectionKey);
        return;
      }

      setIsNotificationMenuOpen(false);
    },
    [handleMerchandisingSectionClick, navigate, user?.id],
  );

  useEffect(() => {
    const pendingSection = sessionStorage.getItem(
      NOTIFICATION_SECTION_SESSION_KEY,
    );
    if (!pendingSection) {
      return;
    }

    sessionStorage.removeItem(NOTIFICATION_SECTION_SESSION_KEY);
    if (pendingSection.startsWith("order_status:")) {
      const statusValue = pendingSection.replace("order_status:", "");
      navigate(`/orders?status=${encodeURIComponent(statusValue)}`);
      return;
    }

    void handleMerchandisingSectionClick(pendingSection);
  }, [handleMerchandisingSectionClick, navigate]);

  const navigateToPage = useCallback(
    (page: number) => {
      if (isTopSellingView) {
        void loadTopSellingProducts(page);
        return;
      }

      const query = search.trim();
      if (query) {
        void loadSearchedProducts(query, page);
        return;
      }

      void loadProducts(page);
    },
    [isTopSellingView, loadProducts, loadSearchedProducts, loadTopSellingProducts, search],
  );

  const jumpToPage = useCallback(() => {
    const trimmedInput = jumpPageInput.trim();
    if (!trimmedInput) {
      showError("Please enter a page number");
      return;
    }

    const parsedPage = Number(trimmedInput);
    if (!Number.isFinite(parsedPage)) {
      showError("Please enter a valid page number");
      return;
    }

    const pageFloor = Math.floor(parsedPage);
    if (pageFloor < 1) {
      showError(`Page must be at least 1`);
      return;
    }

    if (pageFloor > totalProductPages) {
      showError(`Maximum page is ${totalProductPages}`);
      setJumpPageInput(String(totalProductPages));
      return;
    }

    const nextPage = pageFloor;
    navigateToPage(nextPage);
    // Reset input to current page after navigation
    setJumpPageInput(String(nextPage));
  }, [jumpPageInput, navigateToPage, totalProductPages, showError]);

  useEffect(() => {
    void loadProducts();
    void refreshCart(isAuthenticated);
    setIsInitialLoad(false);
  }, [isAuthenticated, loadProducts, refreshCart]);

  useEffect(() => {
    // Auto-refresh merchandising every 60 seconds to ensure fresh product data
    const merchandisingRefreshInterval = window.setInterval(() => {
      void loadMerchandising();
    }, 60000);

    return () => window.clearInterval(merchandisingRefreshInterval);
  }, [loadMerchandising]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadPreferenceData();
  }, [isAuthenticated, loadPreferenceData]);

  useEffect(() => {
    if (isInitialLoad) return;

    const query = search.trim();

    const debounceTimer = setTimeout(() => {
      if (query) {
        void handleSearch();
        return;
      }

      if (!isTopSellingView) {
        void loadProducts();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [handleSearch, isInitialLoad, isTopSellingView, loadProducts, search]);

  const addToCart = async (product: Product, sourceElement?: HTMLElement) => {
    const addToLocalDemoCart = () => {
      const key = "nobonir_demo_cart";
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingIndex = existing.findIndex(
        (item: QuantityPayload & { product?: { id?: number } }) =>
          item.product?.id === product.id,
      );

      if (existingIndex >= 0) {
        existing[existingIndex].quantity += 1;
      } else {
        existing.push({
          id: product.id,
          quantity: 1,
          isLocal: true,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            stock: product.stock,
          },
        });
      }

      localStorage.setItem(key, JSON.stringify(existing));
    };

    animateFlyToCart({
      fromElement: sourceElement,
      imageSrc: product.image,
    });

    if (isAuthenticated) {
      try {
        await api.post("/cart/items/", {
          product_id: product.id,
          quantity: 1,
        });
      } catch (error: unknown) {
        console.warn("Failed to add to server cart, using local backup", error);
      }
    }

    // Always ensure item is in local cache as backup
    addToLocalDemoCart();
    await refreshCart(isAuthenticated);
    return true;
  };

  const viewProduct = (product: Product) => {
    sessionStorage.setItem("nobonir_selected_product", JSON.stringify(product));
    navigate(`/product/${product.id}`);
  };

  const addToWishlist = async (
    productId: number,
    sourceElement?: HTMLElement,
    imageSrc?: string,
  ) => {
    if (!isAuthenticated) {
      showError("Please log in to add products to your wishlist");
      return;
    }

    try {
      await api.post("/cart/wishlist/", {
        product_id: productId,
      });

      animateFlyToCart({
        fromElement: sourceElement,
        toSelector: '[data-user-menu-trigger="true"]',
        imageSrc,
      });

      showSuccess("Product added to wishlist");
    } catch (error: unknown) {
      const addToLocalDemoWishlist = () => {
        const selectedProduct = products.find((item) => item.id === productId);
        if (!selectedProduct) {
          return { ok: false, reason: "missing" as const };
        }

        if (selectedProduct.stock <= 0) {
          return { ok: false, reason: "out_of_stock" as const };
        }

        const existingRaw = localStorage.getItem(DEMO_WISHLIST_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const alreadyExists = Array.isArray(existing)
          ? existing.some(
              (item: LocalWishlistItem) =>
                item?.product?.id === selectedProduct.id,
            )
          : false;

        if (alreadyExists) {
          return { ok: true, reason: "already_exists" as const };
        }

        const safeExisting = Array.isArray(existing) ? existing : [];
        safeExisting.push({
          id: -selectedProduct.id,
          isLocal: true,
          created_at: new Date().toISOString(),
          product: {
            id: selectedProduct.id,
            name: selectedProduct.name,
            description: selectedProduct.description,
            price: selectedProduct.price,
            stock: selectedProduct.stock,
            image: selectedProduct.image,
            category: selectedProduct.category,
          },
        });

        localStorage.setItem(DEMO_WISHLIST_KEY, JSON.stringify(safeExisting));
        return { ok: true, reason: "added" as const };
      };

      const errorData = getErrorData(error);
      const apiMessage =
        typeof errorData?.detail === "string" ? errorData.detail : "";
      const isMissingProductError =
        apiMessage.toLowerCase().includes("no product matches") ||
        getErrorStatus(error) === 404;

      if (isMissingProductError) {
        const localResult = addToLocalDemoWishlist();
        if (localResult.ok && sourceElement) {
          animateFlyToCart({
            fromElement: sourceElement,
            toSelector: '[data-user-menu-trigger="true"]',
            imageSrc,
          });
        }

        const localResultMessage = localResult.ok
          ? localResult.reason === "already_exists"
            ? "This product is already in your wishlist"
            : "Product added to wishlist"
          : localResult.reason === "out_of_stock"
            ? "This product is out of stock and cannot be added to your wishlist"
            : "This product is not available in the live catalog yet and cannot be added to your wishlist";

        if (localResult.ok) {
          showSuccess(localResultMessage);
        } else {
          showError(localResultMessage);
        }
        return;
      }

      showError(apiMessage || "Failed to add product to wishlist");
    }
  };

  const scrollSuggestionCarousel = (direction: "left" | "right") => {
    if (visibleSuggestions.length <= 1) {
      return;
    }

    setSuggestionStartIndex((prev) => {
      if (direction === "right") {
        return (prev + 1) % visibleSuggestions.length;
      }

      return (prev - 1 + visibleSuggestions.length) % visibleSuggestions.length;
    });
  };

  const goToSuggestionIndex = (index: number) => {
    if (visibleSuggestions.length === 0) {
      return;
    }

    const normalizedIndex =
      ((index % visibleSuggestions.length) + visibleSuggestions.length) %
      visibleSuggestions.length;
    setSuggestionStartIndex(normalizedIndex);
  };

  const toggleSuggestionAutoplay = () => {
    setIsSuggestionAutoplayEnabled((prev) => !prev);
  };

  const availabilityLabelMap: Record<string, string> = {
    ALL: "All",
    IN_STOCK: "In Stock",
    ALMOST_GONE: "Almost Gone",
    JUST_RESTOCKED: "Just Restocked",
    BACK_IN_STOCK: "Back in Stock",
    OUT_OF_STOCK: "Out of Stock",
  };

  const styles = {
    cartNavButton: "gap-2 relative",
    cartCountBadge:
      "absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center",
    userMenuItem:
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted",
    desktopSignUpButton:
      "gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700",
    mobileNavOutlineButton: "w-full justify-start",
    mobileSignUpButton:
      "w-full justify-start bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700",
    productAddToCartButton:
      "w-full bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-semibold",
  };

  const suggestionOverlayClass =
    resolvedTheme === "dark"
      ? "bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.14),transparent_30%)]"
      : "bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_30%)]";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 pt-20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:pt-24">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <a
                href="/"
                className="flex min-w-0 items-center gap-2 sm:gap-3"
                aria-label="Go to home"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-600 blur-lg opacity-70 animate-pulse"></div>
                  <div className="relative rounded-xl bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-2 shadow-lg sm:p-2.5">
                    <ShoppingBag className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black leading-none tracking-tight sm:text-3xl">
                    <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent drop-shadow-sm">
                      No
                    </span>
                    <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-sm">
                      Bonir
                    </span>
                  </h1>
                  <p className="mt-0.5 hidden truncate bg-gradient-to-r from-gray-600 via-teal-600 to-cyan-600 bg-clip-text text-[10px] font-semibold leading-tight tracking-wide text-transparent min-[375px]:block min-[375px]:text-xs">
                    Soft Style Smart Shopping
                  </p>
                </div>
              </a>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-1.5 lg:hidden">
              {isAuthenticated ? (
                <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"
                  >
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Profile
                  </Button>
                </Link>
              ) : (
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-2.5 text-xs sm:px-3 sm:text-sm"
                  >
                    <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Login
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-primary-nav"
              >
                {isMobileMenuOpen ? (
                  <X className="h-4.5 w-4.5" />
                ) : (
                  <Menu className="h-4.5 w-4.5" />
                )}
              </Button>
            </div>

            <nav
              className="hidden w-full flex-wrap items-center justify-start gap-2 lg:flex lg:w-auto lg:justify-end lg:gap-3"
              aria-label="Primary"
            >
              {isAuthenticated ? (
                <>
                  <Link to="/cart">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.cartNavButton}
                      data-cart-nav="true"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cartCount > 0 && (
                        <span className={styles.cartCountBadge}>
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      void loadTopSellingProducts(1);
                    }}
                  >
                    <Trophy className="h-4 w-4" />
                    <span className="hidden sm:inline">Top Selling</span>
                  </Button>
                  <div className="relative" ref={notificationMenuRef}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative gap-2"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsNotificationMenuOpen((prev) => !prev);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={isNotificationMenuOpen}
                      aria-controls="dashboard-notification-menu"
                    >
                      <BellRing className="h-4 w-4" />
                      <span className="hidden sm:inline">Notifications</span>
                      {unreadNotificationCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                          {unreadNotificationCount > 99
                            ? "99+"
                            : unreadNotificationCount}
                        </span>
                      )}
                    </Button>

                    {isNotificationMenuOpen && (
                      <div
                        id="dashboard-notification-menu"
                        role="menu"
                        aria-label="Notifications"
                        className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-card p-2 shadow-lg"
                      >
                        <div className="flex items-center justify-between gap-2 px-2 py-1">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Product Status Notifications
                          </p>
                          <Link
                            to="/notifications"
                            onClick={() => setIsNotificationMenuOpen(false)}
                            className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                          >
                            View all
                          </Link>
                        </div>
                        <div className="max-h-80 overflow-auto">
                          {recentNotificationItems.length > 0 ? (
                            recentNotificationItems.map((notification) => {
                              const toneClass =
                                notification.tone === "warning"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : notification.tone === "success"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : "text-cyan-700 dark:text-cyan-300";

                              return (
                                <button
                                  key={notification.id}
                                  type="button"
                                  className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                                  onClick={() => {
                                    void handleNotificationItemClick(
                                      notification,
                                    );
                                  }}
                                >
                                  <p
                                    className={`text-xs font-semibold ${toneClass}`}
                                  >
                                    {notification.term}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {notification.message}
                                  </p>
                                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock3 className="h-3 w-3" />
                                    <span
                                      title={new Date(
                                        notification.createdAt,
                                      ).toLocaleString()}
                                    >
                                      {formatRelativeTime(
                                        notification.createdAt,
                                      )}
                                    </span>
                                  </p>
                                </button>
                              );
                            })
                          ) : (
                            <p className="px-2 py-3 text-xs text-muted-foreground">
                              No new notifications.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                      data-user-menu-trigger="true"
                      aria-haspopup="menu"
                      aria-expanded={isUserMenuOpen}
                      aria-controls="dashboard-user-menu"
                      className="flex items-center gap-2 rounded-full border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-3 py-2 text-slate-900 transition-colors hover:from-teal-100 hover:to-cyan-100 dark:border-slate-700 dark:from-slate-800 dark:to-slate-700 dark:text-slate-100 dark:hover:from-slate-700 dark:hover:to-slate-600"
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
                        {userImageSrc ? (
                          <img
                            src={userImageSrc}
                            alt={user?.first_name || "User"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.nextElementSibling?.classList.remove(
                                "hidden",
                              );
                            }}
                          />
                        ) : null}
                        <span className={userImageSrc ? "hidden" : ""}>
                          {user?.first_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="max-w-24 truncate text-sm font-medium text-foreground">
                        {user?.first_name || "Profile"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {isUserMenuOpen && (
                      <div
                        id="dashboard-user-menu"
                        role="menu"
                        aria-label="User menu"
                        className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-border bg-card shadow-lg p-2"
                      >
                        <Link
                          to="/profile"
                          onClick={() => setIsUserMenuOpen(false)}
                          role="menuitem"
                          className={styles.userMenuItem}
                        >
                          <User className="h-4 w-4" />
                          My Profile
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setIsUserMenuOpen(false)}
                          role="menuitem"
                          className={styles.userMenuItem}
                        >
                          <Package className="h-4 w-4" />
                          Orders
                        </Link>
                        <Link
                          to="/wishlist"
                          onClick={() => setIsUserMenuOpen(false)}
                          role="menuitem"
                          className={styles.userMenuItem}
                        >
                          <Heart className="h-4 w-4" />
                          Wishlist
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout();
                          }}
                          role="menuitem"
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Badge
                    variant="secondary"
                    className="hidden gap-1.5 py-1.5 px-3 md:flex"
                  >
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    Browsing as Guest
                  </Badge>
                  <Link to="/cart">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.cartNavButton}
                      data-cart-nav="true"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cartCount > 0 && (
                        <span className={styles.cartCountBadge}>
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      void loadTopSellingProducts(1);
                    }}
                  >
                    <Trophy className="h-4 w-4" />
                    <span className="hidden sm:inline">Top Selling</span>
                  </Button>
                  <Link to="/login">
                    <Button variant="outline" size="sm" className="gap-2">
                      <LogIn className="h-4 w-4" />
                      Login
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" className={styles.desktopSignUpButton}>
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>

          {isMobileMenuOpen && (
            <nav
              id="mobile-primary-nav"
              className="mt-3 rounded-xl border border-border bg-card p-3 shadow-lg lg:hidden"
              aria-label="Mobile primary"
            >
              <div className="grid grid-cols-2 gap-2">
                <Link to="/cart" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={styles.mobileNavOutlineButton}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Cart
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    void loadTopSellingProducts(1);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Top Selling
                </Button>
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/notifications"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.mobileNavOutlineButton}
                      >
                        <BellRing className="mr-2 h-4 w-4" />
                        Notifications
                      </Button>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.mobileNavOutlineButton}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Button>
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.mobileNavOutlineButton}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        Orders
                      </Button>
                    </Link>
                    <Link
                      to="/wishlist"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.mobileNavOutlineButton}
                      >
                        <Heart className="mr-2 h-4 w-4" />
                        Wishlist
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start text-red-600 hover:text-red-600"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        logout();
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.mobileNavOutlineButton}
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                      </Button>
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button size="sm" className={styles.mobileSignUpButton}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative mb-8 overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 py-12 text-white dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 sm:py-16">
        {/* Animated Background Circles */}
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-cyan-400 opacity-20 mix-blend-multiply blur-3xl filter animate-pulse dark:bg-cyan-500 dark:opacity-25"></div>
        <div
          className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-blue-400 opacity-20 mix-blend-multiply blur-3xl filter animate-pulse dark:bg-indigo-500 dark:opacity-30"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 h-96 w-96 rounded-full bg-purple-400 opacity-20 mix-blend-multiply blur-3xl filter animate-pulse dark:bg-violet-500 dark:opacity-30"
          style={{ animationDelay: "2s" }}
        ></div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="mb-5 flex items-center justify-center gap-2 sm:mb-6 sm:gap-3">
              <Sparkles className="h-8 w-8 animate-pulse text-yellow-300 dark:text-teal-300 sm:h-10 sm:w-10" />
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent drop-shadow-lg">
                  Discover
                </span>
              </h2>
              <Sparkles className="h-8 w-8 animate-pulse text-yellow-300 dark:text-teal-300 sm:h-10 sm:w-10" />
            </div>
            <p className="mb-8 text-lg font-light tracking-wide text-white/95 dark:text-slate-200 sm:text-2xl">
              Find exactly what you need with intelligent search
            </p>

            {/* Enhanced Search */}
            <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1 group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 opacity-0 blur-xl transition-opacity duration-300 group-focus-within:opacity-100 dark:from-cyan-500 dark:via-blue-500 dark:to-violet-500"></div>
                <Search className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Try 'wireless headphones' or 'summer dress'..."
                  aria-label="Search products"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                  className="relative h-14 rounded-2xl border border-border/50 bg-background/95 pl-12 text-base font-medium text-foreground caret-teal-600 placeholder:text-muted-foreground shadow-2xl backdrop-blur-md focus-visible:ring-2 focus-visible:ring-white/60 sm:text-lg"
                />
              </div>
              <Button
                onClick={handleSearch}
                size="lg"
                className="h-14 bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 px-8 font-bold text-white shadow-2xl transition-all hover:scale-105 hover:from-teal-400 hover:via-cyan-500 hover:to-blue-500 hover:shadow-xl dark:from-cyan-500 dark:via-blue-600 dark:to-violet-600 dark:hover:from-cyan-400 dark:hover:via-blue-500 dark:hover:to-violet-500"
              >
                <Sparkles className="mr-2 h-5 w-5 text-yellow-200 dark:text-cyan-100" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
      >
        {isAuthenticated && (
          <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:mb-10 sm:p-6">
            <div className={`absolute inset-0 ${suggestionOverlayClass}`} />
            <div className="relative">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground shadow-sm backdrop-blur-sm">
                    <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-cyan-300" />
                    Curated for you
                  </div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-foreground sm:text-2xl">
                      Exclusive Suggestions for You
                    </h4>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                      Hand-picked from your browsing, cart, and wishlist signals.
                    </p>
                  </div>
                </div>

                {isAutoPersonalizing ? (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:border-teal-400/30 dark:text-teal-200">
                    <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse dark:bg-teal-300" />
                    Refreshing picks
                  </span>
                ) : (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                    <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                    Personalized carousel
                  </span>
                )}
              </div>

              {personalizedProducts.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {suggestionCategories.map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={
                        activeSuggestionCategory === category
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setActiveSuggestionCategory(category)}
                      className={`h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm ${
                        activeSuggestionCategory === category
                          ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                          : "border-border bg-background/70 text-foreground hover:bg-muted"
                      }`}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              )}

              {personalizedProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground backdrop-blur-sm">
                  Preparing your personalized picks...
                </div>
              ) : visibleSuggestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground backdrop-blur-sm">
                  No suggestions in this category yet. Try another category.
                </div>
              ) : (
                <div
                  className="space-y-4"
                  onMouseEnter={() => setIsSuggestionInteracting(true)}
                  onMouseLeave={() => setIsSuggestionInteracting(false)}
                  onFocusCapture={() => setIsSuggestionInteracting(true)}
                  onBlurCapture={(event) => {
                    const nextTarget = event.relatedTarget as Node | null;
                    if (!event.currentTarget.contains(nextTarget)) {
                      setIsSuggestionInteracting(false);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      scrollSuggestionCarousel("left");
                    }

                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      scrollSuggestionCarousel("right");
                    }
                  }}
                  tabIndex={0}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-xs font-semibold text-foreground sm:px-3 sm:py-1"
                      >
                        {isSuggestionAutoplayPaused ? "Paused" : "Auto Playing"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="rounded-full border-border bg-background/70 px-2.5 py-0.5 text-xs font-semibold text-foreground sm:px-3 sm:py-1"
                      >
                        {visibleSuggestions.length} picks
                      </Badge>
                    </div>

                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 p-1 shadow-md backdrop-blur-sm sm:p-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full text-foreground hover:bg-muted sm:h-8 sm:w-8"
                        onClick={() => scrollSuggestionCarousel("left")}
                        aria-label="Previous suggestions"
                        disabled={visibleSuggestions.length <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        onClick={toggleSuggestionAutoplay}
                        aria-label={
                          isSuggestionAutoplayEnabled
                            ? "Pause auto sliding"
                            : "Play auto sliding"
                        }
                        className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 hover:bg-primary/90 sm:h-9 sm:w-9"
                        disabled={visibleSuggestions.length <= 1}
                      >
                        {isSuggestionAutoplayEnabled ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full text-foreground hover:bg-muted sm:h-8 sm:w-8"
                        onClick={() => scrollSuggestionCarousel("right")}
                        aria-label="Next suggestions"
                        disabled={visibleSuggestions.length <= 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {suggestionWindowProducts.map((product, cardIndex) => {
                      const isFeaturedCard = cardIndex === 1;

                      return (
                        <Card
                          key={`pref-${product.id}-${cardIndex}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`View product ${product.name}`}
                          onClick={() => viewProduct(product)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              viewProduct(product);
                            }
                          }}
                          className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card/90 shadow-[0_12px_32px_rgba(15,23,42,0.10)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[0_24px_50px_rgba(20,184,166,0.14)] focus-visible:ring-2 focus-visible:ring-ring ${
                            isFeaturedCard ? "ring-1 ring-teal-300/40" : ""
                          }`}
                        >
                          <CardHeader className="relative p-0">
                            <div className="relative overflow-hidden">
                              <img
                                src={resolveProductImage(product.image)}
                                alt={product.name}
                                className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent dark:from-slate-950/55" />
                              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                                <Badge className="rounded-full border border-border bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
                                  <Sparkles className="mr-1 h-3 w-3 text-teal-600 dark:text-teal-300" />
                                  For you
                                </Badge>
                                {isFeaturedCard && (
                                  <Badge className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                                    Featured
                                  </Badge>
                                )}
                              </div>
                              <div className="absolute right-3 top-3">
                                <Badge
                                  variant="secondary"
                                  className="rounded-full border border-border bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm"
                                >
                                  {getSuggestionStockLabel(product)}
                                </Badge>
                              </div>
                              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                                  Tap card to open
                                </span>
                                <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm backdrop-blur-sm">
                                  Quick actions below
                                </span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="line-clamp-1 text-base font-semibold text-card-foreground sm:text-lg">
                                    {product.name}
                                  </p>
                                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Tag className="h-3.5 w-3.5" />
                                    {product.category.name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                    Price
                                  </p>
                                  <p className="text-lg font-black text-primary sm:text-xl">
                                    {formatPrice(product.price)}
                                  </p>
                                </div>
                              </div>
                              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {product.description || "A curated recommendation based on your recent activity."}
                              </p>
                            </div>

                            <div className="mt-auto grid gap-2 pt-1 sm:grid-cols-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  viewProduct(product);
                                }}
                                size="sm"
                                className="w-full border-border bg-background text-foreground shadow-sm transition-all hover:bg-muted"
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                View Product
                              </Button>
                              <Button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addToCart(product, event.currentTarget);
                                }}
                                size="sm"
                                className="w-full bg-primary font-semibold text-primary-foreground shadow-lg transition-all hover:scale-[1.01] hover:bg-primary/90"
                              >
                                Add to Cart
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {visibleSuggestions.length > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {visibleSuggestions.map((product, index) => {
                        const isActive = index === suggestionStartIndex;
                        return (
                          <button
                            key={`dot-${product.id}-${index}`}
                            type="button"
                            onClick={() => goToSuggestionIndex(index)}
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                              isActive
                                ? "w-7 bg-primary"
                                : "w-2.5 bg-border hover:bg-muted-foreground/50"
                            }`}
                            aria-label={`Go to suggestion ${index + 1}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Products */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              {/* Multiple spinning rings */}
              <div className="h-24 w-24 rounded-full border-4 border-border/40"></div>
              <div className="absolute top-0 left-0 h-24 w-24 rounded-full border-4 border-t-teal-500 border-r-cyan-500 border-b-transparent border-l-transparent animate-spin"></div>
              <div
                className="absolute top-2 left-2 h-20 w-20 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-purple-500 border-l-transparent animate-spin"
                style={{
                  animationDuration: "1.5s",
                  animationDirection: "reverse",
                }}
              ></div>
            </div>
            <p className="mt-8 text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Loading amazing products...
            </p>
            <p className="text-sm font-semibold bg-gradient-to-r from-gray-500 via-teal-500 to-cyan-600 bg-clip-text text-transparent mt-2 tracking-wide">
              Soft Style Smart Shopping
            </p>
          </div>
        ) : productsError && products.length === 0 ? (
          <FlowStateCard
            title="Couldn’t load products"
            message={productsError}
            actionLabel="Try Again"
            onAction={loadProducts}
            className="mx-auto max-w-xl"
            contentClassName="py-12"
          />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-cyan-500 blur-2xl opacity-20 rounded-full"></div>
              <div className="relative bg-gradient-to-br from-muted to-muted p-10 rounded-full shadow-xl">
                <ShoppingBag className="h-24 w-24 text-muted-foreground" />
              </div>
            </div>
            <h3 className="mb-3 text-3xl font-black text-foreground">
              No Products Found
            </h3>
            <p className="mb-8 max-w-md text-center text-lg text-muted-foreground">
              {search ? (
                <>
                  We couldn't find any products matching "
                  <span className="font-semibold">{search}</span>". Try a
                  different search term!
                </>
              ) : isTopSellingView ? (
                "No top selling products yet. Complete more orders to see trends here."
              ) : (
                "It looks like there are no products available right now. Check back soon!"
              )}
            </p>
            {!search && !isTopSellingView && (
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                {Object.keys(availabilityLabelMap).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={availabilityFilter === key ? "default" : "outline"}
                    onClick={() => {
                      setAvailabilityFilter(key);
                      void loadProducts(1);
                    }}
                  >
                    {availabilityLabelMap[key]}
                  </Button>
                ))}
              </div>
            )}
            {(search || isTopSellingView) && (
              <Button
                onClick={() => {
                  setIsTopSellingView(false);
                  setSearch("");
                  loadProducts();
                }}
                variant="outline"
              >
                {search ? "Clear Search" : "Back to All Products"}
              </Button>
            )}
            {!search && !isTopSellingView && availabilityFilter !== "ALL" && (
              <Button
                onClick={() => {
                  setAvailabilityFilter("ALL");
                  void loadProducts(1);
                }}
                variant="outline"
              >
                Show All Products
              </Button>
            )}
          </div>
        ) : (
          <>
            {productsError && (
              <FlowStateBanner
                className="mb-6"
                message={productsError}
                tone="warning"
                actionLabel="Retry Live Products"
                onAction={loadProducts}
              />
            )}

            {!!(
              merchandising.trending_now?.length ||
              merchandising.almost_gone?.length ||
              merchandising.just_restocked?.length ||
              merchandising.back_in_stock?.length
            ) && (
              <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Trending Now",
                    key: "trending_now",
                    items: merchandising.trending_now || [],
                  },
                  {
                    title: "Almost Gone",
                    key: "almost_gone",
                    items: merchandising.almost_gone || [],
                  },
                  {
                    title: "Just Restocked",
                    key: "just_restocked",
                    items: merchandising.just_restocked || [],
                  },
                  {
                    title: "Back in Stock",
                    key: "back_in_stock",
                    items: merchandising.back_in_stock || [],
                  },
                ].map((section) => (
                  <Card
                    key={section.key}
                    className="h-full border border-border/70 bg-card/95"
                  >
                    <CardContent className="p-3 sm:p-4">
                      <p className="text-xs font-bold text-foreground sm:text-sm">
                        {section.title}
                      </p>
                      {section.items[0] ? (
                        <button
                          type="button"
                          className="mt-2.5 flex w-full items-center gap-2.5 text-left sm:mt-3 sm:gap-3"
                          onClick={() => {
                            void handleMerchandisingSectionClick(section.key);
                          }}
                        >
                          <img
                            src={resolveProductImage(section.items[0].image)}
                            alt={section.items[0].name}
                            className="h-10 w-10 rounded-md object-cover sm:h-12 sm:w-12"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                            }}
                          />
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-xs font-semibold sm:text-sm">
                              {section.items[0].name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(section.items[0].price)}
                            </p>
                            <p className="text-[11px] text-teal-700 dark:text-teal-300">
                              View all in {section.title}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mt-3 w-full rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-left transition-colors hover:bg-muted/50"
                          onClick={() => {
                            void handleMerchandisingSectionClick(section.key);
                          }}
                        >
                          <p className="text-xs text-muted-foreground">
                            No items yet.
                          </p>
                          <p className="mt-1 text-[11px] text-teal-700 dark:text-teal-300">
                            Open {section.title}
                          </p>
                        </button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-black text-foreground sm:text-3xl">
                  {search
                    ? "🔍 Search Results"
                    : isTopSellingView
                      ? "🏆 Top Selling Products"
                      : "✨ All Products"}
                </h3>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Found {productTotalCount}{" "}
                  {productTotalCount === 1
                    ? "amazing product"
                    : "amazing products"}
                </p>
                {!search && !isTopSellingView && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.keys(availabilityLabelMap).map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={
                          availabilityFilter === key ? "default" : "outline"
                        }
                        onClick={() => setAvailabilityFilter(key)}
                      >
                        {availabilityLabelMap[key]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              {(search || isTopSellingView) && (
                <Button
                  onClick={() => {
                    setIsTopSellingView(false);
                    setSearch("");
                    void loadProducts(1);
                  }}
                  variant="outline"
                  size="sm"
                >
                  {search ? "Clear Search" : "Back to All Products"}
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="group relative overflow-hidden rounded-xl border-0 bg-card shadow-lg transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl sm:rounded-2xl"
                >
                  {/* Hover Gradient Border Effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl -z-10"
                    style={{ padding: "2px" }}
                  ></div>

                  <CardHeader className="p-0">
                    <div className="relative overflow-hidden bg-gradient-to-br from-muted to-muted">
                      <img
                        src={resolveProductImage(product.image)}
                        alt={product.name}
                        className="h-48 w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110 sm:h-56"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
                        }}
                      />
                      {/* Shimmer Effect on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full transform"></div>

                      <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-background/95 px-2 py-1 text-[10px] font-semibold text-foreground shadow-lg backdrop-blur-md sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs"
                        >
                          <Tag className="h-3 w-3" />
                          {product.category.name}
                        </Badge>
                      </div>
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge
                            variant="destructive"
                            className="px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
                          >
                            Out of Stock
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6">
                    <CardTitle className="mb-1.5 line-clamp-1 text-sm font-bold text-foreground transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-teal-600 group-hover:to-cyan-600 group-hover:bg-clip-text group-hover:text-transparent sm:mb-2 sm:text-lg">
                      {product.name}
                    </CardTitle>
                    <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:mb-4 sm:text-sm">
                      {product.description}
                    </p>
                    <div className="mb-4 flex items-baseline justify-between sm:mb-5">
                      <p className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-xl font-black text-transparent drop-shadow-sm sm:text-3xl">
                        {formatPrice(product.price)}
                      </p>
                      <Badge
                        variant={
                          (product.available_stock ?? product.stock) > 10
                            ? "default"
                            : (product.available_stock ?? product.stock) > 0
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-[10px] font-bold shadow-sm sm:text-xs"
                      >
                        {product.availability_status === "ALMOST_GONE"
                          ? "Almost Gone"
                          : product.availability_status === "JUST_RESTOCKED"
                            ? "Just Restocked"
                            : product.availability_status === "BACK_IN_STOCK"
                              ? "Back in Stock"
                              : (product.available_stock ?? product.stock) > 0
                                ? `${product.available_stock ?? product.stock} left`
                                : "Out"}
                      </Badge>
                    </div>
                    {isTopSellingView && (product.total_sold_30d || 0) > 0 && (
                      <p className="mb-4 text-xs font-medium text-muted-foreground">
                        Sold in last 30 days: {product.total_sold_30d}
                      </p>
                    )}
                    <div className="space-y-1.5 sm:space-y-2">
                      <Button
                        onClick={(e) => addToCart(product, e.currentTarget)}
                        className={`${styles.productAddToCartButton} h-9 text-sm sm:h-10`}
                        disabled={
                          (product.available_stock ?? product.stock) === 0
                        }
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {(product.available_stock ?? product.stock) === 0
                          ? "Unavailable"
                          : "Add to Cart"}
                      </Button>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => viewProduct(product)}
                          variant="outline"
                          className="h-9 text-xs transition-all shadow-md hover:border-cyan-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-cyan-700 sm:text-sm"
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                          View Product
                        </Button>
                        <Button
                          onClick={(e) =>
                            addToWishlist(
                              product.id,
                              e.currentTarget,
                              product.image,
                            )
                          }
                          variant="outline"
                          className="h-9 text-xs transition-all shadow-md hover:border-red-300 hover:bg-gradient-to-br hover:from-red-50 hover:to-pink-50 hover:text-red-600 sm:text-sm"
                        >
                          <Heart className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                          Wishlist
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {paginationAnnouncement}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !hasPrevPage}
                aria-label="Go to previous page"
                onClick={() => {
                  const nextPage = Math.max(productPage - 1, 1);
                  navigateToPage(nextPage);
                }}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {productPage} of {totalProductPages}
              </span>
              {visibleProductPages.map((page, index) => {
                if (typeof page !== "number") {
                  return (
                    <span
                      key={`${page}-${index}`}
                      className="px-2 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  );
                }

                return (
                  <Button
                    key={page}
                    variant={page === productPage ? "default" : "outline"}
                    size="sm"
                    disabled={loading}
                    aria-label={`Go to page ${page}`}
                    aria-current={page === productPage ? "page" : undefined}
                    onClick={() => {
                      navigateToPage(page);
                    }}
                  >
                    {page}
                  </Button>
                );
              })}
              <div className="flex items-center gap-2">
                <Input
                  value={jumpPageInput}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, "");
                    // Cap input at max page number to prevent massive entries
                    const capped = digitsOnly ? String(Math.min(Number(digitsOnly), totalProductPages * 10)) : "";
                    setJumpPageInput(capped);
                  }}
                  onFocus={(event) => {
                    event.currentTarget.select();
                    setIsJumpInputFocused(true);
                  }}
                  onBlur={() => {
                    setIsJumpInputFocused(false);
                    // Reset to current page if input is empty on blur
                    if (!jumpPageInput.trim()) {
                      setJumpPageInput(String(productPage));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      jumpToPage();
                    }
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={String(productPage)}
                  maxLength="6"
                  aria-label={`Jump to page (current: ${productPage}/${totalProductPages})`}
                  title={`Enter page 1-${totalProductPages}`}
                  className="h-9 w-24 text-center"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || totalProductPages <= 1 || !jumpPageInput.trim()}
                  aria-label={`Jump to page (max: ${totalProductPages})`}
                  title={`Jump to page 1-${totalProductPages}`}
                  onClick={jumpToPage}
                >
                  Go
                </Button>
                {isJumpInputFocused && (
                  <span className="hidden text-xs text-muted-foreground md:inline">
                    Press Enter to jump
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !hasNextPage}
                aria-label="Go to next page"
                onClick={() => {
                  const nextPage = productPage + 1;
                  navigateToPage(nextPage);
                }}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </main>
      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white border-t border-gray-700 mt-16">
        <div className="absolute inset-0 bg-grid-white/5"></div>
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="mb-3 text-2xl font-black sm:text-3xl">
              <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                No
              </span>
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                Bonir
              </span>
            </h3>
            <p className="mb-2 hidden bg-gradient-to-r from-gray-400 via-teal-400 to-cyan-400 bg-clip-text text-xs font-semibold tracking-wide text-transparent min-[375px]:block min-[375px]:text-sm">
              Soft Style Smart Shopping
            </p>
            <div className="mx-auto mb-3 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-teal-300 shadow-lg shadow-teal-900/20 sm:w-auto sm:max-w-none sm:justify-start sm:px-5">
              <Globe2 className="h-4 w-4 shrink-0" />
              {detectedCountryName && getCountryFlagUrl(detectedCountryCode) ? (
                <img
                  src={getCountryFlagUrl(detectedCountryCode)}
                  alt={`${detectedCountryCode.toUpperCase()} flag`}
                  className="h-4 w-6 rounded-[2px] object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-sm leading-none sm:text-base">
                  {detectedCountryName
                    ? countryCodeToFlag(detectedCountryCode)
                    : "🌍"}
                </span>
              )}
              <span className="text-center text-xs font-semibold leading-tight sm:text-left sm:text-sm">
                {detectedCountryName && detectedContinent
                  ? `You're from ${detectedCountryName}, ${detectedContinent}`
                  : detectedCountryName
                    ? `You're from ${detectedCountryName}`
                    : isDetectingGeo
                      ? "Detecting your region..."
                      : geoDetectionFailed
                        ? "Region unavailable right now"
                        : "Welcome from around the world"}
              </span>
            </div>
            <p className="text-xs text-gray-500">© 2026 All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
