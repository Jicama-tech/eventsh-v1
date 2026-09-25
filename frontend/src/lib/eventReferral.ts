/**
 * Operator referral attribution for public event pages.
 *
 * When an operator shares an event link from the dashboard it carries
 * `?ref=CODE`. EventFront captures that code here, per event, so any booking
 * the visitor makes afterwards (tickets, stalls, speaker requests, round
 * tables, workshops, scheduled spaces) can send it along. The server decides
 * whether the code is valid — this file only remembers it.
 *
 * Last link wins: a newer `?ref` overwrites the stored one. Entries expire
 * after 30 days. Storage can be unavailable (private mode, blocked site
 * data), so every access is wrapped and failures are silently ignored.
 */
const KEY_PREFIX = "eventsh:ref:";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

interface StoredReferral {
  code: string;
  capturedAt: number;
}

/** Stores `code` under every non-empty key (event id, slug, route param). */
export function captureEventReferral(keys: string[], code: string): void {
  const normalized = String(code || "").trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) return;
  const value: StoredReferral = { code: normalized, capturedAt: Date.now() };
  for (const key of keys) {
    if (!key) continue;
    try {
      localStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(value));
    } catch {
      // storage unavailable — attribution is best-effort
    }
  }
}

/** Returns the first non-expired stored code for any of the given ids/slugs. */
export function getEventReferral(
  ...idsOrSlugs: (string | undefined | null)[]
): string | null {
  for (const key of idsOrSlugs) {
    if (!key) continue;
    const storageKey = `${KEY_PREFIX}${key}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<StoredReferral> | null;
      const code = String(parsed?.code || "").toUpperCase();
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

/**
 * Normalises a code the visitor typed into a booking form. Returns the
 * upper-cased code when it looks like one, otherwise null (an empty field is
 * "no code", not an error — the server decides whether one is required).
 */
export function normalizeReferralInput(
  value: string | null | undefined,
): string | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return CODE_PATTERN.test(normalized) ? normalized : null;
}

/** True when the visitor typed something that can't be a referral code. */
export function isMalformedReferralInput(
  value: string | null | undefined,
): boolean {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 && !CODE_PATTERN.test(trimmed.toUpperCase());
}
