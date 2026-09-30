import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";

/** A single line in the profit-and-loss breakdown. */
export interface PnlLine {
  key: string;
  label: string;
  amount: number;
  /** How many records produced this figure — shown as context in the UI. */
  count: number;
  note?: string;
}

/** One thing an event sells, and how much of it went. */
export interface ReportItem {
  name: string;
  /** Regular price; null when the item has no single cash price. */
  price: number | null;
  /** Member rate, only where the organizer set one. */
  memberPrice?: number | null;
  /** How many were sold, in the group's unit. */
  sold: number;
  /** How many are still open; null = unlimited or not tracked. */
  left: number | null;
  revenue: number;
  /** Placed copies of this item are priced differently. */
  priceVaries?: boolean;
}

export interface ReportSection {
  key:
    | "visitors"
    | "exhibitors"
    | "roundTables"
    | "workshops"
    | "scheduledSpaces"
    | "speakers"
    | "sponsors";
  label: string;
  /** Headline figure for the PDF's KPI cards. */
  sold: number;
  soldLabel: string;
  revenue: number;
  /** How full the section is, when its capacity is finite. */
  fill: { used: number; total: number; unit: string } | null;
  groups: { title: string; unit: string; items: ReportItem[] }[];
  /** Money lines under the table that make the items add up to `revenue`
   * (discounts, deposits). */
  adjustments: { label: string; amount: number }[];
}

