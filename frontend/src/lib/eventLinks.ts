import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

/**
 * Operator referral links for the organizer dashboard.
 *
 * When an operator (not the organizer owner) is logged in and their
 * referral code is switched on, every EVENT link they copy / share from the
 * dashboard carries `?ref=CODE` so bookings made through it are credited to
 * them in Participants. Only event links — scanner, feedback, supplier, stall
 * pay and storefront links stay untouched.
 */

// One lookup per token string, reused for a short while. It expires so a code
// the organizer regenerates / switches on or off reaches an open session
// without a re-login.
const REFERRAL_CACHE_TTL_MS = 2 * 60 * 1000;
const referralCodeCache = new Map<
  string,
  { lookup: Promise<string | null>; fetchedAt: number }
>();

export function getOperatorReferralCode(): Promise<string | null> {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem("token");
  } catch {
    return Promise.resolve(null);
  }
  if (!token) return Promise.resolve(null);

  let operatorId = "";
  try {
    const decoded: any = jwtDecode(token);
    operatorId = decoded?.operatorId ? String(decoded.operatorId) : "";
  } catch {
    return Promise.resolve(null);
  }
  // Organizer owners have no operatorId — their links stay unchanged.
  if (!operatorId) return Promise.resolve(null);

  const cached = referralCodeCache.get(token);
  if (cached && Date.now() - cached.fetchedAt < REFERRAL_CACHE_TTL_MS) {
    return cached.lookup;
  }

  const authToken = token;
  const lookup = (async () => {
    try {
      const res = await fetch(`${__API_URL__}/operators/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const data = result?.data;
      return data?.referralEnabled && data?.referralCode
        ? String(data.referralCode)
        : null;
    } catch {
      // Don't cache a failed lookup — the next share retries.
      referralCodeCache.delete(authToken);
      return null;
    }
  })();
  referralCodeCache.set(token, { lookup, fetchedAt: Date.now() });
  return lookup;
}

/**
 * Sets `ref` on an event URL, keeping every other query param and the hash.
 * Returns the URL unchanged when there's no code or it can't be parsed.
 * Root-relative paths ("/org/events/id") stay relative.
 */
export function withOperatorRef(
  url: string,
  code: string | null | undefined,
): string {
  if (!code || !url) return url;
  try {
    const isRelative = url.startsWith("/") && !url.startsWith("//");
    const parsed = isRelative
      ? new URL(url, "http://relative.invalid")
      : new URL(url);
    parsed.searchParams.set("ref", code);
    return isRelative
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return url;
  }
}

/**
 * The logged-in operator's referral code: `undefined` while the first lookup
 * is still in flight, then the code, or null for owners / when it's off.
 * Refreshed when the tab regains focus (the lookup cache expires after a
 * couple of minutes), so settings changed elsewhere are picked up.
 */
export function useOperatorReferralCode(): string | null | undefined {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      getOperatorReferralCode().then((c) => {
        if (active) setCode(c);
      });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return code;
}
