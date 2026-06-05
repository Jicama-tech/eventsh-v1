// Shared helpers so every place that activates a plan derives the expiry the
// same way, whether the plan is day-based ("valid for N days") or date-based
// ("valid up to this date").

const DAY_MS = 24 * 60 * 60 * 1000;

type PlanLike = {
  validityType?: string;
  validityInDays?: number | null;
  validUntil?: Date | string | null;
};

/**
 * Resolve when a plan should expire given when it's activated.
 *  - validityType "date": returns validUntil (fixed calendar date).
 *  - otherwise (default "days"): activation date + validityInDays.
 */
export function computePlanExpiry(
  plan: PlanLike,
  startDate: Date = new Date(),
): Date {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  if (plan?.validityType === "date" && plan?.validUntil) {
    return new Date(plan.validUntil);
  }
  const days = Number(plan?.validityInDays) || 0;
  return new Date(start.getTime() + days * DAY_MS);
}

/**
 * Human-readable validity for receipts / emails, e.g. "365 days" or
 * "until 31 Dec 2026".
 */
export function formatPlanValidity(plan: PlanLike): string {
  if (plan?.validityType === "date" && plan?.validUntil) {
    const d = new Date(plan.validUntil);
    return `until ${d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  }
  const days = Number(plan?.validityInDays) || 0;
  return `${days} days`;
}
