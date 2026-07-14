// Canonical revenue definition for the Organizer Dashboard.
//
// Revenue = money actually COLLECTED, EXCLUDING cancelled bookings, summed
// across tickets + stalls + round-tables. Speaker fees are intentionally NOT
// included. This mirrors the backend GET /organizers/analytics/:id total
// (organizers.service.ts getAnalytics) so that every surface — Analytics tab,
// Chatbot header, My Events, Dashboard Overview, the Participants dialog and
// the per-event Analytics dialog — all show the same number.
//
// Filters (must stay in sync with the backend aggregation):
//   tickets      → paymentConfirmed === true AND status !== "cancelled"  → totalAmount
//   stalls       → paymentStatus === "Paid"  AND status !== "Cancelled"  → grandTotal
//   round-tables → paymentStatus === "Paid"                              → amount

export const isTicketRevenue = (t: any): boolean =>
  t?.paymentConfirmed === true && t?.status !== "cancelled";

export const isStallRevenue = (s: any): boolean =>
  s?.paymentStatus === "Paid" && s?.status !== "Cancelled";

export const isRoundTableRevenue = (b: any): boolean =>
  b?.paymentStatus === "Paid";

export const ticketsRevenue = (tickets: any[] = []): number =>
  (tickets || [])
    .filter(isTicketRevenue)
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

export const stallsRevenue = (stalls: any[] = []): number =>
  (stalls || [])
    .filter(isStallRevenue)
    .reduce((sum, s) => sum + (s.grandTotal || 0), 0);

export const roundTablesRevenue = (bookings: any[] = []): number =>
  (bookings || [])
    .filter(isRoundTableRevenue)
    .reduce((sum, b) => sum + (b.amount || 0), 0);

// Combined canonical revenue for one event (or any matching set) given the
// three streams. Speaker fees are excluded by design.
export const combineRevenue = ({
  tickets = [],
  stalls = [],
  roundTables = [],
}: {
  tickets?: any[];
  stalls?: any[];
  roundTables?: any[];
}): number =>
  ticketsRevenue(tickets) + stallsRevenue(stalls) + roundTablesRevenue(roundTables);
