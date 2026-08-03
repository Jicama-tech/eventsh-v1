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

/**
 * Per-event profit and loss for an organizer.
 *
 * Pulls every money stream into one place: what came in from visitors,
 * exhibitors, round tables, speakers and sponsors, minus what went out to
 * suppliers and to EventSH in platform fees.
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
          .select("grandTotal paidAmount remainingAmount paymentStatus status")
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
    const liveStalls = (stalls as any[]).filter(
      (s) => !["Cancelled", "Returned", "Forfeited"].includes(String(s.status)),
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
    // Suppliers: what's actually been paid out, plus what's still owed on
    // approved quotes.
    const liveQuotes = (supplierReqs as any[]).filter(
      (r) => !["Rejected", "Cancelled"].includes(String(r.status)),
    );
    const supplierPaid = liveQuotes.reduce(
      (s, r) => s + (Number(r.payment?.amountPaid) || 0),
      0,
    );
    const supplierOutstanding = liveQuotes.reduce((s, r) => {
      // A settled negotiation replaces the original quote as what's owed.
      const agreed = Number(r.agreedTotal);
      const total =
        Number.isFinite(agreed) && agreed > 0
          ? agreed
          : Number(r.quotationTotal) || 0;
      const paid = Number(r.payment?.amountPaid) || 0;
      const balance =
        r.payment?.balanceDue != null
          ? Number(r.payment.balanceDue)
          : Math.max(0, total - paid);
      // Only quotes the organizer accepted represent a real commitment.
      return ["Approved", "Partially Paid", "Paid", "Completed"].includes(
        String(r.status),
      )
        ? s + balance
        : s;
    }, 0);

    // Platform fees: same basis billing-payments charges on.
    const tables = this.flatten(event.venueTables);
    const roundsLayout = this.flatten(event.venueRoundTables);
    const stallsSold = tables.filter((t: any) => !!t?.isBooked).length;
    const tablesBooked = roundsLayout.filter(
      (rt: any) =>
        !!rt?.isFullyBooked ||
        (Array.isArray(rt?.bookedChairs) && rt.bookedChairs.length > 0),
    ).length;
    const chairsBooked = roundsLayout.reduce(
      (acc: number, rt: any) =>
        acc + (Array.isArray(rt?.bookedChairs) ? rt.bookedChairs.length : 0),
      0,
    );
    const speakersBooked = (speakers as any[]).filter(
      (s) => String(s.status) === "Confirmed",
    ).length;
    const platformFee =
      stallsSold * rates.stallRate +
      tablesBooked * rates.roundTableRate +
      chairsBooked * rates.chairRate +
      speakersBooked * rates.speakerRate;

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
        count: liveQuotes.length,
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
        count: stallsSold + tablesBooked + chairsBooked + speakersBooked,
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
