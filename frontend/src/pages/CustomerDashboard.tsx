import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import api, { MEDIA_BASE_URL } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { animateFlyToCart } from "@/lib/flyToCart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Globe2,
  Menu,
  X,
} from "lucide-react";

type SuggestionGender = "male" | "female";

interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  image: string;
  stock: number;
  category: {
    id: number;
    name: string;
  };
}

interface PreferenceForm {
  age: string;
  location: string;
  continent: string;
  preferred_categories: number[];
}

// Demo products with beautiful images
const DEMO_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Premium Wireless Headphones",
    description:
      "Experience crystal-clear audio with active noise cancellation and 30-hour battery life. Perfect for music lovers and professionals.",
    price: "299.99",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop",
    stock: 15,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 2,
    name: "Smart Fitness Watch",
    description:
      "Track your health and fitness goals with GPS, heart rate monitoring, and sleep tracking. Water-resistant up to 50m.",
    price: "249.99",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop",
    stock: 8,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 3,
    name: "Minimalist Leather Backpack",
    description:
      "Handcrafted genuine leather backpack with laptop compartment and multiple pockets. Perfect for daily commute.",
    price: "189.99",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop",
    stock: 12,
    category: { id: 2, name: "Fashion" },
  },
  {
    id: 4,
    name: "Organic Cotton T-Shirt",
    description:
      "Sustainably made from 100% organic cotton. Soft, breathable, and perfect for everyday wear.",
    price: "29.99",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=400&fit=crop",
    stock: 50,
    category: { id: 2, name: "Fashion" },
  },
  {
    id: 5,
    name: "Ceramic Coffee Mug Set",
    description:
      "Set of 4 handmade ceramic mugs. Microwave and dishwasher safe. Each mug holds 12oz.",
    price: "45.99",
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=400&fit=crop",
    stock: 25,
    category: { id: 3, name: "Home & Kitchen" },
  },
  {
    id: 6,
    name: "Yoga Mat Premium",
    description:
      "Non-slip, eco-friendly yoga mat with extra cushioning. Includes carrying strap. Perfect for all yoga styles.",
    price: "59.99",
    image:
      "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=400&fit=crop",
    stock: 20,
    category: { id: 4, name: "Sports" },
  },
  {
    id: 7,
    name: "Desk Plant Collection",
    description:
      "Set of 3 low-maintenance succulents in modern ceramic pots. Perfect for office or home decoration.",
    price: "34.99",
    image:
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&h=400&fit=crop",
    stock: 18,
    category: { id: 3, name: "Home & Kitchen" },
  },
  {
    id: 8,
    name: "Professional Camera Kit",
    description:
      "24MP DSLR camera with 18-55mm lens, tripod, and camera bag. Ideal for beginners and enthusiasts.",
    price: "899.99",
    image:
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&h=400&fit=crop",
    stock: 5,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 9,
    name: "Running Sneakers",
    description:
      "Lightweight running shoes with responsive cushioning and breathable mesh upper. Available in multiple colors.",
    price: "119.99",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop",
    stock: 30,
    category: { id: 2, name: "Fashion" },
  },
  {
    id: 10,
    name: "Portable Bluetooth Speaker",
    description:
      "Waterproof speaker with 360° sound and 12-hour battery life. Perfect for outdoor adventures.",
    price: "79.99",
    image:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=400&fit=crop",
    stock: 22,
    category: { id: 1, name: "Electronics" },
  },
  {
    id: 11,
    name: "Scented Candle Set",
    description:
      "Set of 6 aromatherapy candles with natural soy wax. Includes lavender, vanilla, and eucalyptus scents.",
    price: "39.99",
    image:
      "https://images.unsplash.com/photo-1602874801006-c2c0ff734d7e?w=600&h=400&fit=crop",
    stock: 40,
    category: { id: 3, name: "Home & Kitchen" },
  },
  {
    id: 12,
    name: "Stainless Steel Water Bottle",
    description:
      "Insulated bottle keeps drinks cold for 24 hours or hot for 12 hours. BPA-free and leak-proof.",
    price: "24.99",
    image:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=400&fit=crop",
    stock: 0,
    category: { id: 4, name: "Sports" },
  },
];

