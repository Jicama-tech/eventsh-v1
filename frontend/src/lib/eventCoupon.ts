/**
 * Shared coupon links for public event pages.
 *
 * When an organizer shares a coupon from the dashboard, the link is the
 * event's own eventfront URL with `?coupon=CODE`. EventFront captures the
 * code here, per event, and the ticket / stall checkout pre-fills its coupon
 * field from it. The server still validates the coupon on apply — this file
 * only remembers the code.
 *
 * Last link wins; entries expire after 30 days. Storage can be unavailable
 * (private mode, blocked site data), so every access is wrapped.
 */
const KEY_PREFIX = "eventsh:coupon:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

interface StoredCoupon {
  code: string;
  capturedAt: number;
}

export function normalizeCouponCode(code: string | null | undefined): string {
  return String(code || "")
    .trim()
    .toUpperCase();
}

/** Stores `code` under every non-empty key (event id, slug, route param). */
export function captureEventCoupon(keys: string[], code: string): void {
  const normalized = normalizeCouponCode(code);
  if (!CODE_PATTERN.test(normalized)) return;
  const value: StoredCoupon = { code: normalized, capturedAt: Date.now() };
  for (const key of keys) {
    if (!key) continue;
    try {
      localStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // storage unavailable — the visitor can still type the code
    }
  }
}

/** Returns the first non-expired stored coupon for any of the given ids/slugs. */
export function getEventCoupon(
  ...idsOrSlugs: (string | undefined | null)[]
): string | null {
  for (const key of idsOrSlugs) {
    if (!key) continue;
    const storageKey = `${KEY_PREFIX}${key}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<StoredCoupon> | null;
      const code = normalizeCouponCode(parsed?.code);
      const capturedAt = Number(parsed?.capturedAt);
      if (
        !CODE_PATTERN.test(code) ||
        !Number.isFinite(capturedAt) ||
        Date.now() - capturedAt > TTL_MS
      ) {
        localStorage.removeItem(storageKey);
        continue;
      }
      return code;
    } catch {
      // unreadable entry or storage unavailable — try the next key
    }
  }
  return null;
}

/** Forgets a stored coupon once it has been applied (or rejected). */
export function clearEventCoupon(
  ...idsOrSlugs: (string | undefined | null)[]
): void {
  for (const key of idsOrSlugs) {
    if (!key) continue;
    try {
      localStorage.removeItem(`${KEY_PREFIX}${key}`);
    } catch {
      // ignore
    }
  }
}

/**
 * Sets `coupon` on an event URL, keeping every other query param and the
 * hash. Root-relative paths stay relative.
 */
export function withCouponCode(
  url: string,
  code: string | null | undefined,
): string {
  const normalized = normalizeCouponCode(code);
  if (!normalized || !url) return url;
  try {
    const isRelative = url.startsWith("/") && !url.startsWith("//");
    const parsed = isRelative
      ? new URL(url, "http://relative.invalid")
      : new URL(url);
    parsed.searchParams.set("coupon", normalized);
    return isRelative
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : parsed.toString();
  } catch {
    return url;
  }
}
