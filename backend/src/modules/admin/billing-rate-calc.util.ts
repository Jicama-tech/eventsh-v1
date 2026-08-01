import { toIso2, currencyForCountry } from "../../common/currency.util";

export type RateMode = "flat" | "percent";

// Just 2 shared rates: moneyIn applies uniformly to every "money coming
// into the organizer" category (tickets, stalls, speakers, sponsors,
// round tables, chairs, workshops, memberships); moneyOut applies to
// "money the organizer pays out" (suppliers). No per-category rates.
export interface EffectiveBillingRates {
  moneyInRate: number;
  moneyInRateMode: RateMode;
  moneyOutRate: number;
  moneyOutRateMode: RateMode;
  currency: string;
}

const DEFAULT_FALLBACK = {
  moneyInRate: 20,
  moneyOutRate: 20,
  currency: "USD",
};

const toMode = (m: any): RateMode => (m === "percent" ? "percent" : "flat");

function resolveCategory(
  overrideRate: any,
  overrideMode: any,
  globalRate: any,
  globalMode: any,
  fallbackRate: number,
): { rate: number; mode: RateMode } {
  // An override only "wins" for a category when its rate is actually set —
  // a category left blank on the organizer's override doc inherits both
  // the platform's rate AND its flat/percent mode.
  if (overrideRate !== undefined && overrideRate !== null) {
    return { rate: Number(overrideRate) || 0, mode: toMode(overrideMode) };
  }
  return {
    rate: globalRate !== undefined && globalRate !== null
      ? Number(globalRate) || 0
      : fallbackRate,
    mode: toMode(globalMode),
  };
}

/**
 * Builds a fresh plan payload for a country (or the null fallback),
 * seeded with the hardcoded defaults and that country's own currency.
 * Used both to auto-seed the built-in SG/IN plans and to create a new
 * plan when an admin adds another country.
 */
export function defaultPlanForCountry(countryCode: string | null) {
  return {
    countryCode,
    moneyInRate: DEFAULT_FALLBACK.moneyInRate,
    moneyInRateMode: "flat" as RateMode,
    moneyOutRate: DEFAULT_FALLBACK.moneyOutRate,
    moneyOutRateMode: "flat" as RateMode,
    currency: countryCode
      ? currencyForCountry(countryCode).code
      : DEFAULT_FALLBACK.currency,
  };
}

/**
 * Picks the right billing-rate plan for a country: the plan whose
 * countryCode matches (ISO-2, any stored form normalized via toIso2),
 * else the fallback plan (countryCode: null), else the hardcoded
 * defaults if neither is persisted yet. Callers pass the result as the
 * `globalDoc` into resolveEffectiveRates.
 */
export function resolvePlanForCountry(
  plans: any[] | null | undefined,
  country: string | null | undefined,
): any {
  const list = plans || [];
  const iso2 = toIso2(country);
  const match = iso2 ? list.find((p) => p?.countryCode === iso2) : undefined;
  if (match) return match;
  const fallback = list.find((p) => p?.countryCode == null);
  if (fallback) return fallback;
  return { ...DEFAULT_FALLBACK, countryCode: null };
}

/**
 * Merges the platform-wide default rates with an organizer's optional
 * per-direction overrides. Called by billing-payments.service.ts and
 * admin.service.ts so both surfaces bill identically.
 */
export function resolveEffectiveRates(
  globalDoc: any,
  overrideDoc: any | null | undefined,
): EffectiveBillingRates {
  const g = globalDoc || {};
  const o = overrideDoc || {};

  const moneyIn = resolveCategory(
    o.moneyInRate, o.moneyInRateMode, g.moneyInRate, g.moneyInRateMode,
    DEFAULT_FALLBACK.moneyInRate,
  );
  const moneyOut = resolveCategory(
    o.moneyOutRate, o.moneyOutRateMode, g.moneyOutRate, g.moneyOutRateMode,
    DEFAULT_FALLBACK.moneyOutRate,
  );

  return {
    moneyInRate: moneyIn.rate,
    moneyInRateMode: moneyIn.mode,
    moneyOutRate: moneyOut.rate,
    moneyOutRateMode: moneyOut.mode,
    currency: g.currency || DEFAULT_FALLBACK.currency,
  };
}

/** True if the organizer's override doc customizes Money In or Money Out. */
export function hasAnyOverride(overrideDoc: any | null | undefined): boolean {
  if (!overrideDoc) return false;
  return overrideDoc.moneyInRate != null || overrideDoc.moneyOutRate != null;
}

/**
 * Bills one category: flat mode is count × rate (today's behavior);
 * percent mode sums each item's own price and applies rate% to that sum.
 * `items` should already be filtered down to the billable set (e.g. only
 * booked stalls, only confirmed speakers). The same rate/mode (moneyIn or
 * moneyOut) is passed in by the caller for every category on that side.
 */
export function billForCategory<T>(
  items: T[],
  rate: number,
  mode: RateMode | string | undefined,
  priceOf: (item: T) => number,
): number {
  const r = Number(rate) || 0;
  if (toMode(mode) === "percent") {
    const base = items.reduce((sum, it) => sum + (Number(priceOf(it)) || 0), 0);
    return base * (r / 100);
  }
  return items.length * r;
}