const GENDER_KEYWORDS: Record<SuggestionGender, string[]> = {
  male: [
    "men",
    "male",
    "shirt",
    "watch",
    "wallet",
    "sneaker",
    "sports",
    "gaming",
    "headphone",
    "camera",
  ],
  female: [
    "women",
    "female",
    "dress",
    "skirt",
    "handbag",
    "jewelry",
    "beauty",
    "makeup",
    "home",
    "kitchen",
  ],
};

const GENDER_CATEGORY_HINTS: Record<SuggestionGender, string[]> = {
  male: ["electronics", "sports", "automotive", "tools", "gaming"],
  female: ["fashion", "beauty", "home", "kitchen", "jewelry"],
};

const getGenderSuggestionScore = (
  product: Product,
  gender: SuggestionGender,
) => {
  const keywordMatches = GENDER_KEYWORDS[gender].reduce((score, keyword) => {
    const haystack = `${product.name} ${product.description}`.toLowerCase();
    return haystack.includes(keyword) ? score + 2 : score;
  }, 0);

  const categoryName = product.category.name.toLowerCase();
  const categoryBonus = GENDER_CATEGORY_HINTS[gender].some((hint) =>
    categoryName.includes(hint),
  )
    ? 1
    : 0;

  return keywordMatches + categoryBonus;
};