/**
 * Per-event profit and loss for an organizer.
 *
 * Pulls every money stream into one place: what came in from visitors,
 * exhibitors, round tables, speakers and sponsors, minus what went out to
 * suppliers and to EventSH in platform fees.
 *
 * Exhibitor security deposits are collected but refundable, so they are
 * deducted from revenue: net profit only counts money the organizer keeps.
 *
 * Only money that has actually changed hands is counted. Pending bookings,
 * unpaid speaker fees and unverified sponsorships are reported separately as
 * "expected" so the organizer can see the pipeline without it inflating the
 * realised figure.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("Ticket") private ticketModel: Model<any>,
    @InjectModel("Stall") private stallModel: Model<any>,
    @InjectModel("RoundTableBooking") private roundTableModel: Model<any>,
    @InjectModel("SpeakerRequest") private speakerModel: Model<any>,
    @InjectModel("SponsorRequest") private sponsorModel: Model<any>,
    @InjectModel("SupplierRequest") private supplierRequestModel: Model<any>,
    @InjectModel("PlatformBillingRates") private ratesModel: Model<any>,
    // Out-of-pocket costs logged by the organizer or an operator.
    @InjectModel("EventExpense") private expenseModel: Model<any>,
    @InjectModel("WorkshopBooking") private workshopBookingModel: Model<any>,
    @InjectModel("ScheduledSpaceRequest")
    private scheduledSpaceRequestModel: Model<any>,
  ) {}

  private assertId(id: string, label = "id") {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  private flatten(v: any): any[] {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return Object.values(v).flat() as any[];
  }

  /**
   * Supplier money for one event: what's actually been paid out, plus
   * what's still owed on quotes the organizer accepted.
   */
  private supplierCosts(reqs: any[]) {
    const liveQuotes = reqs.filter(
      (r) => !["Rejected", "Cancelled"].includes(String(r.status)),
    );
    const paid = liveQuotes.reduce(
      (s, r) => s + (Number(r.payment?.amountPaid) || 0),
      0,
    );
    const outstanding = liveQuotes.reduce((s, r) => {
      // A settled negotiation replaces the original quote as what's owed.
      const agreed = Number(r.agreedTotal);
      const total =
        Number.isFinite(agreed) && agreed > 0
          ? agreed
          : Number(r.quotationTotal) || 0;
      const paidSoFar = Number(r.payment?.amountPaid) || 0;
      const balance =
        r.payment?.balanceDue != null
          ? Number(r.payment.balanceDue)
          : Math.max(0, total - paidSoFar);
      // Only quotes the organizer accepted represent a real commitment.
      return ["Approved", "Partially Paid", "Paid", "Completed"].includes(
        String(r.status),
      )
        ? s + balance
        : s;
    }, 0);
    return { paid, outstanding, count: liveQuotes.length };
  }

  /**
   * EventSH's fee for one event — the same basis billing-payments charges
   * on: booked spaces, round tables with any seat taken, seats, and
   * confirmed speakers, each at its platform rate.
   */
  private platformFeeFor(
    event: any,
    speakers: any[],
    rates: { stallRate: number; roundTableRate: number; chairRate: number; speakerRate: number },
  ) {
    const tables = this.flatten(event.venueTables);
    const roundsLayout = this.flatten(event.venueRoundTables);
    const lines = [
      {
        label: "Spaces booked",
        count: tables.filter((t: any) => !!t?.isBooked).length,
        rate: rates.stallRate,
      },
      {
        label: "Round tables booked",
        count: roundsLayout.filter(
          (rt: any) =>
            !!rt?.isFullyBooked ||
            (Array.isArray(rt?.bookedChairs) && rt.bookedChairs.length > 0),
        ).length,
        rate: rates.roundTableRate,
      },
      {
        label: "Round-table seats booked",
        count: roundsLayout.reduce(
          (acc: number, rt: any) =>
            acc + (Array.isArray(rt?.bookedChairs) ? rt.bookedChairs.length : 0),
          0,
        ),
        rate: rates.chairRate,
      },
      {
        label: "Speakers confirmed",
        count: speakers.filter((s) => String(s.status) === "Confirmed").length,
        rate: rates.speakerRate,
      },
    ].map((l) => ({ ...l, amount: l.count * l.rate }));
    return { total: lines.reduce((a, l) => a + l.amount, 0), lines };
  }

  /** Platform rates, with the same defaults billing-payments falls back to. */
  private async loadRates() {
    const doc = (await this.ratesModel.findOne().lean()) as any;
    return {
      stallRate: doc?.stallRate ?? 0,
      roundTableRate: doc?.roundTableRate ?? 0,
      chairRate: doc?.chairRate ?? 0,
      speakerRate: doc?.speakerRate ?? 0,
    };
  }

  async eventPnl(eventId: string) {
    this.assertId(eventId, "eventId");
    const evObjId = new Types.ObjectId(eventId);

    const event = (await this.eventModel
      .findById(eventId)
      .select("title startDate endDate organizer venueTables venueRoundTables")
      .lean()) as any;
    if (!event) throw new NotFoundException("Event not found");

    const organizerId = event.organizer;
    const organizer = organizerId
      ? ((await this.organizerModel.findById(organizerId).lean()) as any)
      : null;
    const currency = organizer?.country === "SG" ? "SG" : "IN";

    const [tickets, stalls, rounds, speakers, sponsors, supplierReqs, rates] =
      await Promise.all([
        this.ticketModel
          .find({ eventId: evObjId })
          .select("totalAmount status")
          .lean(),
        this.stallModel
          .find({ eventId: evObjId })
          .select(
            "grandTotal depositTotal paidAmount remainingAmount paymentStatus status depositReturned",
          )
          .lean(),
        this.roundTableModel
          .find({ eventId: evObjId })
          .select("amount paymentStatus")
          .lean(),
        this.speakerModel
          .find({ eventId: evObjId })
          .select("fee isCharged paymentStatus status")
          .lean(),
        this.sponsorModel
          .find({ eventId: evObjId })
          .select("amount status")
          .lean(),
        this.supplierRequestModel
          .find({ eventId: evObjId })
          .select("quotationTotal agreedTotal payment status")
          .lean(),
        this.loadRates(),
      ]);

    const expenses = (await this.expenseModel
      .find({ eventId: evObjId })
      .select("amount category status")
      .lean()) as any[];

    // ── Revenue ────────────────────────────────────────────────────
    // Visitors: confirmed + used tickets are money taken; pending isn't.
    const paidTickets = (tickets as any[]).filter((t) =>
      ["confirmed", "used"].includes(String(t.status)),
    );
    const visitorRevenue = paidTickets.reduce(
      (s, t) => s + (Number(t.totalAmount) || 0),
      0,
    );

    // Exhibitors: how much of each booking has actually been collected.
    //
    // `paidAmount` is not maintained by the stall flow — a fully-settled stall
    // routinely carries paidAmount 0 with paymentStatus "Paid" and
    // remainingAmount 0. So `paymentStatus` is the source of truth, with
    // `remainingAmount` covering the partial case, and `paidAmount` used only
    // when something has actually populated it.
    //
    // "Returned" stays in: that exhibitor used the space and paid the rent —
    // only the deposit went back, and that is taken out below.
    const liveStalls = (stalls as any[]).filter(
      (s) => !["Cancelled", "Forfeited"].includes(String(s.status)),
    );
    const stallCollected = (r: any) => {
      const total = Number(r.grandTotal) || 0;
      if (String(r.paymentStatus) === "Paid") return total;
      const paid = Number(r.paidAmount) || 0;
      if (paid > 0) return Math.min(paid, total);
      const remaining = Number(r.remainingAmount) || 0;
      // Partial bookings track what's left rather than what's in.
      return remaining > 0 ? Math.max(0, total - remaining) : 0;
    };
    const exhibitorRevenue = liveStalls.reduce(
      (s, r) => s + stallCollected(r),
      0,
    );
    const exhibitorOutstanding = liveStalls.reduce(
      (s, r) => s + Math.max(0, (Number(r.grandTotal) || 0) - stallCollected(r)),
      0,
    );

    // Security deposits: grandTotal = rent + deposit + add-ons, but the
    // deposit goes back to the vendor after check-out, so it is never
    // income. A part-paid booking doesn't record which part it covered, so
    // the deposit is taken as paid first — profit is never overstated.
    const stallDeposit = (r: any) =>
      Math.min(Math.max(0, Number(r.depositTotal) || 0), stallCollected(r));
    const isDepositReturned = (r: any) =>
      !!r.depositReturned || String(r.status) === "Returned";
    const depositStalls = liveStalls.filter((r) => stallDeposit(r) > 0);
    const depositsReturned = depositStalls
      .filter(isDepositReturned)
      .reduce((s, r) => s + stallDeposit(r), 0);
    const depositsToReturn = depositStalls
      .filter((r) => !isDepositReturned(r))
      .reduce((s, r) => s + stallDeposit(r), 0);
    const depositsCollected = depositsReturned + depositsToReturn;

    const paidRounds = (rounds as any[]).filter(
      (r) => String(r.paymentStatus) === "Paid",
    );
    const roundTableRevenue = paidRounds.reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0,
    );

    // Speakers only bring money in when the organizer charges them.
    const paidSpeakers = (speakers as any[]).filter(
      (s) => s.isCharged && String(s.paymentStatus) === "Paid",
    );
    const speakerRevenue = paidSpeakers.reduce(
      (s, r) => s + (Number(r.fee) || 0),
      0,
    );
    const speakerOutstanding = (speakers as any[])
      .filter((s) => s.isCharged && String(s.paymentStatus) === "Unpaid")
      .reduce((s, r) => s + (Number(r.fee) || 0), 0);

    // Sponsors count once the organizer has verified the transfer.
    const confirmedSponsors = (sponsors as any[]).filter(
      (s) => String(s.status) === "Confirmed",
    );
    const sponsorRevenue = confirmedSponsors.reduce(
      (s, r) => s + (Number(r.amount) || 0),
      0,
    );
    const sponsorPipeline = (sponsors as any[])
      .filter((s) => ["Applied", "Approved", "Payment Submitted"].includes(String(s.status)))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);

    // ── Costs ──────────────────────────────────────────────────────
    const suppliers = this.supplierCosts(supplierReqs as any[]);
    const supplierPaid = suppliers.paid;
    const supplierOutstanding = suppliers.outstanding;
    const fee = this.platformFeeFor(event, speakers as any[], rates);
    const platformFee = fee.total;

    const revenue: PnlLine[] = [
      {
        key: "visitors",
        label: "Visitors (tickets)",
        amount: visitorRevenue,
        count: paidTickets.length,
      },
      {
        key: "exhibitors",
        label: "Exhibitors (stalls)",
        amount: exhibitorRevenue,
        count: liveStalls.length,
        note: exhibitorOutstanding > 0 ? `${exhibitorOutstanding} still due` : undefined,
      },
      // Negative on purpose: the exhibitor line above is what was collected,
      // deposits included; this takes the refundable part out.
      ...(depositsCollected > 0
        ? [
            {
              key: "deposits",
              label: "Less: exhibitor deposits (refundable)",
              amount: -depositsCollected,
              count: depositStalls.length,
              note: `${depositsToReturn} to return, ${depositsReturned} returned`,
            },
          ]
        : []),
      {
        key: "roundTables",
        label: "Round tables",
        amount: roundTableRevenue,
        count: paidRounds.length,
      },
      {
        key: "speakers",
        label: "Speakers (fees)",
        amount: speakerRevenue,
        count: paidSpeakers.length,
        note: speakerOutstanding > 0 ? `${speakerOutstanding} unpaid` : undefined,
      },
      {
        key: "sponsors",
        label: "Sponsors",
        amount: sponsorRevenue,
        count: confirmedSponsors.length,
        note: sponsorPipeline > 0 ? `${sponsorPipeline} in pipeline` : undefined,
      },
    ];

    // Everything paid out of pocket outside the supplier flow.
    // Pending spend isn't a cost until someone signs it off.
    const approvedExpenses = expenses.filter(
      (e) => String(e.status || "Approved") === "Approved",
    );
    const otherExpenses = approvedExpenses.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0,
    );
    const pendingExpenses = expenses
      .filter((e) => String(e.status) === "Pending")
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const costs: PnlLine[] = [
      {
        key: "suppliers",
        label: "Suppliers (paid out)",
        amount: supplierPaid,
        count: suppliers.count,
        note:
          supplierOutstanding > 0 ? `${supplierOutstanding} still owed` : undefined,
      },
      {
        key: "expenses",
        label: "Other expenses",
        amount: otherExpenses,
        count: approvedExpenses.length,
      },
      {
        key: "platformFee",
        label: "EventSH platform fee",
        amount: platformFee,
        count: fee.lines.reduce((a, l) => a + l.count, 0),
      },
    ];

    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalCosts = costs.reduce((s, r) => s + r.amount, 0);
    const netProfit = totalRevenue - totalCosts;

    return {
      event: {
        id: String(event._id),
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      currency,
      revenue,
      costs,
      totals: {
        revenue: totalRevenue,
        costs: totalCosts,
        netProfit,
        // Margin is meaningless without revenue — report null rather than 0.
        margin:
          totalRevenue > 0
            ? Math.round((netProfit / totalRevenue) * 1000) / 10
            : null,
      },
      // Exhibitor deposits, already deducted from revenue above.
      deposits: {
        collected: depositsCollected,
        toReturn: depositsToReturn,
        returned: depositsReturned,
        count: depositStalls.length,
      },
      // Money not yet realised, kept out of the totals above.
      expected: {
        exhibitorOutstanding,
        speakerOutstanding,
        sponsorPipeline,
        supplierOutstanding,
        pendingExpenses,
      },
    };
  }

  /**
   * Section-by-section report for one event: for every section the event
   * uses (visitors, exhibitors, round tables, workshops, scheduled spaces,
   * speakers, sponsors), each thing it sells, how much of it went and what
   * it brought in. Sections the event doesn't use, or that have no sellable
   * templates, are left out — so an event with no visitor ticketing has no
   * visitors section, and round tables switched on with no table types set
   * up don't appear either. Also carries the event's logged expenses and
   * the net profit after every deduction: refundable deposits, expenses,
   * supplier payouts and the EventSH platform fee.
   *
   * Only money actually received counts — the same rules as the dashboard's
   * Total Revenue and the P&L: tickets with payment confirmed, stalls and
   * round tables marked Paid, confirmed sponsors. Workshops, scheduled
   * spaces and charged speakers are counted once paid too.
   */
  async eventReport(eventId: string) {
    this.assertId(eventId, "eventId");
    // eventId is stored uncast on some booking schemas — match both forms.
    const byEvent = { eventId: { $in: [eventId, new Types.ObjectId(eventId)] } };

    const event = (await this.eventModel
      .findById(eventId)
      .select(
        "title features visitorTypes seatRowTemplates venueSeats tableTemplates venueTables addOnItems roundTableTemplates venueRoundTables workshopSessions workshopPackages scheduledSpaceTemplates venueScheduledSpaces scheduledSpaceBookedSlots speakerSlotTemplates sponsorTypes",
      )
      .lean()) as any;
    if (!event) throw new NotFoundException("Event not found");

    const [
      tickets,
      stalls,
      rounds,
      workshops,
      scheduled,
      speakers,
      sponsors,
      expenses,
      supplierReqs,
    ] =
      (await Promise.all([
        this.ticketModel
          .find(byEvent)
          .select("ticketId ticketDetails totalAmount paymentConfirmed status")
          .lean(),
        this.stallModel
          .find(byEvent)
          .select(
            "status paymentStatus selectedTables selectedAddOns tablesTotal depositTotal addOnsTotal grandTotal",
          )
          .lean(),
        this.roundTableModel
          .find(byEvent)
          .select(
            "tablePositionId tableName sellingMode isWholeTable numberOfSeats selectedChairIndices amount paymentStatus",
          )
          .lean(),
        this.workshopBookingModel
          .find(byEvent)
          .select("bookingType sessionId packageId itemName quantity amount paymentStatus")
          .lean(),
        this.scheduledSpaceRequestModel
          .find(byEvent)
          .select("status paymentStatus selectedSlots slotsTotal paidAmount")
          .lean(),
        this.speakerModel
          .find(byEvent)
          .select("selectedSlotId selectedSlotName status isCharged fee paymentStatus")
          .lean(),
        this.sponsorModel
          .find(byEvent)
          .select("sponsorTypeId sponsorTypeName amount status")
          .lean(),
        this.expenseModel
          .find(byEvent)
          .select("title category amount spentAt paidTo status")
          .sort({ spentAt: -1 })
          .lean(),
        this.supplierRequestModel
          .find(byEvent)
          .select("quotationTotal agreedTotal payment status")
          .lean(),
      ])) as any[][];
    const rates = await this.loadRates();

    const n = (v: any) => Number(v) || 0;
    const optNum = (v: any): number | null =>
      v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
        ? null
        : Number(v);
    const sum = <T>(xs: T[], f: (x: T) => number) =>
      xs.reduce((a, x) => a + f(x), 0);
    // A placed space / table can override its template's price (the booking
    // flow reads the placed row first, then the template). One shared value
    // is shown as-is; several mean the price varies by position.
    const placedPrice = (placed: any[], field: string, tplValue: any) => {
      const vals = new Set(
        (placed.length ? placed : [{}]).map(
          (p) => optNum(p?.[field]) ?? optNum(tplValue),
        ),
      );
      vals.delete(null);
      return vals.size > 1
        ? { price: null, priceVaries: true }
        : { price: vals.size ? ([...vals][0] as number) : null, priceVaries: false };
    };
    const features = event.features || {};
    // A section is in the report only when it has something to sell — at
    // least one sellable template (a switched-on section with nothing set
    // up is left out), and not switched off. Paid bookings always keep it
    // in, even if their templates were deleted since, so no money drops
    // out of the total.
    const uses = (flag: any, hasSellables: boolean, hasBookings: boolean) =>
      hasBookings || (flag !== false && hasSellables);
    // Items that sold something but no longer match a sellable (renamed or
    // deleted since) are kept under their booked name.
    const bucket = () => {
      const m = new Map<string, ReportItem>();
      return {
        add(key: string, name: string, sold: number, revenue: number) {
          const it =
            m.get(key) ||
            m.set(key, { name, price: null, sold: 0, left: null, revenue: 0 }).get(key)!;
          it.sold += sold;
          it.revenue += revenue;
        },
        /** Remove and return one entry, so what's left is the leftovers. */
        take(key: string) {
          const it = m.get(key);
          m.delete(key);
          return it;
        },
        items: () => [...m.values()],
      };
    };
    const sections: ReportSection[] = [];

    // ── Visitors ───────────────────────────────────────────────────
    // Confirmed workshop bookings also issue a "WS-" ticket; those belong
    // to the workshops section below.
    const visitorTickets = tickets.filter(
      (t) =>
        !String(t.ticketId || "").startsWith("WS-") &&
        String(t.status) !== "cancelled" &&
        !!t.paymentConfirmed,
    );
    const visitorTypes: any[] = event.visitorTypes || [];
    const seatRows: any[] = event.seatRowTemplates || [];
    const seats: any[] = this.flatten(event.venueSeats);
    // Ticketing is on when a ticket type is on sale (switched-off types
    // don't count), seats are placed, or tickets were sold anyway.
    if (
      visitorTypes.some((v) => v?.isActive !== false) ||
      seats.length > 0 ||
      visitorTickets.length > 0
    ) {
      const types = [
        ...visitorTypes.map((v) => ({ id: String(v.id), name: String(v.name || "Ticket"), price: optNum(v.price), left: optNum(v.maxCount), hidden: v.isActive === false })),
        ...seatRows.map((r) => ({
          id: String(r.id),
          name: String(r.name || "Seat row"),
          price: optNum(r.price),
          left: null as number | null,
          seatCount: seats.filter((s) => String(s.rowId) === String(r.id)).length,
          hidden: false,
        })),
      ];
      const byType = new Map<string, { sold: number; revenue: number }>();
      const other = bucket();
      let linesTotal = 0;
      for (const t of visitorTickets) {
        for (const d of t.ticketDetails || []) {
          const qty = n(d.quantity);
          const value = n(d.price) * qty;
          linesTotal += value;
          const label = String(d.ticketType || "Ticket");
          // tierId is the reliable link; older tickets only carry the name,
          // sometimes decorated as "VIP (Seats A1, A2)".
          const match =
            types.find((x) => d.tierId && x.id === String(d.tierId)) ||
            types.find((x) => label === x.name || label.startsWith(`${x.name} (`));
          if (match) {
            const e = byType.get(match.id) || { sold: 0, revenue: 0 };
            e.sold += qty;
            e.revenue += value;
            byType.set(match.id, e);
          } else {
            const base = label.replace(/\s*\(.*\)$/, "");
            other.add(base, base, qty, value);
          }
        }
      }
      const items: ReportItem[] = [
        ...types
          .filter((x) => !x.hidden || byType.has(x.id))
          .map((x: any) => {
            const s = byType.get(x.id) || { sold: 0, revenue: 0 };
            // maxCount is the stock still open (it drops with each sale);
            // a seat row's stock is its seats.
            const left =
              x.seatCount != null ? Math.max(0, x.seatCount - s.sold) : x.left;
            return { name: x.name, price: x.price, sold: s.sold, left, revenue: s.revenue };
          }),
        ...other.items(),
      ];
      const collected = sum(visitorTickets, (t) => n(t.totalAmount));
      const discount = linesTotal - collected;
      const sold = sum(items, (i) => i.sold);
      const finite = items.length > 0 && items.every((i) => i.left != null);
      sections.push({
        key: "visitors",
        label: "Visitors",
        sold,
        soldLabel: "Tickets sold",
        revenue: collected,
        fill: finite
          ? { used: sold, total: sold + sum(items, (i) => i.left || 0), unit: "tickets" }
          : null,
        groups: [{ title: "Ticket types", unit: "tickets", items }],
        adjustments:
          Math.abs(discount) >= 0.5
            ? [{ label: "Less: discounts and coupons", amount: -discount }]
            : [],
      });
    }

    // ── Exhibitors ─────────────────────────────────────────────────
    const spaceTpls = ((event.tableTemplates || []) as any[]).filter(
      (t) => t?.forSale !== false,
    );
    const placedSpaces = this.flatten(event.venueTables).filter(
      (p: any) => p?.forSale !== false,
    );
    const paidStalls = stalls.filter(
      (s) => String(s.paymentStatus) === "Paid" && String(s.status) !== "Cancelled",
    );
    if (uses(features.hasStalls, spaceTpls.length > 0, paidStalls.length > 0)) {
      const placedByPos = new Map<string, any>(
        placedSpaces.map((p: any) => [String(p.positionId), p]),
      );
      const tplById = new Map<string, any>(spaceTpls.map((t) => [String(t.id), t]));
      const spaceSales = new Map<string, { sold: number; revenue: number }>();
      const otherSpaces = bucket();
      const addOnSales = bucket();
      for (const s of paidStalls) {
        for (const t of s.selectedTables || []) {
          const tplId = String(placedByPos.get(String(t.positionId))?.id ?? t.tableId);
          if (tplById.has(tplId)) {
            const e = spaceSales.get(tplId) || { sold: 0, revenue: 0 };
            e.sold += 1;
            e.revenue += n(t.price);
            spaceSales.set(tplId, e);
          } else {
            const name = String(t.name || t.tableName || "Space");
            otherSpaces.add(name, name, 1, n(t.price));
          }
        }
        for (const a of s.selectedAddOns || []) {
          const qty = n(a.quantity) || 1;
          addOnSales.add(String(a.addOnId || a.name), String(a.name || "Add-on"), qty, n(a.price) * qty);
        }
      }
      const spaceItems: ReportItem[] = [
        ...spaceTpls.map((tpl) => {
          const placed = placedSpaces.filter((p: any) => String(p.id) === String(tpl.id));
          const s = spaceSales.get(String(tpl.id)) || { sold: 0, revenue: 0 };
          return {
            name: String(tpl.name || "Space"),
            ...placedPrice(placed, "tablePrice", tpl.tablePrice ?? tpl.price),
            memberPrice: placedPrice(placed, "memberPrice", tpl.memberPrice).price,
            sold: s.sold,
            // isBooked covers every held space, paid or awaiting approval.
            left: placed.filter((p: any) => !p.isBooked).length,
            revenue: s.revenue,
          };
        }),
        ...otherSpaces.items(),
      ];
      const catalog: any[] = event.addOnItems || [];
      const addOnItems: ReportItem[] = catalog.map((a) => {
        const s = addOnSales.take(String(a.id));
        return {
          name: String(a.name || "Add-on"),
          price: optNum(a.price),
          sold: s?.sold || 0,
          left: null,
          revenue: s?.revenue || 0,
        };
      });
      // add-ons sold but since removed from the list
      addOnItems.push(...addOnSales.items());

      const revenue = sum(paidStalls, (s) => n(s.grandTotal));
      const deposits = sum(paidStalls, (s) => n(s.depositTotal));
      const itemsTotal =
        sum(spaceItems, (i) => i.revenue) + sum(addOnItems, (i) => i.revenue);
      const otherAdj = revenue - itemsTotal - deposits;
      sections.push({
        key: "exhibitors",
        label: "Exhibitors",
        sold: sum(spaceItems, (i) => i.sold),
        soldLabel: "Spaces sold",
        revenue,
        fill: placedSpaces.length
          ? {
              used: placedSpaces.filter((p: any) => !!p.isBooked).length,
              total: placedSpaces.length,
              unit: "spaces",
            }
          : null,
        groups: [
          { title: "Space types", unit: "spaces", items: spaceItems },
          ...(addOnItems.length ? [{ title: "Add-ons", unit: "qty", items: addOnItems }] : []),
        ],
        adjustments: [
          ...(deposits > 0
            ? [{ label: "Security deposits (refundable)", amount: deposits }]
            : []),
          ...(Math.abs(otherAdj) >= 0.5
            ? [{ label: "Other adjustments (coupons, edits)", amount: otherAdj }]
            : []),
        ],
      });
    }

    // ── Round tables ───────────────────────────────────────────────
    const rtTpls = ((event.roundTableTemplates || []) as any[]).filter(
      (t) => t?.forSale !== false,
    );
    const placedRts = this.flatten(event.venueRoundTables).filter(
      (p: any) => p?.forSale !== false,
    );
    const paidRounds = rounds.filter((r) => String(r.paymentStatus) === "Paid");
    if (uses(features.hasRoundTables, rtTpls.length > 0, paidRounds.length > 0)) {
      const rtByPos = new Map<string, any>(
        placedRts.map((p: any) => [String(p.positionId), p]),
      );
      const sales = new Map<string, { sold: number; revenue: number }>();
      const other = bucket();
      for (const b of paidRounds) {
        const tplId = rtByPos.get(String(b.tablePositionId))?.templateId;
        const tpl = rtTpls.find((t) => String(t.id) === String(tplId));
        // A per-seat table sells seats; a whole-table one sells the table.
        const qty =
          tpl?.sellingMode === "chair"
            ? n(b.numberOfSeats) || (b.selectedChairIndices || []).length || 1
            : 1;
        if (tpl) {
          const e = sales.get(String(tpl.id)) || { sold: 0, revenue: 0 };
          e.sold += qty;
          e.revenue += n(b.amount);
          sales.set(String(tpl.id), e);
        } else {
          const name = String(b.tableName || "Round table");
          other.add(name, name, qty, n(b.amount));
        }
      }
      const seatsTaken = (p: any) =>
        p.isFullyBooked ? n(p.numberOfChairs) : (p.bookedChairs || []).length;
      const items: ReportItem[] = [
        ...rtTpls.map((tpl) => {
          const perSeat = tpl.sellingMode === "chair";
          const placed = placedRts.filter((p: any) => String(p.templateId) === String(tpl.id));
          const s = sales.get(String(tpl.id)) || { sold: 0, revenue: 0 };
          return {
            name: `${tpl.name || "Round table"} (${perSeat ? "per seat" : "whole table"})`,
            ...placedPrice(
              placed,
              perSeat ? "chairPrice" : "tablePrice",
              perSeat ? tpl.chairPrice : tpl.tablePrice,
            ),
            memberPrice: placedPrice(
              placed,
              perSeat ? "memberChairPrice" : "memberTablePrice",
              perSeat ? tpl.memberChairPrice : tpl.memberTablePrice,
            ).price,
            sold: s.sold,
            left: perSeat
              ? sum(placed, (p: any) => Math.max(0, n(p.numberOfChairs) - seatsTaken(p)))
              : placed.filter((p: any) => seatsTaken(p) === 0 && !p.isFullyBooked).length,
            revenue: s.revenue,
          };
        }),
        ...other.items(),
      ];
      const seatTotal = sum(placedRts, (p: any) => n(p.numberOfChairs));
      sections.push({
        key: "roundTables",
        label: "Round Tables",
        sold: paidRounds.length,
        soldLabel: "Table bookings",
        revenue: sum(paidRounds, (r) => n(r.amount)),
        fill: seatTotal
          ? { used: sum(placedRts, seatsTaken), total: seatTotal, unit: "seats" }
          : null,
        groups: [{ title: "Table types", unit: "tables / seats", items }],
        adjustments: [],
      });
    }

    // ── Workshops ──────────────────────────────────────────────────
    const sessions: any[] = event.workshopSessions || [];
    const packages: any[] = event.workshopPackages || [];
    const paidWorkshops = workshops.filter((w) => String(w.paymentStatus) === "Paid");
    if (uses(
        features.hasWorkshops,
        sessions.length + packages.length > 0,
        paidWorkshops.length > 0,
      )) {
      const line = (list: any[], kind: string, idOf: (w: any) => any) => {
        const sales = new Map<string, { sold: number; revenue: number }>();
        const other = bucket();
        for (const w of paidWorkshops.filter((w) => (w.bookingType || "session") === kind)) {
          const id = String(idOf(w));
          const qty = n(w.quantity) || 1;
          if (list.some((x) => String(x.id) === id)) {
            const e = sales.get(id) || { sold: 0, revenue: 0 };
            e.sold += qty;
            e.revenue += n(w.amount);
            sales.set(id, e);
          } else {
            const name = String(w.itemName || "Workshop");
            other.add(name, name, qty, n(w.amount));
          }
        }
        return { sales, other: other.items() };
      };
      const s = line(sessions, "session", (w) => w.sessionId);
      const p = line(packages, "package", (w) => w.packageId);
      const sessionItems: ReportItem[] = [
        ...sessions.map((x) => ({
          name: String(x.name || "Session"),
          price: optNum(x.price),
          sold: s.sales.get(String(x.id))?.sold || 0,
          // bookedSeats also counts seats taken through packages.
          left: n(x.maxSeats) > 0 ? Math.max(0, n(x.maxSeats) - n(x.bookedSeats)) : null,
          revenue: s.sales.get(String(x.id))?.revenue || 0,
        })),
        ...s.other,
      ];
      const packageItems: ReportItem[] = [
        ...packages.map((x) => ({
          name: String(x.name || "Package"),
          price: optNum(x.price),
          sold: p.sales.get(String(x.id))?.sold || 0,
          left: null,
          revenue: p.sales.get(String(x.id))?.revenue || 0,
        })),
        ...p.other,
      ];
      const capped = sessions.length > 0 && sessions.every((x) => n(x.maxSeats) > 0);
      sections.push({
        key: "workshops",
        label: "Workshops",
        sold: sum(paidWorkshops, (w) => n(w.quantity) || 1),
        soldLabel: "Workshop seats sold",
        revenue: sum(paidWorkshops, (w) => n(w.amount)),
        fill: capped
          ? {
              used: sum(sessions, (x) => n(x.bookedSeats)),
              total: sum(sessions, (x) => n(x.maxSeats)),
              unit: "seats",
            }
          : null,
        groups: [
          { title: "Sessions", unit: "seats", items: sessionItems },
          ...(packageItems.length ? [{ title: "Packages", unit: "bookings", items: packageItems }] : []),
        ],
        adjustments: [],
      });
    }

    // ── Scheduled spaces ───────────────────────────────────────────
    // Only sellable facilities belong in the report — a "Not for sale"
    // Scheduled Space is a layout-only reference, same rule as Exhibitors
    // above. Slots sold before a facility was flipped still count: their
    // template is no longer in ssTpls, so they fall through to the "other"
    // bucket by space name below.
    const ssTpls: any[] = ((event.scheduledSpaceTemplates || []) as any[]).filter(
      (t) => t?.forSale !== false,
    );
    const placedSs = this.flatten(event.venueScheduledSpaces).filter(
      (p: any) => p?.forSale !== false,
    );
    // Part-paid requests hold their slots and count what's been paid.
    const paidScheduled = scheduled.filter(
      (r) =>
        ["Paid", "Partial"].includes(String(r.paymentStatus)) &&
        !["Cancelled", "Rejected"].includes(String(r.status)),
    );
    if (uses(features.hasScheduledSpaces, ssTpls.length > 0, paidScheduled.length > 0)) {
      const sales = new Map<string, { sold: number; revenue: number }>();
      const other = bucket();
      for (const r of paidScheduled) {
        const slots: any[] = r.selectedSlots || [];
        const full = sum(slots, (x) => n(x.price)) || n(r.slotsTotal);
        const share =
          String(r.paymentStatus) === "Paid" || full === 0
            ? 1
            : Math.min(1, n(r.paidAmount) / full);
        for (const x of slots) {
          const id = String(x.templateId);
          if (ssTpls.some((t) => String(t.id) === id)) {
            const e = sales.get(id) || { sold: 0, revenue: 0 };
            e.sold += 1;
            e.revenue += n(x.price) * share;
            sales.set(id, e);
          } else {
            const name = String(x.spaceName || "Space");
            other.add(name, name, 1, n(x.price) * share);
          }
        }
      }
      const booked = new Set<string>((event.scheduledSpaceBookedSlots || []).map(String));
      // A placed space carries its own slot list; the template's is the fallback.
      const slotsOf = (p: any, tpl: any) =>
        ((p?.slots?.length ? p.slots : tpl.slots) || []) as any[];
      const items: ReportItem[] = [
        ...ssTpls.map((tpl) => {
          const placed = placedSs.filter((p: any) => String(p.templateId) === String(tpl.id));
          const open = sum(placed, (p: any) =>
            slotsOf(p, tpl).filter((sl) => !booked.has(`${p.positionId}:${sl.id}`)).length,
          );
          const s = sales.get(String(tpl.id)) || { sold: 0, revenue: 0 };
          return {
            name: `${tpl.name || "Space"}${tpl.facilityType && tpl.facilityType !== tpl.name ? ` (${tpl.facilityType})` : ""}`,
            ...placedPrice(placed, "price", tpl.price),
            memberPrice: placedPrice(placed, "memberPrice", tpl.memberPrice).price,
            sold: s.sold,
            left: open,
            revenue: s.revenue,
          };
        }),
        ...other.items(),
      ];
      const total = sum(ssTpls, (tpl) =>
        sum(
          placedSs.filter((p: any) => String(p.templateId) === String(tpl.id)),
          (p: any) => slotsOf(p, tpl).length,
        ),
      );
      sections.push({
        key: "scheduledSpaces",
        label: "Scheduled Spaces",
        sold: sum(items, (i) => i.sold),
        soldLabel: "Slots booked",
        revenue: sum(items, (i) => i.revenue),
        fill: total ? { used: total - sum(items, (i) => i.left || 0), total, unit: "slots" } : null,
        groups: [{ title: "Spaces (per slot)", unit: "slots", items }],
        adjustments: [],
      });
    }

    // ── Speakers ───────────────────────────────────────────────────
    const speakerSlots: any[] = event.speakerSlotTemplates || [];
    const confirmedSpeakers = speakers.filter((s) =>
      ["Confirmed", "Completed"].includes(String(s.status)),
    );
    if (uses(features.hasSpeakers, speakerSlots.length > 0, confirmedSpeakers.length > 0)) {
      // A speaker only brings money in when charged and paid.
      const paidFee = (s: any) =>
        s.isCharged && String(s.paymentStatus) === "Paid" ? n(s.fee) : 0;
      const other = bucket();
      const items: ReportItem[] = speakerSlots.map((slot) => {
        const mine = confirmedSpeakers.filter((s) => String(s.selectedSlotId) === String(slot.id));
        return {
          name: String(slot.name || "Speaker slot"),
          price: optNum(slot.slotPrice),
          sold: mine.length,
          left: Math.max(0, (n(slot.maxSpeakers) || 1) - mine.length),
          revenue: sum(mine, paidFee),
        };
      });
      for (const s of confirmedSpeakers) {
        if (speakerSlots.some((slot) => String(slot.id) === String(s.selectedSlotId))) continue;
        const name = String(s.selectedSlotName || "Other speakers");
        other.add(name, name, 1, paidFee(s));
      }
      items.push(...other.items());
      const cap = sum(speakerSlots, (slot) => n(slot.maxSpeakers) || 1);
      sections.push({
        key: "speakers",
        label: "Speakers",
        sold: confirmedSpeakers.length,
        soldLabel: "Speakers confirmed",
        revenue: sum(confirmedSpeakers, paidFee),
        fill: cap
          ? { used: Math.min(cap, sum(items.slice(0, speakerSlots.length), (i) => i.sold)), total: cap, unit: "speakers" }
          : null,
        groups: [{ title: "Speaker slots", unit: "speakers", items }],
        adjustments: [],
      });
    }

    // ── Sponsors ───────────────────────────────────────────────────
    const tiers: any[] = event.sponsorTypes || [];
    const confirmedSponsors = sponsors.filter((s) => String(s.status) === "Confirmed");
    if (uses(
        features.hasSponsors,
        tiers.some((t) => t?.isActive !== false),
        confirmedSponsors.length > 0,
      )) {
      const other = bucket();
      const items: ReportItem[] = tiers
        .filter(
          (t) =>
            t.isActive !== false ||
            confirmedSponsors.some((s) => String(s.sponsorTypeId) === String(t.id)),
        )
        .map((t) => {
          const mine = confirmedSponsors.filter((s) => String(s.sponsorTypeId) === String(t.id));
          return {
            name: String(t.name || "Sponsorship"),
            // For a tier paid in kind this is the value it's worth.
            price: optNum(t.price),
            sold: mine.length,
            left: null,
            revenue: sum(mine, (s) => n(s.amount)),
          };
        });
      for (const s of confirmedSponsors) {
        if (tiers.some((t) => String(t.id) === String(s.sponsorTypeId))) continue;
        const name = String(s.sponsorTypeName || "Other sponsors");
        other.add(name, name, 1, n(s.amount));
      }
      items.push(...other.items());
      sections.push({
        key: "sponsors",
        label: "Sponsors",
        sold: confirmedSponsors.length,
        soldLabel: "Sponsors confirmed",
        revenue: sum(confirmedSponsors, (s) => n(s.amount)),
        fill: null,
        groups: [{ title: "Sponsorship tiers", unit: "sponsors", items }],
        adjustments: [],
      });
    }

    // ── Expenses ───────────────────────────────────────────────────
    // What the organizer logged as spent on the event (supplier payouts
    // live in the supplier flow, not here). Same rule as the P&L: approved
    // spend counts — older entries with no status were never gated, so they
    // count too — pending is listed but not taken off, rejected is dropped.
    const statusOf = (e: any) => String(e.status || "Approved");
    const listed = expenses.filter((e) => statusOf(e) !== "Rejected");
    const approved = listed.filter((e) => statusOf(e) === "Approved");
    const byCategory = new Map<string, { category: string; amount: number; count: number }>();
    for (const e of approved) {
      const category = String(e.category || "Other");
      const c = byCategory.get(category) || { category, amount: 0, count: 0 };
      c.amount += n(e.amount);
      c.count += 1;
      byCategory.set(category, c);
    }
    const totalRevenue = sum(sections, (s) => s.revenue);
    const expensesTotal = sum(approved, (e) => n(e.amount));

    // ── Net profit ─────────────────────────────────────────────────
    // Everything that comes off the money received. Deposits on paid
    // stalls go back to the exhibitors (a forfeited one is kept, so it
    // stays); supplier payouts and the platform fee use the P&L's rules.
    const depositsHeld = sum(
      stalls.filter(
        (s) =>
          String(s.paymentStatus) === "Paid" &&
          !["Cancelled", "Forfeited"].includes(String(s.status)),
      ),
      (s) => n(s.depositTotal),
    );
    const supplierTotals = this.supplierCosts(supplierReqs);
    const fee = this.platformFeeFor(event, speakers, rates);
    const deductions = [
      { key: "deposits", label: "Security deposits (refundable)", amount: depositsHeld },
      { key: "expenses", label: "Expenses (approved)", amount: expensesTotal },
      { key: "suppliers", label: "Supplier payouts", amount: supplierTotals.paid },
      { key: "platformFee", label: "EventSH platform fee", amount: fee.total },
    ];
    const netProfit = totalRevenue - sum(deductions, (d) => d.amount);

    return {
      eventId,
      title: event.title,
      hasVisitorTicketing: sections.some((s) => s.key === "visitors"),
      totalRevenue,
      sections,
      expenses: {
        total: expensesTotal,
        pending: sum(
          listed.filter((e) => statusOf(e) === "Pending"),
          (e) => n(e.amount),
        ),
        byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
        items: listed.map((e) => ({
          title: String(e.title || "Expense"),
          category: String(e.category || "Other"),
          amount: n(e.amount),
          spentAt: e.spentAt || null,
          paidTo: String(e.paidTo || ""),
          status: statusOf(e),
        })),
      },
      profit: {
        revenue: totalRevenue,
        deductions,
        netProfit,
        // On revenue net of deposits (they were never income), as the P&L
        // does. Meaningless without revenue — null rather than 0.
        margin:
          totalRevenue - depositsHeld > 0
            ? Math.round((netProfit / (totalRevenue - depositsHeld)) * 1000) / 10
            : null,
        // Owed on accepted quotes but not paid yet — not taken off.
        supplierOutstanding: supplierTotals.outstanding,
        platformFeeLines: fee.lines.filter((l) => l.count > 0),
      },
    };
  }

  /** P&L for every event an organizer runs, newest first. */
  async organizerPnl(organizerId: string) {
    this.assertId(organizerId, "organizerId");
    const events = (await this.eventModel
      .find({
        $or: [
          { organizer: organizerId },
          ...(Types.ObjectId.isValid(organizerId)
            ? [{ organizer: new Types.ObjectId(organizerId) }]
            : []),
        ],
      })
      .select("_id title startDate")
      .sort({ startDate: -1 })
      .lean()) as any[];

    const rows = [];
    for (const e of events) {
      rows.push(await this.eventPnl(String(e._id)));
    }
    return {
      events: rows,
      grandTotals: rows.reduce(
        (acc, r) => ({
          revenue: acc.revenue + r.totals.revenue,
          costs: acc.costs + r.totals.costs,
          netProfit: acc.netProfit + r.totals.netProfit,
        }),
        { revenue: 0, costs: 0, netProfit: 0 },
      ),
    };
  }
}
