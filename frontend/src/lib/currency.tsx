import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "@/lib/api";

type CurrencyContextValue = {
  countryCode: string;
  currencyCode: string;
  currencyRate: number;
  formatPrice: (amount: string | number) => string;
  isCurrencyLoading: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined,
);

const BASE_CURRENCY = "USD";
const RATE_REFRESH_MS = 30 * 60 * 1000; // 30 minutes
const GEO_REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours
const CURRENCY_STORAGE_KEY = "nobonir_currency_context_v1";

type PersistedCurrencyState = {
  countryCode: string;
  currencyCode: string;
  rates: Record<string, number>;
};

type GeoResolution = {
  countryCode: string;
  currencyCode: string;
};

const REGION_FALLBACK_CURRENCY: Record<string, string> = {
  BD: "BDT",
  US: "USD",
  IN: "INR",
  PK: "PKR",
  NP: "NPR",
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  JP: "JPY",
  CN: "CNY",
  CA: "CAD",
  AU: "AUD",
  AE: "AED",
  SA: "SAR",
};

const toNumber = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRegionFromLocale = () => {
  const language = navigator.language || "en-US";
  const parts = language.split("-");
  return (parts[1] || "US").toUpperCase();
};

const getFallbackCurrencyFromLocale = () => {
  const region = getRegionFromLocale();
  return REGION_FALLBACK_CURRENCY[region] || "USD";
};

const getPersistedCurrencyState = (): PersistedCurrencyState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const persistedCountryCode = String(
      parsed?.countryCode || "",
    ).toUpperCase();
    const persistedCurrencyCode = String(
      parsed?.currencyCode || "",
    ).toUpperCase();
    const persistedRates = parsed?.rates;

    if (!persistedCurrencyCode || typeof persistedRates !== "object") {
      return null;
    }

    return {
      countryCode: persistedCountryCode,
      currencyCode: persistedCurrencyCode,
      rates: { ...persistedRates, [BASE_CURRENCY]: 1 },
    };
  } catch {
    return null;
  }
};