export function CustomerDashboard() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isTopSellingView, setIsTopSellingView] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [wishlistToast, setWishlistToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
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
  const [suggestionGender, setSuggestionGender] =
    useState<SuggestionGender>("male");
  const [activeSuggestionCategory, setActiveSuggestionCategory] =
    useState("All");
  const [isAutoPersonalizing, setIsAutoPersonalizing] = useState(false);
  const [isPreferenceHydrated, setIsPreferenceHydrated] = useState(false);
  const [isDetectingGeo, setIsDetectingGeo] = useState(false);
  const [detectedCountryCode, setDetectedCountryCode] = useState("");
  const [detectedCountryName, setDetectedCountryName] = useState("");
  const [detectedContinent, setDetectedContinent] = useState("");
  const [geoDetectionFailed, setGeoDetectionFailed] = useState(false);
  const suggestionCarouselRef = useRef<HTMLDivElement | null>(null);
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

  const normalizeProducts = (items: any[]): Product[] => {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        price: String(item.price ?? ""),
        image: item.image || item.image_url || "",
        stock: Number(item.stock ?? 0),
        category: {
          id: item.category?.id ?? 0,
          name: item.category?.name ?? "Uncategorized",
        },
      }))
      .filter((item) => Boolean(item.id) && Boolean(item.name));
  };

  const genderAwareSuggestions = useMemo(() => {
    return [...personalizedProducts].sort((left, right) => {
      const leftScore = getGenderSuggestionScore(left, suggestionGender);
      const rightScore = getGenderSuggestionScore(right, suggestionGender);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.id - right.id;
    });
  }, [personalizedProducts, suggestionGender]);

  const suggestionCategories = useMemo(() => {
    const unique = new Set(
      genderAwareSuggestions
        .map((product) => product.category.name)
        .filter(Boolean),
    );

    return ["All", ...Array.from(unique)];
  }, [genderAwareSuggestions]);

  const visibleSuggestions = useMemo(() => {
    if (activeSuggestionCategory === "All") {
      return genderAwareSuggestions;
    }

    return genderAwareSuggestions.filter(
      (product) => product.category.name === activeSuggestionCategory,
    );
  }, [genderAwareSuggestions, activeSuggestionCategory]);

  useEffect(() => {
    if (
      activeSuggestionCategory !== "All" &&
      !suggestionCategories.includes(activeSuggestionCategory)
    ) {
      setActiveSuggestionCategory("All");
    }
  }, [activeSuggestionCategory, suggestionCategories]);

  useEffect(() => {
    const carousel = suggestionCarouselRef.current;
    if (!carousel) {
      return;
    }

    carousel.scrollTo({ left: 0, behavior: "smooth" });
  }, [activeSuggestionCategory, suggestionGender]);

  useEffect(() => {
    loadProducts();
    refreshCartCount();
    setIsInitialLoad(false);
  }, []);

  useEffect(() => {
    detectGeoDetails();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadPreferenceData();
  }, [isAuthenticated]);

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
    if (!wishlistToast) {
      return;
    }

    const timer = setTimeout(() => {
      setWishlistToast(null);
    }, 2200);

    return () => clearTimeout(timer);
  }, [wishlistToast]);

  useEffect(() => {
    if (isInitialLoad) return;

    const query = search.trim();

    const debounceTimer = setTimeout(() => {
      if (query) {
        handleSearch();
        return;
      }

      if (!isTopSellingView) {
        loadProducts();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [search, isTopSellingView]);

  const getLocalCartCount = () => {
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
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );
    } catch {
      return 0;
    }
  };

  const refreshCartCount = async () => {
    try {
      const response = await api.get("/cart/");
      const apiItems = Array.isArray(response.data) ? response.data : [];
      const apiCount = apiItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );

      setCartCount(apiCount > 0 ? apiCount : getLocalCartCount());
    } catch {
      setCartCount(getLocalCartCount());
    }
  };

  const loadPreferenceData = async () => {
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
  };

  const detectGeoDetails = async () => {
    setIsDetectingGeo(true);
    setGeoDetectionFailed(false);
    setDetectedCountryCode("");
    setDetectedCountryName("");
    setDetectedContinent("");

    const applyGeoData = (data: any) => {
      const continentMap: Record<string, string> = {
        AF: "Africa",
        AN: "Antarctica",
        AS: "Asia",
        EU: "Europe",
        NA: "North America",
        OC: "Oceania",
        SA: "South America",
      };

      const country = data?.country || data?.country_name || "";
      const countryCode = data?.country_code || "";
      const continent =
        data?.continent ||
        continentMap[String(data?.continent_code || "").toUpperCase()] ||
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
      let browserGeo: any = null;

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

  const loadProducts = async () => {
    setLoading(true);
    setIsTopSellingView(false);
    try {
      const response = await api.get("/products/products/");
      const apiProducts = normalizeProducts(
        response.data.results || response.data,
      );
      // Use API products if available, otherwise show demo products
      setProducts(apiProducts.length > 0 ? apiProducts : DEMO_PRODUCTS);
    } catch (error) {
      console.error("Failed to load products:", error);
      // Fallback to demo products if API fails
      setProducts(DEMO_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  const loadTopSellingProducts = async () => {
    setLoading(true);
    setIsTopSellingView(true);
    setSearch("");

    try {
      const response = await api.get("/products/top-selling/");
      const topSellingProducts = normalizeProducts(
        response.data.results || response.data,
      );
      setProducts(topSellingProducts);
    } catch (error) {
      console.error("Failed to load top selling products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const query = search.trim();

    if (!query) {
      setIsTopSellingView(false);
      loadProducts();
      return;
    }

    setLoading(true);
    setIsTopSellingView(false);
    try {
      const response = await api.get("/products/products/", {
        params: { search: query },
      });
      const searchedProducts = normalizeProducts(
        response.data.results || response.data,
      );
      setProducts(searchedProducts);
    } catch (error) {
      console.error("Search failed:", error);

      const normalized = query.toLowerCase();
      const filtered = DEMO_PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(normalized) ||
          p.description.toLowerCase().includes(normalized) ||
          p.category.name.toLowerCase().includes(normalized),
      );
      setProducts(filtered);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product: Product, sourceElement?: HTMLElement) => {
    const addToLocalDemoCart = () => {
      const selectedProduct = products.find((item) => item.id === product.id);
      if (!selectedProduct) {
        return;
      }

      const key = "nobonir_demo_cart";
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const existingIndex = existing.findIndex(
        (item: any) => item.product.id === selectedProduct.id,
      );

      if (existingIndex >= 0) {
        existing[existingIndex].quantity += 1;
      } else {
        existing.push({
          id: selectedProduct.id,
          quantity: 1,
          isLocal: true,
          product: {
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            image: selectedProduct.image,
            stock: selectedProduct.stock,
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
        product: product.id,
        quantity: 1,
      });
      await refreshCartCount();
      return true;
    } catch (error: any) {
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
      setWishlistToast({
        type: "error",
        message: "Please login to add items to wishlist",
      });
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

      setWishlistToast({
        type: "success",
        message: "Added to wishlist",
      });
    } catch (error: any) {
      setWishlistToast({
        type: "error",
        message: error.response?.data?.detail || "Failed to add to wishlist",
      });
    }
  };

  const scrollSuggestionCarousel = (direction: "left" | "right") => {
    const carousel = suggestionCarouselRef.current;
    if (!carousel) {
      return;
    }

    const delta = Math.max(carousel.clientWidth * 0.8, 260);
    carousel.scrollBy({
      left: direction === "right" ? delta : -delta,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
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
              >
                {isMobileMenuOpen ? (
                  <X className="h-4.5 w-4.5" />
                ) : (
                  <Menu className="h-4.5 w-4.5" />
                )}
              </Button>
            </div>

            <div className="hidden w-full flex-wrap items-center justify-start gap-2 lg:flex lg:w-auto lg:justify-end lg:gap-3">
              {isAuthenticated ? (
                <>
                  <Link to="/cart">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 relative"
                      data-cart-nav="true"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={loadTopSellingProducts}
                  >
                    <Trophy className="h-4 w-4" />
                    <span className="hidden sm:inline">Top Selling</span>
                  </Button>
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                      data-user-menu-trigger="true"
                      className="flex items-center gap-2 rounded-full border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 px-3 py-2 transition-colors hover:from-teal-100 hover:to-cyan-100 dark:border-slate-700 dark:bg-gradient-to-r dark:from-slate-800 dark:to-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-600"
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
                      <span className="max-w-24 truncate text-sm font-medium text-slate-700 dark:text-slate-100">
                        {user?.first_name || "Profile"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </button>

                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-52 rounded-xl border bg-white shadow-lg p-2 z-50">
                        <Link
                          to="/profile"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <User className="h-4 w-4" />
                          My Profile
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Package className="h-4 w-4" />
                          Orders
                        </Link>
                        <Link
                          to="/wishlist"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
                      className="gap-2 relative"
                      data-cart-nav="true"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="hidden sm:inline">Cart</span>
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={loadTopSellingProducts}
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
                    <Button
                      size="sm"
                      className="gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900 lg:hidden">
              <div className="grid grid-cols-2 gap-2">
                <Link to="/cart" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
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
                    loadTopSellingProducts();
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
                        className="w-full justify-start"
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
                        className="w-full justify-start"
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
                        className="w-full justify-start"
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
                        className="w-full justify-start"
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                      </Button>
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button
                        size="sm"
                        className="w-full justify-start bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative mb-8 overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 py-12 text-white sm:py-16">
        {/* Animated Background Circles */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="mb-5 flex items-center justify-center gap-2 sm:mb-6 sm:gap-3">
              <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse sm:h-10 sm:w-10" />
              <h2 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent drop-shadow-lg">
                  Discover
                </span>
              </h2>
              <Sparkles className="h-8 w-8 text-yellow-300 animate-pulse sm:h-10 sm:w-10" />
            </div>
            <p className="mb-8 text-lg font-light tracking-wide text-white/95 sm:text-2xl">
              Find exactly what you need with intelligent search
            </p>

            {/* Enhanced Search */}
            <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1 group">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-300 rounded-2xl"></div>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                <Input
                  type="text"
                  placeholder="Try 'wireless headphones' or 'summer dress'..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="relative h-14 rounded-2xl border-0 bg-white/98 pl-12 text-base font-medium text-gray-900 caret-teal-600 placeholder:text-gray-500 shadow-2xl backdrop-blur-md focus-visible:ring-2 focus-visible:ring-white/50 sm:text-lg"
                />
              </div>
              <Button
                onClick={handleSearch}
                size="lg"
                className="h-14 bg-slate-950 px-8 font-bold text-teal-400 shadow-2xl transition-all hover:scale-105 hover:bg-slate-900 hover:shadow-xl dark:bg-slate-100 dark:text-teal-700 dark:hover:bg-white"
              >
                <Sparkles className="mr-2 h-5 w-5 text-yellow-500" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {isAuthenticated && (
          <section className="mb-10 rounded-2xl border bg-white/85 p-6 shadow-lg backdrop-blur-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-lg font-bold text-gray-900">
                Exclusive Suggestions for You
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={suggestionGender === "male" ? "default" : "outline"}
                  onClick={() => setSuggestionGender("male")}
                >
                  Male
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    suggestionGender === "female" ? "default" : "outline"
                  }
                  onClick={() => setSuggestionGender("female")}
                >
                  Female
                </Button>
                {isAutoPersonalizing && (
                  <span className="text-xs font-semibold text-teal-700">
                    Refreshing...
                  </span>
                )}
              </div>
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
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Preparing your personalized picks...
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                No suggestions in this category yet. Try another category.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => scrollSuggestionCarousel("left")}
                    aria-label="Previous suggestions"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => scrollSuggestionCarousel("right")}
                    aria-label="Next suggestions"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div
                  ref={suggestionCarouselRef}
                  className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
                >
                  {visibleSuggestions.map((product) => (
                    <Card
                      key={`pref-${product.id}`}
                      className="border shadow-sm"
                    >
                      <CardHeader className="p-0 min-w-[240px] snap-start sm:min-w-[260px] lg:min-w-[280px]">
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
                        <p className="line-clamp-1 font-semibold text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.category.name}
                        </p>
                        <p className="text-sm font-bold text-teal-700">
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
              </div>
            )}
          </section>
        )}

        {/* Products */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              {/* Multiple spinning rings */}
              <div className="h-24 w-24 rounded-full border-4 border-gray-200/50"></div>
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
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-400 to-cyan-500 blur-2xl opacity-20 rounded-full"></div>
              <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 p-10 rounded-full shadow-xl">
                <ShoppingBag className="h-24 w-24 text-gray-400" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-3">
              No Products Found
            </h3>
            <p className="text-gray-600 mb-8 text-center max-w-md text-lg">
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
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 sm:text-3xl">
                  {search
                    ? "🔍 Search Results"
                    : isTopSellingView
                      ? "🏆 Top Selling Products"
                      : "✨ All Products"}
                </h3>
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  Found {products.length}{" "}
                  {products.length === 1
                    ? "amazing product"
                    : "amazing products"}
                </p>
              </div>
              {(search || isTopSellingView) && (
                <Button
                  onClick={() => {
                    setIsTopSellingView(false);
                    setSearch("");
                    loadProducts();
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
                  className="group relative overflow-hidden rounded-2xl border-0 bg-white shadow-lg transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl dark:bg-slate-900"
                >
                  {/* Hover Gradient Border Effect */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl -z-10"
                    style={{ padding: "2px" }}
                  ></div>

                  <CardHeader className="p-0">
                    <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
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
                          className="bg-white/95 backdrop-blur-md text-gray-700 gap-1.5 shadow-lg font-semibold"
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
                  <CardContent className="bg-gradient-to-br from-white to-gray-50 p-5 dark:from-slate-900 dark:to-slate-900 sm:p-6">
                    <CardTitle className="mb-2 line-clamp-1 text-base font-bold text-slate-900 transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-teal-600 group-hover:to-cyan-600 group-hover:bg-clip-text group-hover:text-transparent dark:text-slate-100 sm:text-lg">
                      {product.name}
                    </CardTitle>
                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {product.description}
                    </p>
                    <div className="mb-5 flex items-baseline justify-between">
                      <p className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 bg-clip-text text-2xl font-black text-transparent drop-shadow-sm sm:text-3xl">
                        {formatPrice(product.price)}
                      </p>
                      <Badge
                        variant={
                          product.stock > 10
                            ? "default"
                            : product.stock > 0
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs font-bold shadow-sm"
                      >
                        {product.stock > 0 ? `${product.stock} left` : "Out"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={(e) => addToCart(product, e.currentTarget)}
                        className="w-full bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-600 hover:via-cyan-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-semibold"
                        disabled={product.stock === 0}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {product.stock === 0 ? "Unavailable" : "Add to Cart"}
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
          </>
        )}
      </main>

      {wishlistToast && (
        <div className="fixed right-4 top-20 z-[60]">
          <div
            className={`rounded-xl px-4 py-3 shadow-xl border text-sm font-medium backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 ${
              wishlistToast.type === "success"
                ? "bg-emerald-50/95 text-emerald-800 border-emerald-200"
                : "bg-rose-50/95 text-rose-800 border-rose-200"
            }`}
          >
            {wishlistToast.message}
          </div>
        </div>
      )}

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
