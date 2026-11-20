// Timeline entries flagged `internal` are for the organizer's team only (for
// example "referral changed by ..."). Anything a visitor, vendor or speaker
// can see must go through this first.
export const visibleHistory = <T,>(history: T[] | null | undefined): T[] =>
  (history || []).filter((entry) => !(entry as { internal?: boolean } | null)?.internal);
