// hooks/useCurrency.ts
import { useMemo } from "react";

interface CurrencyConfig {
  symbol: string;
  code: string;
  locale: string;
}

const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  IN: { symbol: "₹", code: "INR", locale: "en-IN" },
  // SG$ (not the browser-locale default "S$"/"$") — the product wants the
  // currency to read unambiguously as Singapore dollars everywhere.
  SG: { symbol: "SG$", code: "SGD", locale: "en-SG" },
};

// The backend stores organizer.country inconsistently — sometimes the ISO-2
// code ("SG"), sometimes the full country name ("Singapore"), sometimes the
// ISO-3 ("SGP"). subscriptions.service.ts already handles all three; mirror
// that here so non-INR organizers don't silently fall through to the rupee
// fallback below.
const COUNTRY_ALIASES: Record<string, string> = {
  IN: "IN",
  IND: "IN",
  INDIA: "IN",
  SG: "SG",
  SGP: "SG",
  SINGAPORE: "SG",
};

const normalizeCountry = (country: string | undefined | null): string => {
  if (!country) return "";
  return COUNTRY_ALIASES[String(country).trim().toUpperCase()] || "";
};

// Fallback used ONLY when an unknown / unrecognized country is supplied.
// Previously this was hard-coded to IN (₹), which surfaced as the wrong
// currency for Singapore organizers (and any non-aliased country) the
// moment the local `country` state was momentarily empty — e.g. during
// the brief window after the buyer's Google sign-in redirect before the
// organizer fetch resolves. USD is a more neutral default; the cart
// flips to the organizer's real currency as soon as setCountry fires.
const FALLBACK_CURRENCY: CurrencyConfig = {
  symbol: "$",
  code: "USD",
  locale: "en-US",
};

// Cart-side cache key. Mirrors what ticketCart.tsx writes whenever it
// resolves an organizer's country. When `country` arrives empty (e.g.
// briefly after the buyer's Google sign-in redirect, before the
// organizer fetch resolves on the remounted cart), fall back to this
// cache so we keep the previous currency instead of flashing to USD.
const CART_COUNTRY_CACHE_KEY = "cart:country";

export const useCurrency = (country: string) => {
  const config = useMemo(() => {
    const direct = normalizeCountry(country);
    if (direct) return CURRENCY_CONFIG[direct];
    // No usable country was passed in. Peek at the cart cache before
    // falling through to USD so the post-Google-redirect render keeps
    // the organizer's currency (SG$, etc.) seamlessly.
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(CART_COUNTRY_CACHE_KEY);
        const cachedNorm = normalizeCountry(cached || "");
        if (cachedNorm) return CURRENCY_CONFIG[cachedNorm];
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
