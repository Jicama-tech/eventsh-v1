// Timeline entries flagged `internal` are for the organizer's team only (for
// example "referral changed by ..."). Anything a visitor, vendor or speaker
// can see must go through this first.
export const visibleHistory = <T extends { internal?: boolean }>(
  history: T[] | null | undefined,
): T[] => (history || []).filter((entry) => !entry?.internal);
