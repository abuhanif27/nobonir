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

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [countryCode, setCountryCode] = useState("");
  const [currencyCode, setCurrencyCode] = useState(
    getFallbackCurrencyFromLocale,
  );
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

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
        const geoResponse = await api.get("/ai/geo-detect/");
        const nextCountry = String(
          geoResponse.data?.country_code || "",
        ).toUpperCase();

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
        }
      } catch {
        // Keep locale-based fallback if geo is unavailable
      } finally {
        if (isMounted) {
          setIsCurrencyLoading(false);
        }
      }
    };

    fetchRates();
    fetchGeoAndCurrency();

    const ratesTimer = window.setInterval(fetchRates, RATE_REFRESH_MS);
    const geoTimer = window.setInterval(fetchGeoAndCurrency, GEO_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(ratesTimer);
      window.clearInterval(geoTimer);
    };
  }, []);

  const formatPrice = (amount: string | number) => {
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
