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

export const useCurrency = (country: string) => {
  const config = useMemo(
    () => CURRENCY_CONFIG[normalizeCountry(country)] || CURRENCY_CONFIG["IN"],
    [country]
  );

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