const persistCurrencyState = (state: PersistedCurrencyState) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const persisted = getPersistedCurrencyState();
  const [countryCode, setCountryCode] = useState(persisted?.countryCode || "");
  const [currencyCode, setCurrencyCode] = useState(
    persisted?.currencyCode || "",
  );
  const [rates, setRates] = useState<Record<string, number>>(
    persisted?.rates || { USD: 1 },
  );
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(
    !persisted?.currencyCode,
  );

  useEffect(() => {
    let isMounted = true;

    const getPublicIp = async () => {
      try {
        const response = await fetch("https://api64.ipify.org?format=json");
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
        const response = await fetch("https://ifconfig.co/json");
        if (response.ok) {
          const data = await response.json();
          if (data?.ip) {
            return String(data.ip);
          }
        }
      } catch {
        // Continue without explicit public ip
      }

      return "";
    };

    const normalizeCountryCode = (data: unknown) => {
      if (!data || typeof data !== "object") {
        return "";
      }
      const payload = data as { country_code?: unknown; countryCode?: unknown };
      return String(
        payload.country_code || payload.countryCode || "",
      ).toUpperCase();
    };

    const normalizeCurrencyCode = (data: unknown) => {
      if (!data || typeof data !== "object") {
        return "";
      }
      const payload = data as {
        currency_code?: unknown;
        currencyCode?: unknown;
        currency?: unknown;
      };
      const currencyObj =
        payload.currency && typeof payload.currency === "object"
          ? (payload.currency as { code?: unknown })
          : undefined;

      return String(
        payload.currency_code ||
          payload.currencyCode ||
          currencyObj?.code ||
          payload.currency ||
          "",
      ).toUpperCase();
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

    const resolveGeoContext = async (): Promise<GeoResolution> => {
      try {
        const response = await fetchWithTimeout("https://ipwho.is/", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.success) {
            const code = normalizeCountryCode(data);
            const currency = normalizeCurrencyCode(data);
            if (code || currency) {
              return { countryCode: code, currencyCode: currency };
            }
          }
        }
      } catch {
        // Silent fallback
      }

      try {
        const publicIp = await getPublicIp();
        const response = await api.get("/ai/geo-detect/", {
          params: {
            ...(publicIp ? { ip: publicIp } : {}),
            _ts: Date.now(),
          },
        });
        const code = normalizeCountryCode(response.data);
        const currency = normalizeCurrencyCode(response.data);
        if (code || currency) {
          return { countryCode: code, currencyCode: currency };
        }
      } catch {
        // Continue to backend fallback
      }

      try {
        // ipapi.co is frequently blocked or rate-limited; use a short timeout
        const response = await fetchWithTimeout(
          "https://ipapi.co/json/",
          { cache: "no-store" },
          2000,
        );
        if (response.ok) {
          const data = await response.json();
          const code = normalizeCountryCode(data);
          const currency = normalizeCurrencyCode(data);
          if (code || currency) {
            return { countryCode: code, currencyCode: currency };
          }
        }
      } catch {
        // Silent fallback
      }

      try {
        const response = await api.get("/ai/geo-detect/", {
          params: { _ts: Date.now() },
        });
        const code = normalizeCountryCode(response.data);
        const currency = normalizeCurrencyCode(response.data);
        if (code || currency) {
          return { countryCode: code, currencyCode: currency };
        }
      } catch {
        // Final fallback happens below
      }

      return { countryCode: "", currencyCode: "" };
    };

    const fetchRates = async () => {
      try {
        const response = await fetch(
          `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`,
        );
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        if (data?.rates && typeof data.rates === "object") {
          setRates({ ...data.rates, [BASE_CURRENCY]: 1 });
        }
      } catch {
        // Keep previous rates if rate service is unavailable
      }
    };

    const fetchGeoAndCurrency = async () => {
      try {
        const geo = await resolveGeoContext();
        const nextCountry = geo.countryCode;
        const nextCurrency = geo.currencyCode;

        if (!isMounted) {
          return;
        }

        if (nextCountry) {
          setCountryCode(nextCountry);

          try {
            const countryResponse = await fetch(
              `https://restcountries.com/v3.1/alpha/${nextCountry}?fields=currencies`,
            );
            if (countryResponse.ok) {
              const countryData = await countryResponse.json();
              const currencies = Array.isArray(countryData)
                ? countryData[0]?.currencies
                : countryData?.currencies;

              const firstCurrency = currencies
                ? Object.keys(currencies)[0]
                : undefined;

              if (firstCurrency) {
                setCurrencyCode(firstCurrency.toUpperCase());
              } else if (nextCurrency) {
                setCurrencyCode(nextCurrency);
              } else {
                setCurrencyCode(REGION_FALLBACK_CURRENCY[nextCountry] || "USD");
              }
            } else {
              if (nextCurrency) {
                setCurrencyCode(nextCurrency);
              } else {
                setCurrencyCode(REGION_FALLBACK_CURRENCY[nextCountry] || "USD");
              }
            }
          } catch {
            if (nextCurrency) {
              setCurrencyCode(nextCurrency);
            } else {
              setCurrencyCode(REGION_FALLBACK_CURRENCY[nextCountry] || "USD");
            }
          }
        } else if (nextCurrency) {
          setCurrencyCode(nextCurrency);
        } else {
          setCurrencyCode(getFallbackCurrencyFromLocale());
        }
      } catch {
        // Keep locale-based fallback if geo is unavailable
        setCurrencyCode(getFallbackCurrencyFromLocale());
      }
    };

    const bootstrapCurrency = async () => {
      await Promise.allSettled([fetchRates(), fetchGeoAndCurrency()]);

      if (isMounted) {
        setIsCurrencyLoading(false);
      }
    };

    bootstrapCurrency();

    const ratesTimer = window.setInterval(fetchRates, RATE_REFRESH_MS);
    const geoTimer = window.setInterval(fetchGeoAndCurrency, GEO_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(ratesTimer);
      window.clearInterval(geoTimer);
    };
  }, []);

  useEffect(() => {
    if (!currencyCode) {
      return;
    }

    persistCurrencyState({ countryCode, currencyCode, rates });
  }, [countryCode, currencyCode, rates]);

  const formatPrice = useCallback(
    (amount: string | number) => {
      if (!currencyCode) {
        return "…";
      }

      const numeric = toNumber(amount);
      const rate = rates[currencyCode] || 1;
      const converted = numeric * rate;

      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currencyCode,
          maximumFractionDigits: converted >= 1000 ? 0 : 2,
        }).format(converted);
      } catch {
        return `${currencyCode} ${converted.toFixed(2)}`;
      }
    },
    [currencyCode, rates],
  );

  const currencyRate = useMemo(() => {
    if (!currencyCode) {
      return 1;
    }
    return rates[currencyCode] || 1;
  }, [currencyCode, rates]);

  const value = useMemo(
    () => ({
      countryCode,
      currencyCode,
      currencyRate,
      formatPrice,
      isCurrencyLoading,
    }),
    [countryCode, currencyCode, currencyRate, formatPrice, isCurrencyLoading],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }

  return context;
}
