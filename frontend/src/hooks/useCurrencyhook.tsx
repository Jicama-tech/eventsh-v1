// hooks/useCurrency.ts
import { useMemo } from "react";
import {
  COUNTRY_CURRENCY,
  FALLBACK_CURRENCY,
  toIso2,
  type CurrencyConfig,
} from "@/data/currencies";

// Cart-side cache key. Mirrors what ticketCart.tsx writes whenever it
// resolves an organizer's country. When `country` arrives empty (e.g.
// briefly after the buyer's Google sign-in redirect, before the
// organizer fetch resolves on the remounted cart), fall back to this
// cache so we keep the previous currency instead of flashing to USD.
const CART_COUNTRY_CACHE_KEY = "cart:country";

const configFor = (country: string | undefined | null): CurrencyConfig | null => {
  const iso2 = toIso2(country);
  return iso2 ? COUNTRY_CURRENCY[iso2] : null;
};

export const useCurrency = (country: string) => {
  const config = useMemo(() => {
    const direct = configFor(country);
    if (direct) return direct;
    // No usable country was passed in. Peek at the cart cache before
    // falling through to USD so the post-Google-redirect render keeps
    // the organizer's currency (SG$, etc.) seamlessly.
    if (typeof window !== "undefined") {
      try {
        const cached = configFor(sessionStorage.getItem(CART_COUNTRY_CACHE_KEY));
        if (cached) return cached;
      } catch {
        // sessionStorage blocked (rare) — fall through.
      }
    }
    return FALLBACK_CURRENCY;
  }, [country]);

  const formatPrice = (amount: number): string => {
    // Format just the number with the locale's grouping/decimal rules, then
    // prepend our explicit symbol. Using style:"currency" would let the
    // browser swap in its own locale-default symbol (e.g. en-SG renders
    // SGD as "$"), which is exactly what we're trying to avoid.
    const num = new Intl.NumberFormat(config.locale, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${config.symbol}${num}`;
  };

  const getSymbol = (): string => config.symbol;

  return { formatPrice, getSymbol, config };
};
