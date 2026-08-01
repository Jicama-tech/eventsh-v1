import { billForCategory, EffectiveBillingRates } from "./billing-rate-calc.util";

export type BillingRates = EffectiveBillingRates;

export interface EventBillables {
  ticketsSold: number;
  stallsSold: number;
  tablesBooked: number;
  chairsBooked: number;
  speakersBooked: number;
  workshopsBooked: number;
  sponsorsConfirmed: number;
  suppliersConfirmed: number;
  bookedStalls: any[];
  bookedRoundTables: any[];
  bookedChairs: any[];
  speakers: any[];
  workshops: any[];
  sponsors: any[];
  suppliers: any[];
  tickets: any[];
}

export function flattenBillable(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v).flat() as any[];
  return [];
}

// Resolves both the display counts AND the raw priced items for an event's
// billable units. The items (each carrying its own price field) are what
// let percent-mode rates bill "X% of the item's own price" instead of a
// flat per-unit amount — see billForCategory.
export function computeEventBillables(
  event: any,
  speakers: any[],
  workshops: any[] = [],
  sponsors: any[] = [],
  suppliers: any[] = [],
  tickets: any[] = [],
): EventBillables {
  const tables = flattenBillable(event.venueTables);
  const rounds = flattenBillable(event.venueRoundTables);
  const bookedStalls = tables.filter((t: any) => !!t?.isBooked);
  const bookedRoundTables = rounds.filter(
    (rt: any) =>
      !!rt?.isFullyBooked ||
      (Array.isArray(rt?.bookedChairs) && rt.bookedChairs.length > 0),
  );
  const bookedChairs = rounds.flatMap((rt: any) =>
    (Array.isArray(rt?.bookedChairs) ? rt.bookedChairs : []).map(() => ({
      chairPrice: rt.chairPrice,
    })),
  );
  return {
    ticketsSold: tickets.length,
    stallsSold: bookedStalls.length,
    tablesBooked: bookedRoundTables.length,
    chairsBooked: bookedChairs.length,
    speakersBooked: speakers.length,
    workshopsBooked: workshops.length,
    sponsorsConfirmed: sponsors.length,
    suppliersConfirmed: suppliers.length,
    bookedStalls,
    bookedRoundTables,
    bookedChairs,
    speakers,
    workshops,
    sponsors,
    suppliers,
    tickets,
  };
}

export function amountForBillables(
  billables: EventBillables,
  rates: BillingRates,
): number {
  return (
    billForCategory(
      billables.tickets,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (t: any) => t.totalAmount,
    ) +
    billForCategory(
      billables.bookedStalls,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (t: any) => t.tablePrice,
    ) +
    billForCategory(
      billables.bookedRoundTables,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (rt: any) => rt.tablePrice,
    ) +
    billForCategory(
      billables.bookedChairs,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (c: any) => c.chairPrice,
    ) +
    billForCategory(
      billables.speakers,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (s: any) => s.fee,
    ) +
    billForCategory(
      billables.workshops,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (w: any) => w.amount,
    ) +
    billForCategory(
      billables.sponsors,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (s: any) => s.amount,
    ) +
    billForCategory(
      billables.suppliers,
      rates.moneyOutRate,
      rates.moneyOutRateMode,
      (s: any) => s.agreedTotal ?? s.quotationTotal,
    )
  );
}
