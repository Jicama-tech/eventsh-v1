// Proration math for mid-cycle add-on purchases. Add-ons are CO-TERMINUS
// with the plan: bought mid-cycle they're charged pro-rata for the days left
// and expire on the organizer's planExpiryDate — so every organizer keeps a
// single renewal date. At renewal, add-ons are re-bought at full price.

const DAY_MS = 24 * 60 * 60 * 1000;

// Below this many remaining days, add-on purchase is blocked — the prorated
// amount would be too small to be worth pushing through the manual
// QR-and-admin-verify payment flow. Organizers renew the plan instead.
export const MIN_ADDON_REMAINING_DAYS = 15;

export interface AddOnProration {
  /** Full length of the organizer's current cycle, in days. */
  cycleDays: number;
  /** Days left from `now` to plan expiry (what the buyer actually gets). */
  remainingDays: number;
  /** Full-cycle price the proration was derived from. */
  fullPrice: number;
  /** What to charge now: fullPrice × remainingDays / cycleDays, 2dp. */
  proratedPrice: number;
}

/**
 * Compute the prorated charge for buying an add-on `now`, given the
 * organizer's current cycle [planStartDate, planExpiryDate].
 * Day counts use ceil so a partial day counts in the buyer's favour for
 * access (remainingDays) and never produces a zero-length cycle.
 * Buying on day one yields remainingDays === cycleDays → full price.
 */
export function computeAddOnProration(
  fullPrice: number,
  planStartDate: Date | string,
  planExpiryDate: Date | string,
  now: Date = new Date(),
): AddOnProration {
  const start = new Date(planStartDate).getTime();
  const expiry = new Date(planExpiryDate).getTime();
  const at = now.getTime();

  const cycleDays = Math.max(1, Math.ceil((expiry - start) / DAY_MS));
  // Clamp into [0, cycleDays] — a purchase processed moments after activation
  // must never exceed full price, and a lapsed plan yields 0 remaining days.
  const remainingDays = Math.min(
    cycleDays,
    Math.max(0, Math.ceil((expiry - at) / DAY_MS)),
  );

  const raw = Number(fullPrice || 0) * (remainingDays / cycleDays);
  const proratedPrice = Math.round(raw * 100) / 100;

  return {
    cycleDays,
    remainingDays,
    fullPrice: Number(fullPrice || 0),
    proratedPrice,
  };
}
