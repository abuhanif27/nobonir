import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api, { MEDIA_BASE_URL } from "@/lib/api";
import { getErrorData, getErrorStatus } from "@/lib/apiError";
import { useCurrency } from "@/lib/currency";
import { useFeedback } from "@/lib/feedback";
import { animateFlyToCart } from "@/lib/flyToCart";
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

const SUGGESTION_CAROUSEL_AUTOPLAY_MS = 3000;
const DEMO_WISHLIST_KEY = "nobonir_demo_wishlist";
const PRODUCTS_PAGE_SIZE = 12;

export function CustomerDashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { formatPrice } = useCurrency();
  const { showError, showSuccess } = useFeedback();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [merchandising, setMerchandising] = useState<MerchandisingResponse>({});
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isTopSellingView, setIsTopSellingView] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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

  useEffect(() => {
    if (user?.profile_picture) {
      setAvatarVersion(Date.now());
    }
  }, [user?.profile_picture]);

  const userImageSrc = user?.profile_picture
    ? user.profile_picture.startsWith("http")
      ? `${user.profile_picture}?v=${avatarVersion}`
      : `${MEDIA_BASE_URL}${user.profile_picture}?v=${avatarVersion}`
    : null;

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
    const pages: number[] = [];
    const start = Math.max(1, productPage - 2);
    const end = Math.min(totalProductPages, productPage + 2);
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }, [productPage, totalProductPages]);

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
    if (!isUserMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current) {
        return;
      }

      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isUserMenuOpen]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, []);

  const getLocalCartCount = useCallback(() => {
    const raw = localStorage.getItem("nobonir_demo_cart");
    if (!raw) {
      return 0;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return 0;
      }

      return parsed.reduce(
        (sum: number, item: QuantityPayload) => sum + (item.quantity || 0),
        0,
      );
    } catch {
      return 0;
    }
  }, []);

  const refreshCartCount = useCallback(async () => {
    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.results)
          ? response.data.results
          : [];
      const apiCount = apiItems.reduce(
        (sum: number, item: QuantityPayload) => sum + (item.quantity || 0),
        0,
      );

      setCartCount(apiCount > 0 ? apiCount : getLocalCartCount());
    } catch {
      setCartCount(getLocalCartCount());
    }
  }, [getLocalCartCount]);

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
      const response = await api.get("/products/merchandising/");
      const payload = (response.data || {}) as Record<string, unknown[]>;
      setMerchandising({
        trending_now: normalizeProducts(payload.trending_now || []),
        almost_gone: normalizeProducts(payload.almost_gone || []),
        just_restocked: normalizeProducts(payload.just_restocked || []),
        back_in_stock: normalizeProducts(payload.back_in_stock || []),
      });
    } catch {
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

    try {
      let browserGeo: unknown = null;

      try {
        const browserResponse = await fetch("https://ipwho.is/", {
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

      if (!browserGeo) {
        try {
          const browserResponse = await fetch("https://ipapi.co/json/", {
            cache: "no-store",
          });
          if (browserResponse.ok) {
            const browserData = await browserResponse.json();
            browserGeo = browserData;
          }
        } catch {
          browserGeo = null;
        }
      }

      if (browserGeo && applyGeoData(browserGeo)) {
        return;
      }

      try {
        const getPublicIp = async () => {
          try {
            const response = await fetch(
              "https://api64.ipify.org?format=json",
              {
                cache: "no-store",
              },
            );
            if (response.ok) {
              const data = await response.json();
              if (data?.ip) {
                return String(data.ip);
              }
            }
          } catch {
            // Continue to next provider
          }

          try {
            const response = await fetch("https://ifconfig.co/json", {
              cache: "no-store",
            });
            if (response.ok) {
              const data = await response.json();
              if (data?.ip) {
                return String(data.ip);
              }
            }
          } catch {
            // Continue to backend lookup without IP
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
        // Continue to backend no-ip fallback
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
    async (page: number = 1) => {
      setLoading(true);
      setIsTopSellingView(false);
      setProductsError(null);
      try {
        const response = await api.get("/products/", {
          params:
            availabilityFilter !== "ALL"
              ? {
                  availability_status: availabilityFilter,
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

  const loadTopSellingProducts = async (page: number = 1) => {
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
  };

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

  useEffect(() => {
    void loadProducts();
    void refreshCartCount();
    setIsInitialLoad(false);
  }, [loadProducts, refreshCartCount]);

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

    try {
      await api.post("/cart/items/", {
        product_id: product.id,
        quantity: 1,
      });
      await refreshCartCount();
      return true;
    } catch (error: unknown) {
      addToLocalDemoCart();
      await refreshCartCount();
      return false;
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 pt-20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:pt-24">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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
          <section className="mb-10 rounded-2xl border border-border bg-card/85 p-6 shadow-lg backdrop-blur-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-lg font-bold text-foreground">
                Exclusive Suggestions for You
              </h4>
              {isAutoPersonalizing && (
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                  Refreshing...
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
                    className="h-8"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}

            {personalizedProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                Preparing your personalized picks...
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                No suggestions in this category yet. Try another category.
              </div>
            ) : (
              <div
                className="space-y-4"
                onMouseEnter={() => setIsSuggestionInteracting(true)}
                onMouseLeave={() => setIsSuggestionInteracting(false)}
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
                <div className="flex items-center justify-between gap-3">
                  <Badge
                    variant="secondary"
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                  >
                    {isSuggestionAutoplayPaused ? "Paused" : "Auto Playing"}
                  </Badge>

                  <div className="inline-flex items-center gap-1 rounded-full border border-teal-200/70 bg-background/90 p-1.5 shadow-md backdrop-blur-sm">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full"
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
                      className="h-9 w-9 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm hover:from-teal-600 hover:to-cyan-700"
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
                      className="h-8 w-8 rounded-full"
                      onClick={() => scrollSuggestionCarousel("right")}
                      aria-label="Next suggestions"
                      disabled={visibleSuggestions.length <= 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {suggestionWindowProducts.map((product, cardIndex) => (
                    <Card
                      key={`pref-${product.id}-${cardIndex}`}
                      className={`border shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-lg ${
                        cardIndex === 1 ? "ring-1 ring-teal-200" : ""
                      }`}
                    >
                      <CardHeader className="p-0">
                        <img
                          src={
                            product.image ||
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
                          }
                          alt={product.name}
                          className="h-36 w-full rounded-t-lg object-cover"
                        />
                      </CardHeader>
                      <CardContent className="p-3">
                        <p className="line-clamp-1 font-semibold text-foreground">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.category.name}
                        </p>
                        <p className="text-sm font-bold text-teal-800 dark:text-teal-300">
                          {formatPrice(product.price)}
                        </p>
                        <Button
                          onClick={(e) => addToCart(product, e.currentTarget)}
                          size="sm"
                          className="mt-2 w-full"
                        >
                          Add to Cart
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
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
                              ? "w-7 bg-teal-600"
                              : "w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                          }`}
                          aria-label={`Go to suggestion ${index + 1}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <Card key={section.key} className="border border-border/70">
                    <CardContent className="p-4">
                      <p className="text-sm font-bold text-foreground">
                        {section.title}
                      </p>
                      {section.items[0] ? (
                        <button
                          type="button"
                          className="mt-3 flex w-full items-center gap-3 text-left"
                          onClick={() => viewProduct(section.items[0])}
                        >
                          <img
                            src={section.items[0].image}
                            alt={section.items[0].name}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold">
                              {section.items[0].name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPrice(section.items[0].price)}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          No items yet.
                        </p>
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

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="group relative overflow-hidden rounded-2xl border-0 bg-card shadow-lg transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl"
                >
                  {/* Hover Gradient Border Effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl -z-10"
                    style={{ padding: "2px" }}
                  ></div>

                  <CardHeader className="p-0">
                    <div className="relative overflow-hidden bg-gradient-to-br from-muted to-muted">
                      <img
                        src={
                          product.image ||
                          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
                        }
                        alt={product.name}
                        className="h-56 w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop";
                        }}
                      />
                      {/* Shimmer Effect on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full transform"></div>

                      <div className="absolute top-3 right-3">
                        <Badge
                          variant="secondary"
                          className="bg-background/95 backdrop-blur-md text-foreground gap-1.5 shadow-lg font-semibold"
                        >
                          <Tag className="h-3 w-3" />
                          {product.category.name}
                        </Badge>
                      </div>
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Badge
                            variant="destructive"
                            className="text-sm px-4 py-2"
                          >
                            Out of Stock
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="bg-gradient-to-br from-background to-muted/30 p-5 sm:p-6">
                    <CardTitle className="mb-2 line-clamp-1 text-base font-bold text-foreground transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-teal-600 group-hover:to-cyan-600 group-hover:bg-clip-text group-hover:text-transparent sm:text-lg">
                      {product.name}
                    </CardTitle>
                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {product.description}
                    </p>
                    <div className="mb-5 flex items-baseline justify-between">
                      <p className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-2xl font-black text-transparent drop-shadow-sm sm:text-3xl">
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
                        className="text-xs font-bold shadow-sm"
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
                    <div className="space-y-2">
                      <Button
                        onClick={(e) => addToCart(product, e.currentTarget)}
                        className={styles.productAddToCartButton}
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
                          className="hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-cyan-700 hover:border-cyan-300 transition-all shadow-md"
                        >
                          <Eye className="mr-2 h-4 w-4" />
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
                          className="hover:bg-gradient-to-br hover:from-red-50 hover:to-pink-50 hover:text-red-600 hover:border-red-300 transition-all shadow-md"
                        >
                          <Heart className="mr-2 h-4 w-4" />
                          Wishlist
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !hasPrevPage}
                onClick={() => {
                  const nextPage = Math.max(productPage - 1, 1);
                  if (isTopSellingView) {
                    void loadTopSellingProducts(nextPage);
                    return;
                  }

                  const query = search.trim();
                  if (query) {
                    void loadSearchedProducts(query, nextPage);
                    return;
                  }
                  void loadProducts(nextPage);
                }}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {productPage}
              </span>
              {visibleProductPages.map((page) => (
                <Button
                  key={page}
                  variant={page === productPage ? "default" : "outline"}
                  size="sm"
                  disabled={loading}
                  onClick={() => {
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
                  }}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !hasNextPage}
                onClick={() => {
                  const nextPage = productPage + 1;
                  if (isTopSellingView) {
                    void loadTopSellingProducts(nextPage);
                    return;
                  }

                  const query = search.trim();
                  if (query) {
                    void loadSearchedProducts(query, nextPage);
                    return;
                  }
                  void loadProducts(nextPage);
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
              <span className="text-sm leading-none sm:text-base">
                {detectedCountryName
                  ? countryCodeToFlag(detectedCountryCode)
                  : "🌍"}
              </span>
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
