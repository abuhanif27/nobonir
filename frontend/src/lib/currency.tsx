import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

type CurrencyContextValue = {
  countryCode: string;
  currencyCode: string;
  formatPrice: (amount: string | number) => string;
  isCurrencyLoading: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined,
);

const BASE_CURRENCY = "USD";
const RATE_REFRESH_MS = 5 * 60 * 1000;
const GEO_REFRESH_MS = 5 * 60 * 1000;
const CURRENCY_STORAGE_KEY = "nobonir_currency_context_v1";

type PersistedCurrencyState = {
  countryCode: string;
  currencyCode: string;
  rates: Record<string, number>;
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

    const normalizeCountryCode = (data: any) =>
      String(data?.country_code || data?.countryCode || "").toUpperCase();

    const resolveCountryCode = async () => {
      try {
        const response = await fetch("https://ipwho.is/", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.success) {
            const code = normalizeCountryCode(data);
            if (code) {
              return code;
            }
          }
        }
      } catch {
        // Continue to next fallback
      }

      try {
        const response = await fetch("https://ipapi.co/json/", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          const code = normalizeCountryCode(data);
          if (code) {
            return code;
          }
        }
      } catch {
        // Continue to backend lookups
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
        if (code) {
          return code;
        }
      } catch {
        // Continue to backend fallback
      }

      try {
        const response = await api.get("/ai/geo-detect/", {
          params: { _ts: Date.now() },
        });
        const code = normalizeCountryCode(response.data);
        if (code) {
          return code;
        }
      } catch {
        // Final fallback happens below
      }

      return "";
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
        const nextCountry = await resolveCountryCode();

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
              } else {
                setCurrencyCode(REGION_FALLBACK_CURRENCY[nextCountry] || "USD");
              }
            } else {
              setCurrencyCode(REGION_FALLBACK_CURRENCY[nextCountry] || "USD");
            }
          } catch {
            setCurrencyCode(REGION_FALLBACK_CURRENCY[nextCountry] || "USD");
          }
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

  const formatPrice = (amount: string | number) => {
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
  };

  const value = useMemo(
    () => ({ countryCode, currencyCode, formatPrice, isCurrencyLoading }),
    [countryCode, currencyCode, isCurrencyLoading, rates],
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
