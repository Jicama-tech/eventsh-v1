import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AnalyticsService } from "../analytics/analytics.service";
import { awaitingApproval } from "./combox-payments.service";
import { EventAgentsService } from "../event-agents/event-agents.service";

export type FeedColumn = {
  key: string;
  label: string;
  format?: "number" | "money" | "date" | "status" | "bool" | "text";
};

export const FEED_SECTIONS = [
  "tickets",
  "exhibitors",
  "speakers",
  "sponsors",
  "workshops",
  "workshop-hosts",
  "roundtables",
  "scheduled-spaces",
  "rsvp",
  "feedback",
  "expenses",
  "agents",
] as const;
export type FeedSection = (typeof FEED_SECTIONS)[number];

const MAX_ROWS = 1000;

/** Who a booking was credited to (an event agent or an operator), as the Participants tables show it. */
function agentOf(d: any) {
  return {
    agentId: d?.referralAgentId ? String(d.referralAgentId) : null,
    agent: d?.referralAgentName || d?.referralOperatorName || null,
  };
}

/**
 * Read-only views of one organizer's events for ComBox. Every method first
 * proves the event belongs to the organizer the API key resolved to. Money is
 * in the organizer's own currency (as eventsh's own P&L shows it).
 */
@Injectable()
export class ComboxFeedService {
  constructor(
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
    @InjectModel("Stall") private readonly stallModel: Model<any>,
    @InjectModel("Vendor") private readonly vendorModel: Model<any>,
    @InjectModel("SpeakerRequest") private readonly speakerModel: Model<any>,
    @InjectModel("SponsorRequest") private readonly sponsorModel: Model<any>,
    @InjectModel("WorkshopRequest") private readonly workshopRequestModel: Model<any>,
    @InjectModel("WorkshopBooking") private readonly workshopBookingModel: Model<any>,
    @InjectModel("RoundTableBooking") private readonly roundTableModel: Model<any>,
    @InjectModel("Rsvp") private readonly rsvpModel: Model<any>,
    @InjectModel("ScheduledSpaceRequest") private readonly scheduledModel: Model<any>,
    @InjectModel("Feedback") private readonly feedbackModel: Model<any>,
    @InjectModel("EventExpense") private readonly expenseModel: Model<any>,
    private readonly analytics: AnalyticsService,
    // the event's agents exactly as Eventsh's own Agents tab lists them (codes, usage, share links)
    private readonly eventAgents: EventAgentsService,
  ) {}

  // ---- who and which event -------------------------------------------------

  private async organizer(organizerId: string) {
    const org: any = await this.organizerModel
      .findById(organizerId)
      .select("name organizationName country")
      .lean();
    // the same rule eventsh's own P&L uses: Singapore, else India
    const sg = org?.country === "SG";
    return {
      id: organizerId,
      name: org?.organizationName || org?.name || null,
      country: org?.country || null,
      currency: sg ? "SGD" : "INR",
    };
  }

  async organizerInfo(organizerId: string) {
    return this.organizer(organizerId);
  }

  private async ownEvent(organizerId: string, eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) throw new NotFoundException("Event not found");
    const event: any = await this.eventModel
      .findOne({ _id: eventId, organizer: { $in: [organizerId, new Types.ObjectId(organizerId)] } })
      .select(
        "title description slug eventType category startDate time endDate endTime location address ticketPrice totalTickets visibility status published tags visitorTypes image",
      )
      .lean();
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  /** eventId is stored as ObjectId on most schemas and as a string on a few. */
  private byEvent(eventId: string) {
    return { eventId: { $in: [eventId, new Types.ObjectId(eventId)] } };
  }

  // ---- overview ------------------------------------------------------------

  /** Organizer-wide profit and loss (eventsh's own calculation, event by event). */
  async organizerPnl(organizerId: string) {
    const org = await this.organizer(organizerId);
    const pnl: any = await this.analytics.organizerPnl(organizerId);
    return { currency: org.currency, ...pnl };
  }

  /** Eventsh's own participant count for each event (live bookings, counted as people), so ComBox shows the same numbers as the dashboard. */
  async participantsByEvent(organizerId: string): Promise<Map<string, any>> {
    try {
      const all: any = await this.analytics.organizerParticipants(organizerId);
      return new Map((all?.events || []).map((e: any) => [String(e.eventId), e]));
    } catch {
      return new Map(); // optional: ComBox falls back to counting the table rows
    }
  }

  async eventDetail(organizerId: string, eventId: string) {
    const event = await this.ownEvent(organizerId, eventId);
    const org = await this.organizer(organizerId);
    // a fresh filter for every query: Mongoose rewrites the filter it is given while casting it, so one shared object made later counts match nothing
    const by = () => this.byEvent(eventId);

    const [tickets, exhibitors, speakers, sponsors, workshops, roundtables, rsvp, feedback, expenses, scheduledSpaces] =
      await Promise.all([
        this.ticketModel
          .aggregate([
            { $match: { eventId: new Types.ObjectId(eventId), status: { $in: ["confirmed", "used"] } } },
            { $unwind: "$ticketDetails" },
            { $group: { _id: null, orders: { $addToSet: "$_id" }, quantity: { $sum: "$ticketDetails.quantity" }, checkedIn: { $sum: { $cond: [{ $or: ["$isUsed", "$attendance"] }, "$ticketDetails.quantity", 0] } } } },
          ])
          .exec(),
        this.stallModel.countDocuments(by()),
        this.speakerModel.countDocuments(by()),
        this.sponsorModel.countDocuments(by()),
        this.workshopBookingModel.countDocuments(by()),
        this.roundTableModel.countDocuments(by()),
        this.rsvpModel.countDocuments(by()),
        this.feedbackModel.aggregate([{ $match: { eventId: new Types.ObjectId(eventId) } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } }]).exec(),
        this.expenseModel.countDocuments(by()),
        this.scheduledModel.countDocuments({ eventId: new Types.ObjectId(eventId) }),
      ]);

    // the number of rows each table lists (ComBox's Participants total adds these up, so it matches the tables)
    const [ticketRows, workshopHosts] = await Promise.all([this.ticketModel.countDocuments(by()), this.workshopRequestModel.countDocuments(by())]);
    const agentCount = await this.eventAgents.list(eventId, { userId: organizerId, roles: [] } as any).then((l) => l.length).catch(() => 0);
    const t = tickets[0];
    const f = feedback[0];
    let pnl: any = null;
    try {
      pnl = await this.analytics.eventPnl(eventId);
    } catch {
      pnl = null; // the numbers are optional: the rest of the page still shows
    }

    return {
      currency: org.currency,
      event: {
        id: String(event._id),
        title: event.title,
        description: event.description ?? null,
        eventType: event.eventType ?? null,
        category: event.category ?? null,
        startDate: event.startDate,
        time: event.time ?? null,
        endDate: event.endDate ?? null,
        endTime: event.endTime ?? null,
        location: event.location ?? null,
        address: event.address ?? null,
        status: event.status ?? null,
        published: event.published !== false,
        visibility: event.visibility ?? null,
        totalTickets: event.totalTickets ?? null,
        tiers: (event.visitorTypes || []).map((v: any) => ({
          name: v.name,
          price: v.price,
          maxCount: v.maxCount ?? null,
          active: v.isActive !== false,
        })),
      },
      counts: {
        tickets: t?.quantity ?? 0,
        ticketOrders: t?.orders?.length ?? 0,
        ticketRows,
        workshopHosts,
        checkedIn: t?.checkedIn ?? 0,
        exhibitors,
        speakers,
        sponsors,
        workshops,
        roundtables,
        scheduledSpaces,
        rsvp,
        feedback: f?.count ?? 0,
        feedbackAverage: f?.average ? Math.round(f.average * 10) / 10 : null,
        expenses,
        agents: agentCount,
      },
      pnl,
    };
  }

  // ---- one section as a ready table ----------------------------------------

  async section(organizerId: string, eventId: string, section: FeedSection) {
    await this.ownEvent(organizerId, eventId);
    const org = await this.organizer(organizerId);
    const by = this.byEvent(eventId);
    const out = section === "agents" ? await this.agentsTable(organizerId, eventId, by) : await this.build(section, eventId, by);
    return { currency: org.currency, section, ...out };
  }

  /** The event's agents, as Eventsh's Agents tab shows them, with how many bookings each was credited for. */
  private async agentsTable(organizerId: string, eventId: string, by: any): Promise<{ columns: FeedColumn[]; rows: any[]; summary?: any }> {
    const agents = await this.eventAgents.list(eventId, { userId: organizerId, roles: [] } as any);
    const models: [string, Model<any>][] = [
      ["tickets", this.ticketModel], ["exhibitors", this.stallModel], ["speakers", this.speakerModel],
      ["roundtables", this.roundTableModel], ["scheduled-spaces", this.scheduledModel], ["workshops", this.workshopBookingModel],
    ];
    const perAgent = new Map<string, Record<string, number>>();
    await Promise.all(
      models.map(async ([key, model]) => {
        const grouped: any[] = await model.aggregate([{ $match: { ...by, referralAgentId: { $exists: true, $ne: null } } }, { $group: { _id: "$referralAgentId", n: { $sum: 1 } } }]).exec();
        for (const g of grouped) {
          const id = String(g._id);
          perAgent.set(id, { ...(perAgent.get(id) || {}), [key]: g.n });
        }
      }),
    );
    const rows = agents.map((a) => {
      const by = perAgent.get(a.id) || {};
      const bookings = Object.values(by).reduce((s, n) => s + n, 0);
      return {
        id: a.id,
        name: a.name,
        code: a.referralCode,
        phone: a.whatsAppNumber || null,
        email: a.email || null,
        more: (a.extraContacts || []).map((c) => [c.name, c.phone].filter(Boolean).join(" ")).join("; ") || null,
        bookings,
        breakdown: Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ") || null,
        uses: a.maxUses > 0 ? `${a.usedCount} of ${a.maxUses}` : `${a.usedCount} (no limit)`,
        status: a.isActive ? (a.maxUses > 0 && a.usedCount >= a.maxUses ? "Limit reached" : "Active") : "Paused",
        lastUsed: a.lastUsedAt,
        lastShared: a.lastSharedAt,
        shared: a.shareCount,
        link: a.shareLink,
      };
    });
    const credited = rows.reduce((s, r) => s + r.bookings, 0);
    return {
      columns: [
        { key: "name", label: "Agent" },
        { key: "code", label: "Referral code" },
        { key: "phone", label: "WhatsApp" },
        { key: "email", label: "Email" },
        { key: "bookings", label: "Bookings", format: "number" },
        { key: "uses", label: "Code uses" },
        { key: "status", label: "Status", format: "status" },
        { key: "lastUsed", label: "Last booking", format: "date" },
        { key: "lastShared", label: "Link last sent", format: "date" },
      ],
      rows,
      summary: { agents: rows.length, active: rows.filter((r) => r.status === "Active").length, credited },
    };
  }

  private async build(section: FeedSection, eventId: string, by: any): Promise<{ columns: FeedColumn[]; rows: any[]; summary?: any }> {
    switch (section) {
      case "tickets": {
        const rows: any[] = await this.ticketModel.find(by).sort({ purchaseDate: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "agent", label: "Agent" },
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "WhatsApp" },
            { key: "tickets", label: "Tickets" },
            { key: "quantity", label: "Qty", format: "number" },
            { key: "amount", label: "Amount", format: "money" },
            { key: "status", label: "Status", format: "status" },
            { key: "checkedIn", label: "Checked in", format: "bool" },
            { key: "bought", label: "Bought", format: "date" },
            { key: "source", label: "Via" },
          ],
          rows: rows.map((t) => ({
            id: String(t._id),
            ...agentOf(t),
            name: t.customerName ?? null,
            email: t.customerEmail ?? null,
            phone: t.customerWhatsapp ?? null,
            tickets: (t.ticketDetails || []).map((d: any) => `${d.ticketType} × ${d.quantity}`).join(", "),
            quantity: (t.ticketDetails || []).reduce((s: number, d: any) => s + (d.quantity || 0), 0),
            amount: t.totalAmount ?? 0,
            status: t.status,
            checkedIn: !!(t.isUsed || t.attendance),
            bought: t.purchaseDate ?? t.createdAt,
            source: t.referralOperatorName || t.referralAgentName || null,
          })),
        };
      }

      case "exhibitors": {
        const stalls: any[] = await this.stallModel.find(by).sort({ requestDate: -1 }).limit(MAX_ROWS).lean();
        const ids = [...new Set(stalls.map((s) => String(s.shopkeeperId || "")).filter((x) => Types.ObjectId.isValid(x)))];
        const vendors: any[] = ids.length
          ? await this.vendorModel.find({ _id: { $in: ids } }).select("name email businessEmail phone whatsAppNumber whatsappNumber countryCode phoneNumber").lean()
          : [];
        const v = new Map(vendors.map((x) => [String(x._id), x]));
        return {
          columns: [
            { key: "agent", label: "Agent" },
            { key: "brand", label: "Brand" },
            { key: "applicant", label: "Applicant" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "tables", label: "Tables" },
            { key: "total", label: "Total", format: "money" },
            { key: "paid", label: "Paid", format: "money" },
            { key: "payment", label: "Payment", format: "status" },
            { key: "status", label: "Status", format: "status" },
            { key: "checkedIn", label: "Checked in", format: "bool" },
            { key: "requested", label: "Requested", format: "date" },
          ],
          rows: stalls.map((s) => {
            const x: any = v.get(String(s.shopkeeperId)) || {};
            return {
              id: String(s._id),
              ...agentOf(s),
              brand: s.brandName || s.displayName || null,
              applicant: s.nameOfApplicant || x.name || null,
              email: x.businessEmail || x.email || null,
              phone: x.whatsAppNumber || x.whatsappNumber || `${x.countryCode || ""}${x.phoneNumber || x.phone || ""}` || null,
              tables: (s.selectedTables || []).map((t: any) => t.name).filter(Boolean).join(", "),
              total: s.grandTotal ?? 0,
              paid: s.paymentStatus === "Paid" ? s.grandTotal ?? 0 : s.paidAmount ?? 0,
              payment: s.paymentStatus ?? null,
              status: s.status,
              checkedIn: !!s.hasCheckedIn,
              requested: s.requestDate ?? s.createdAt,
              canApprove: awaitingApproval("exhibitors", s),
              // what decides which organizer actions ComBox offers on the row
              deposit: s.depositTotal ?? 0,
              depositReturned: !!s.depositReturned,
              checkedOut: !!s.hasCheckedOut,
              amendmentPending: !!s.pendingAmendment,
              cancellationRequested: !!s.pendingCancellation,
              cancellationReason: s.pendingCancellation?.reason ?? null,
            };
          }),
        };
      }

      case "speakers": {
        const rows: any[] = await this.speakerModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "agent", label: "Agent" },
            { key: "name", label: "Speaker" },
            { key: "org", label: "Title / Organization" },
            { key: "email", label: "Email" },
            { key: "topics", label: "Topics" },
            { key: "fee", label: "Fee", format: "money" },
            { key: "payment", label: "Payment", format: "status" },
            { key: "status", label: "Status", format: "status" },
            { key: "checkedIn", label: "Checked in", format: "bool" },
          ],
          rows: rows.map((s) => ({
            id: String(s._id),
            ...agentOf(s),
            name: s.name ?? null,
            org: [s.title, s.organization].filter(Boolean).join(", ") || null,
            email: s.email ?? null,
            topics: (s.sessions || []).map((x: any) => x.topic).filter(Boolean).join("; "),
            fee: s.isCharged ? s.fee ?? 0 : 0,
            payment: s.isCharged ? s.paymentStatus : null,
            status: s.status,
            checkedIn: !!s.hasCheckedIn,
            canApprove: awaitingApproval("speakers", s),
          })),
        };
      }

      case "sponsors": {
        const rows: any[] = await this.sponsorModel.find(by).sort({ submittedAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "company", label: "Company" },
            { key: "contact", label: "Contact" },
            { key: "email", label: "Email" },
            { key: "tier", label: "Tier" },
            { key: "amount", label: "Amount", format: "money" },
            { key: "verified", label: "Payment verified", format: "bool" },
            { key: "status", label: "Status", format: "status" },
            { key: "submitted", label: "Applied", format: "date" },
          ],
          rows: rows.map((s) => ({
            id: String(s._id),
            company: s.companyName ?? null,
            contact: s.contactName ?? null,
            email: s.businessEmail || s.email || null,
            tier: s.sponsorTypeName ?? null,
            amount: s.amount ?? 0,
            verified: !!s.paymentVerified,
            status: s.status,
            submitted: s.submittedAt ?? s.createdAt,
            canApprove: awaitingApproval("sponsors", s),
          })),
        };
      }

      case "workshops": {
        const rows: any[] = await this.workshopBookingModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "agent", label: "Agent" },
            { key: "name", label: "Attendee" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "item", label: "Workshop" },
            { key: "quantity", label: "Seats", format: "number" },
            { key: "amount", label: "Amount", format: "money" },
            { key: "payment", label: "Payment", format: "status" },
            { key: "checkedIn", label: "Checked in", format: "bool" },
            { key: "booked", label: "Booked", format: "date" },
          ],
          rows: rows.map((b) => ({
            id: String(b._id),
            ...agentOf(b),
            name: b.visitorName ?? null,
            email: b.visitorEmail ?? null,
            phone: b.visitorPhone ?? null,
            item: b.itemName ?? null,
            quantity: b.quantity ?? 1,
            amount: b.amount ?? 0,
            payment: b.paymentStatus ?? null,
            checkedIn: !!b.hasCheckedIn,
            booked: b.createdAt,
            canApprove: awaitingApproval("workshops", b),
          })),
        };
      }

      case "workshop-hosts": {
        const rows: any[] = await this.workshopRequestModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "host", label: "Host" },
            { key: "email", label: "Email" },
            { key: "workshop", label: "Workshop" },
            { key: "seats", label: "Seats", format: "number" },
            { key: "price", label: "Price", format: "money" },
            { key: "fee", label: "Hosting fee", format: "money" },
            { key: "payment", label: "Fee payment", format: "status" },
            { key: "status", label: "Status", format: "status" },
          ],
          rows: rows.map((w) => ({
            id: String(w._id),
            host: w.hostName ?? null,
            email: w.hostEmail ?? null,
            workshop: w.workshopName ?? null,
            seats: w.maxSeats ?? null,
            price: w.finalPrice || w.proposedPrice || 0,
            fee: w.isCharged ? w.hostingFee ?? 0 : 0,
            isCharged: !!w.isCharged,
            payment: w.isCharged ? w.paymentStatus ?? null : null,
            status: w.status,
          })),
        };
      }

      case "roundtables": {
        const rows: any[] = await this.roundTableModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "agent", label: "Agent" },
            { key: "name", label: "Booked by" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "table", label: "Table" },
            { key: "seats", label: "Seats", format: "number" },
            { key: "amount", label: "Amount", format: "money" },
            { key: "payment", label: "Payment", format: "status" },
            { key: "checkedIn", label: "Checked in", format: "bool" },
          ],
          rows: rows.map((b) => ({
            id: String(b._id),
            ...agentOf(b),
            name: b.visitorName ?? null,
            email: b.visitorEmail ?? null,
            phone: b.visitorPhone ?? null,
            table: b.tableName ?? null,
            seats: b.numberOfSeats ?? (b.selectedChairIndices || []).length,
            amount: b.amount ?? 0,
            payment: b.paymentStatus ?? null,
            checkedIn: !!b.hasCheckedIn,
            canApprove: awaitingApproval("roundtables", b),
          })),
        };
      }

      case "scheduled-spaces": {
        const rows: any[] = await this.scheduledModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "agent", label: "Agent" },
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "facility", label: "Space" },
            { key: "slots", label: "Slots" },
            { key: "people", label: "People", format: "number" },
            { key: "total", label: "Total", format: "money" },
            { key: "paid", label: "Paid", format: "money" },
            { key: "payment", label: "Payment", format: "status" },
            { key: "status", label: "Status", format: "status" },
            { key: "checkedIn", label: "Checked in", format: "bool" },
          ],
          rows: rows.map((r) => ({
            id: String(r._id),
            ...agentOf(r),
            name: r.name ?? null,
            email: r.email ?? null,
            phone: r.phone || r.whatsappNumber || null,
            facility: r.facilityTypeRequested || [...new Set((r.selectedSlots || []).map((s: any) => s.spaceName))].join(", ") || null,
            slots: (r.selectedSlots || []).map((s: any) => `${s.date} ${s.startTime}-${s.endTime}`).join("; "),
            people: r.partySize ?? 1,
            total: r.slotsTotal ?? 0,
            paid: r.paidAmount ?? 0,
            payment: r.paymentStatus ?? null,
            status: r.status ?? null,
            checkedIn: !!r.hasCheckedIn,
          })),
        };
      }

      case "rsvp": {
        const rows: any[] = await this.rsvpModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Contact" },
            { key: "guests", label: "Guests", format: "number" },
            { key: "attending", label: "Attending", format: "bool" },
            { key: "functions", label: "Functions" },
            { key: "message", label: "Message" },
            { key: "at", label: "Replied", format: "date" },
          ],
          rows: rows.map((r) => ({
            id: String(r._id),
            name: r.name ?? null,
            email: r.email ?? null,
            phone: r.contactNumber ?? null,
            guests: r.guestCount ?? 1,
            attending: r.attending !== false,
            functions: (r.functions || []).map((f: any) => f.name).join(", "),
            message: r.message ?? null,
            at: r.createdAt,
          })),
        };
      }

      case "feedback": {
        const rows: any[] = await this.feedbackModel
          .find({ eventId: new Types.ObjectId(eventId) })
          .sort({ createdAt: -1 })
          .limit(MAX_ROWS)
          .lean();
        const avg = rows.length ? rows.reduce((s, r) => s + (r.rating || 0), 0) / rows.length : null;
        return {
          columns: [
            { key: "name", label: "From" },
            { key: "audience", label: "Who" },
            { key: "rating", label: "Rating", format: "number" },
            { key: "comment", label: "Comment" },
            { key: "at", label: "Sent", format: "date" },
          ],
          rows: rows.map((f) => ({ id: String(f._id), name: f.name ?? f.email ?? null, audience: f.audience, rating: f.rating, comment: f.comment ?? null, at: f.createdAt })),
          summary: { count: rows.length, average: avg === null ? null : Math.round(avg * 10) / 10 },
        };
      }

      case "agents":
        // built by agentsTable(), which needs the organizer
        return { columns: [], rows: [] };

      case "expenses": {
        const rows: any[] = await this.expenseModel.find(by).sort({ spentAt: -1 }).limit(MAX_ROWS).lean();
        // a row without a status is an approved one (as in eventsh's own P&L)
        const approved = (r: any) => (r.status || "Approved") === "Approved";
        const byCategory = new Map<string, number>();
        let total = 0;
        let pending = 0;
        for (const r of rows) {
          if (approved(r)) {
            total += r.amount || 0;
            byCategory.set(r.category || "Other", (byCategory.get(r.category || "Other") || 0) + (r.amount || 0));
          } else if (r.status === "Pending") {
            pending += r.amount || 0;
          }
        }
        return {
          columns: [
            { key: "title", label: "Expense" },
            { key: "category", label: "Category" },
            { key: "paidTo", label: "Paid to" },
            { key: "amount", label: "Amount", format: "money" },
            { key: "status", label: "Status", format: "status" },
            { key: "spent", label: "Date", format: "date" },
            { key: "by", label: "Recorded by" },
            { key: "notes", label: "Notes" },
          ],
          rows: rows.map((r) => ({
            id: String(r._id),
            title: r.title ?? null,
            category: r.category ?? null,
            paidTo: r.paidTo ?? null,
            amount: r.amount ?? 0,
            status: r.status || "Approved",
            spent: r.spentAt ?? r.createdAt,
            by: r.recordedBy ?? null,
            notes: r.notes ?? null,
          })),
          summary: {
            total,
            pending,
            byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
          },
        };
      }
    }
  }

  // ---- one row in full (the View dialog) -----------------------------------

  /** Everything Eventsh holds about one exhibitor, speaker or visitor, as groups of fields and a timeline. */
  async rowDetail(organizerId: string, eventId: string, section: string, rowId: string) {
    const ev: any = await this.ownEvent(organizerId, eventId);
    if (!Types.ObjectId.isValid(rowId)) throw new NotFoundException("Not found");
    const org = await this.organizer(organizerId);
    const by = this.byEvent(eventId);
    type F = { label: string; value: any; format?: "money" | "date" | "status" | "bool" | "text" | "link" };
    const keep = (fs: F[]) => fs.filter((f) => f.value !== null && f.value !== undefined && f.value !== "" && !(Array.isArray(f.value) && !f.value.length));
    const timeline: { label: string; at: any; by?: string; note?: string }[] = [];
    const mark = (label: string, at: any, byWho?: string, note?: string) => at && timeline.push({ label, at, by: byWho, note });
    const history = (h: any[]) => (h || []).forEach((x) => mark(`Status: ${x.status}`, x.changedAt, x.changedBy, x.note));
    const sorted = () => timeline.sort((a, b) => +new Date(a.at) - +new Date(b.at));
    // pictures the person uploaded (payment screenshot, logo, photos): paths on Eventsh, shown in ComBox's View dialog
    const images: { label: string; path: string }[] = [];
    const img = (label: string, p: any) => typeof p === "string" && p.startsWith("/") && images.push({ label, path: p });

    if (section === "exhibitors") {
      const s: any = await this.stallModel.findOne({ _id: rowId, ...by }).lean();
      if (!s) throw new NotFoundException("Not found");
      const v: any = s.shopkeeperId && Types.ObjectId.isValid(String(s.shopkeeperId)) ? await this.vendorModel.findById(s.shopkeeperId).lean() : {};
      mark("Request submitted", s.requestDate ?? s.createdAt);
      mark("Request confirmed", s.confirmationDate);
      mark("Tables selected", s.selectionDate);
      mark("Payment submitted", s.paymentSubmittedAt);
      mark("Payment received", s.paymentConfirmedDate ?? s.paymentDate);
      mark("Booking completed", s.completionDate);
      mark("Checked in", s.checkInTime);
      mark("Checked out", s.checkOutTime);
      mark("Deposit returned", s.depositReturnedDate);
      history(s.statusHistory);
      img("Payment screenshot", s.transactionScreenshot);
      img("Edit request payment screenshot", s.pendingAmendment?.transactionScreenshot);
      img("Company logo", s.companyLogo);
      img("Registration document", s.registrationImage);
      (s.productImage || []).forEach((p: any, i: number) => img(`Product photo ${i + 1}`, p));
      return {
        currency: org.currency,
        title: s.brandName || s.displayName || v?.businessName || v?.name || "Exhibitor",
        subtitle: s.nameOfApplicant || v?.name || null,
        status: s.status,
        groups: [
          { title: "Booking", fields: keep([
            { label: "Status", value: s.status, format: "status" }, { label: "Payment", value: s.paymentStatus, format: "status" },
            { label: "Tables", value: (s.selectedTables || []).map((t: any) => t.name || t.tableName).filter(Boolean).join(", ") },
            { label: "Add-ons", value: (s.selectedAddOns || []).map((a: any) => `${a.name} × ${a.quantity}`).join(", ") },
            { label: "Operators", value: s.noOfOperators },
            { label: "Tables total", value: s.tablesTotal, format: "money" }, { label: "Add-ons total", value: s.addOnsTotal, format: "money" },
            { label: "Deposit", value: s.depositTotal, format: "money" }, { label: "Grand total", value: s.grandTotal, format: "money" },
            { label: "Paid", value: s.paymentStatus === "Paid" ? s.grandTotal : s.paidAmount, format: "money" }, { label: "Remaining", value: s.remainingAmount, format: "money" },
            { label: "Payment method", value: s.paymentMethod }, { label: "Transaction ID", value: s.transactionId }, { label: "Payment proof", value: s.transactionScreenshot, format: "link" },
            { label: "Coupon", value: s.couponCodeApplied || s.couponCodeAssigned },
            { label: "Deposit returned", value: s.depositReturned ? true : null, format: "bool" },
            { label: "Checked in", value: !!s.hasCheckedIn, format: "bool" }, { label: "Checked out", value: !!s.hasCheckedOut, format: "bool" },
            { label: "Cancellation reason", value: s.cancellationReason }, { label: "Referred by", value: s.referralOperatorName || s.referralAgentName },
            { label: "Hold timer: pay by", value: s.confirmationDeadline, format: "date" },
          ]) },
          { title: "Exhibitor", fields: keep([
            { label: "Owner name", value: v?.name }, { label: "Registered business name", value: v?.businessName || v?.shopName },
            { label: "Brand", value: s.brandName }, { label: "Display name", value: s.displayName }, { label: "Applicant name", value: s.nameOfApplicant },
            { label: "Primary email", value: v?.email }, { label: "Business email", value: v?.businessEmail },
            { label: "WhatsApp", value: v?.whatsAppNumber || v?.whatsappNumber || [v?.countryCode, v?.phoneNumber || v?.phone].filter(Boolean).join("") },
            { label: "Country / nationality", value: v?.country || s.businessOwnerNationality }, { label: "Owner nationality", value: s.businessOwnerNationality }, { label: "Residency", value: s.residency },
            { label: "Instagram", value: s.instagramLink || v?.instagramLink }, { label: "Facebook", value: s.faceBookLink || v?.faceBookLink },
            { label: "GST number", value: v?.GSTNumber }, { label: "UEN number", value: v?.UENNumber }, { label: "Registration number", value: s.registrationNumber },
            { label: "Business type", value: v?.businessType }, { label: "Category", value: v?.businessCategory },
            { label: "Operators", value: s.noOfOperators }, { label: "Coupon assigned", value: s.couponCodeAssigned },
            { label: "Referral", value: [s.referralCode, s.referralOperatorName || (s.referralAgentName ? `Agent: ${s.referralAgentName}` : "")].filter(Boolean).join(" · ") },
            { label: "Preferred space types", value: (Array.isArray(s.preferredTemplateNames) && s.preferredTemplateNames.length ? s.preferredTemplateNames : s.preferredTemplateName ? [s.preferredTemplateName] : []).map((n: string, k: number) => { const q = Number((s.preferredTemplateQuantities || [])[k]) || 1; return q > 1 ? `${n} × ${q}` : n; }).join(", ") },
            { label: "Business address", value: v?.address || [v?.city, v?.state, v?.pincode, v?.country].filter(Boolean).join(", ") },
            { label: "Refund payment details", value: s.refundPaymentDescription }, { label: "Product description", value: s.productDescription }, { label: "Notes", value: s.notes },
          ]) },
          ...(v?.isGSTVerified && v?.gstDetails ? [{ title: "GST verification (verified)", fields: keep([
            { label: "GSTIN", value: v.gstDetails.gstin }, { label: "Legal name", value: v.gstDetails.legalName }, { label: "Trade name", value: v.gstDetails.tradeName },
            { label: "Status", value: v.gstDetails.status }, { label: "Registered", value: v.gstDetails.registrationDate }, { label: "Constitution", value: v.gstDetails.constitution },
            { label: "State", value: v.gstDetails.state }, { label: "Registered address", value: v.gstDetails.address },
          ]) }] : []),
          ...(v?.isUENVerified && v?.uenDetails ? [{ title: "UEN verification (verified via ACRA)", fields: keep([
            { label: "UEN", value: v.uenDetails.uen }, { label: "Entity name", value: v.uenDetails.entityName }, { label: "Status", value: v.uenDetails.status },
            { label: "Entity type", value: v.uenDetails.entityType }, { label: "Issued", value: v.uenDetails.issueDate }, { label: "Agency", value: v.uenDetails.agency },
            { label: "Registered address", value: v.uenDetails.address },
          ]) }] : []),
          ...(s.pendingAmendment?.status === "paid_pending_confirm" ? [{ title: "Vendor edited this request (approval needed)", fields: keep([
            { label: "Operators", value: `${s.noOfOperators || "-"} → ${s.pendingAmendment.noOfOperators}` },
            { label: "Updated add-ons", value: (s.pendingAmendment.selectedAddOns || []).map((a: any) => `${a.name} × ${a.quantity} (${(a.price || 0) * (a.quantity || 0)})`).join(", ") },
            { label: "Difference paid by vendor", value: s.pendingAmendment.amountDue || 0, format: "money" as const }, { label: "Transaction ID", value: s.pendingAmendment.transactionId },
            { label: "Payment proof", value: s.pendingAmendment.transactionScreenshot, format: "link" as const },
          ]) }] : []),
          ...(s.pendingCancellation?.status === "requested" ? [{ title: "Vendor requested cancellation (decision needed)", fields: keep([{ label: "Reason", value: s.pendingCancellation.reason || "-" }]) }] : []),
          { title: "Event", fields: keep([
            { label: "Event", value: ev?.title }, { label: "Category", value: ev?.category },
            { label: "Dates", value: [ev?.startDate, ev?.endDate].filter(Boolean).map((d: any) => new Date(d).toLocaleDateString()).join(" - ") },
            { label: "Starts at", value: ev?.time }, { label: "Venue", value: [ev?.location, ev?.address].filter(Boolean).join(", ") },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "speakers") {
      const s: any = await this.speakerModel.findOne({ _id: rowId, ...by }).lean();
      if (!s) throw new NotFoundException("Not found");
      mark("Applied", s.createdAt);
      mark("Approved", s.confirmationDate);
      mark("Rejected", s.rejectionDate);
      mark("Paid", s.paymentDate);
      mark("Checked in", s.checkInTime);
      mark("Checked out", s.checkOutTime);
      history(s.statusHistory);
      img("Photo", s.image);
      return {
        currency: org.currency,
        title: s.name || "Speaker",
        subtitle: [s.title, s.organization].filter(Boolean).join(", ") || null,
        status: s.status,
        groups: [
          { title: "Speaker", fields: keep([
            { label: "Status", value: s.status, format: "status" }, { label: "Keynote", value: s.isKeynote ? true : null, format: "bool" },
            { label: "Email", value: s.email }, { label: "Phone", value: s.phone }, { label: "Expertise", value: s.expertise }, { label: "Bio", value: s.bio },
            { label: "LinkedIn", value: s.socialLinks?.linkedin }, { label: "Twitter", value: s.socialLinks?.twitter }, { label: "Website", value: s.socialLinks?.website },
            { label: "Previous speaking", value: s.previousSpeakingExperience }, { label: "Equipment needed", value: s.equipmentNeeded },
            { label: "Applicant notes", value: s.notes }, { label: "Organizer notes", value: s.organizerNotes },
            { label: "Fee", value: s.isCharged ? s.fee : null, format: "money" }, { label: "Payment", value: s.isCharged ? s.paymentStatus : null, format: "status" },
            { label: "Added by", value: s.source }, { label: "Referred by", value: s.referralOperatorName || s.referralAgentName },
            { label: "Checked in", value: !!s.hasCheckedIn, format: "bool" },
          ]) },
          ...(s.sessions || []).map((x: any, i: number) => ({ title: `Session ${i + 1}`, fields: keep([
            { label: "Topic", value: x.topic }, { label: "Description", value: x.description }, { label: "Status", value: x.status, format: "status" },
            { label: "Requested time", value: [x.preferredStartTime, x.preferredEndTime].filter(Boolean).join(" – ") },
            { label: "Confirmed time", value: [x.confirmedStartTime, x.confirmedEndTime].filter(Boolean).join(" – ") }, { label: "Duration (min)", value: x.duration },
          ]) })),
        ].filter((g: any) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "tickets") {
      const t: any = await this.ticketModel.findOne({ _id: rowId, ...by }).lean();
      if (!t) throw new NotFoundException("Not found");
      mark("Ticket bought", t.purchaseDate ?? t.createdAt);
      mark("Checked in", t.usedAt);
      return {
        currency: org.currency,
        title: t.customerName || "Visitor",
        subtitle: t.ticketId || null,
        status: t.status,
        groups: [
          { title: "Ticket", fields: keep([
            { label: "Status", value: t.status, format: "status" }, { label: "Ticket ID", value: t.ticketId },
            { label: "Tickets", value: (t.ticketDetails || []).map((d: any) => `${d.ticketType} × ${d.quantity} @ ${d.price}`).join(", ") },
            { label: "Total", value: t.totalAmount, format: "money" }, { label: "Payment confirmed", value: t.paymentConfirmed, format: "bool" },
            { label: "Coupon", value: t.coupon }, { label: "Checked in", value: !!(t.isUsed || t.attendance), format: "bool" },
            { label: "Referred by", value: t.referralOperatorName || t.referralAgentName }, { label: "Notes", value: t.notes },
          ]) },
          { title: "Visitor", fields: keep([
            { label: "Name", value: t.customerName }, { label: "Email", value: t.customerEmail }, { label: "WhatsApp", value: t.customerWhatsapp },
            { label: "Emergency contact", value: t.customerEmergencyContact },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "sponsors") {
      const x: any = await this.sponsorModel.findOne({ _id: rowId, ...by }).lean();
      if (!x) throw new NotFoundException("Not found");
      mark("Applied", x.submittedAt ?? x.createdAt);
      history(x.statusHistory);
      img("Logo", x.logo);
      img("Payment screenshot", x.transactionScreenshot);
      return {
        currency: org.currency,
        title: x.companyName || "Sponsor",
        subtitle: x.contactName || null,
        status: x.status,
        groups: [
          { title: "Sponsor", fields: keep([
            { label: "Status", value: x.status, format: "status" }, { label: "Company", value: x.companyName }, { label: "Contact", value: x.contactName },
            { label: "Email", value: x.businessEmail || x.email }, { label: "Phone", value: x.phone ? `${x.countryCode || ""}${x.phone}` : null },
            { label: "Website", value: x.website }, { label: "Message", value: x.message }, { label: "Tier", value: x.sponsorTypeName },
            { label: "Applied", value: x.createdAt ?? x.submittedAt, format: "date" },
            { label: "Amount", value: x.collectPayment === false ? "Non-cash" : x.amount, format: x.collectPayment === false ? "text" : "money" },
            { label: "Chosen rewards", value: x.collectPayment === false ? (x.selectedOptions || []).join(", ") : null },
          ]) },
          { title: "Payment", fields: keep([
            { label: "Amount due", value: x.amount, format: "money" }, { label: "Transaction ref", value: x.transactionId },
            { label: "Method", value: x.paymentMethod ? String(x.paymentMethod).replace("_", " ") : null },
            { label: "Payment proof", value: x.transactionScreenshot, format: "link" }, { label: "Payment verified", value: !!x.paymentVerified, format: "bool" },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "scheduled-spaces") {
      const x: any = await this.scheduledModel.findOne({ _id: rowId, eventId: new Types.ObjectId(eventId) }).lean();
      if (!x) throw new NotFoundException("Not found");
      mark("Requested", x.createdAt);
      history(x.statusHistory);
      img("Payment screenshot", x.transactionScreenshot);
      return {
        currency: org.currency,
        title: x.name || "Booking",
        subtitle: x.facilityTypeRequested || null,
        status: x.status,
        // what Eventsh's own dialog tells the organizer at each step
        notice: (() => {
          const free = (x.slotsTotal || 0) === 0;
          switch (x.status) {
            case "Pending": return { tone: "info", text: "Waiting for your approval. Approve it so the registrant can pick a space and slot, or reject it." };
            case "Confirmed": return { tone: "info", text: "Approved - waiting for the registrant to pick a space & slot and submit payment." };
            case "Processing": return { tone: "warn", text: free ? "Waiting for your approval. Approve the booking to issue the QR ticket." : "Payment submitted. Confirm the payment to issue the QR ticket." };
            case "Completed": return { tone: "success", text: x.hasCheckedIn ? `Checked in at ${x.checkInTime ? new Date(x.checkInTime).toLocaleString() : ""}`.trim() : "Confirmed - not checked in yet. The QR ticket was issued." };
            case "Rejected": return { tone: "danger", text: x.cancellationReason || "This request was rejected." };
            case "Cancelled": return { tone: "danger", text: x.cancellationReason || "This booking was cancelled." };
            default: return null;
          }
        })(),
        // the check-in QR (a ready image), once the ticket is issued
        qr: x.status === "Completed" && typeof x.qrCodeImage === "string" && x.qrCodeImage.startsWith("data:image/") ? x.qrCodeImage : null,
        groups: [
          { title: "Booking", fields: keep([
            { label: "Status", value: x.status, format: "status" }, { label: "Payment", value: x.paymentStatus, format: "status" },
            { label: "Space", value: x.facilityTypeRequested || [...new Set((x.selectedSlots || []).map((t: any) => t.spaceName))].join(", ") },
            { label: "People", value: x.partySize ?? 1 }, { label: "Total", value: x.slotsTotal, format: "money" }, { label: "Paid", value: x.paidAmount, format: "money" },
            { label: "Transaction ID", value: x.transactionId }, { label: "Payment method", value: x.paymentMethod }, { label: "Payment proof", value: x.transactionScreenshot, format: "link" },
            { label: "Checked in", value: x.hasCheckedIn ? `Checked in ${x.checkInTime ? new Date(x.checkInTime).toLocaleString() : ""}`.trim() : "Not yet" },
            { label: "Cancellation reason", value: x.cancellationReason },
          ]) },
          { title: "Selected slots", fields: (x.selectedSlots || []).map((t: any) => ({
            label: `${t.spaceName || "Slot"}${t.slotLabel ? ` (${t.slotLabel})` : ""}`,
            value: `${t.date} ${t.startTime}-${t.endTime}${t.persons > 0 ? ` · ${t.persons} of ${t.maxPersons} seats` : ""} · ${t.price ?? 0}`,
          })) },
          { title: "Registrant", fields: keep([
            { label: "Name", value: x.name }, { label: "Email", value: x.email }, { label: "WhatsApp", value: x.whatsappNumber }, { label: "Phone", value: x.phone },
            { label: "Space type", value: x.facilityTypeRequested }, { label: "Organization", value: x.organization }, { label: "Purpose", value: x.purpose },
            { label: "Coming with", value: (x.companions || []).join(", ") },
            ...(x.customAnswers || []).map((a: any) => ({ label: a.label, value: a.value })),
            { label: "Referred by", value: [x.referralCode, x.referralOperatorName || (x.referralAgentName ? `Agent: ${x.referralAgentName}` : "")].filter(Boolean).join(" · ") },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "roundtables") {
      const b: any = await this.roundTableModel.findOne({ _id: rowId, ...by }).lean();
      if (!b) throw new NotFoundException("Not found");
      mark("Booked", b.createdAt);
      mark("Checked in", b.checkInTime);
      mark("Checked out", b.checkOutTime);
      (b.referralHistory || []).forEach((h: any) => mark("Referral changed", h.changedAt, h.changedBy, h.note));
      const chairs: number[] = b.selectedChairIndices || [];
      const guests = chairs.map((c) => {
        const g = (b.seatGuests || []).find((x: any) => x.chairIndex === c);
        return { label: `Chair ${c + 1}`, value: g?.name ? [g.name, g.whatsApp, g.email].filter(Boolean).join(" · ") : "Not assigned" } as F;
      });
      return {
        currency: org.currency,
        title: b.tableName || "Round table booking",
        subtitle: b.visitorName || null,
        status: b.paymentStatus,
        groups: [
          { title: "Visitor", fields: keep([{ label: "Name", value: b.visitorName }, { label: "Email", value: b.visitorEmail }, { label: "Phone", value: b.visitorPhone }]) },
          { title: "Table", fields: keep([
            { label: "Table", value: b.tableName }, { label: "Category", value: b.tableCategory },
            { label: "Booked as", value: b.isWholeTable ? "Whole table" : "Individual chairs" }, { label: "Seats", value: b.numberOfSeats ?? chairs.length },
            { label: "Chairs", value: chairs.map((c) => c + 1).join(", ") }, { label: "Seats to be allotted", value: b.allotmentPending ? true : null, format: "bool" },
          ]) },
          { title: "Guest details", fields: guests },
          { title: "Payment & status", fields: keep([
            { label: "Amount", value: b.amount, format: "money" }, { label: "Payment", value: b.paymentStatus, format: "status" },
            { label: "Referred by", value: [b.referralCode, b.referralOperatorName || (b.referralAgentName ? `Agent: ${b.referralAgentName}` : "")].filter(Boolean).join(" · ") },
            { label: "Checked in", value: b.hasCheckedIn ? (b.hasCheckedOut ? "Checked out" : "Checked in") : "Not yet" },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "workshops") {
      const b: any = await this.workshopBookingModel.findOne({ _id: rowId, ...by }).lean();
      if (!b) throw new NotFoundException("Not found");
      mark("Booked", b.createdAt);
      mark("Checked in", b.checkInTime);
      (b.referralHistory || []).forEach((h: any) => mark("Referral changed", h.changedAt, h.changedBy, h.note));
      return {
        currency: org.currency,
        title: b.itemName || "Workshop booking",
        subtitle: b.visitorName || null,
        status: b.paymentStatus,
        groups: [
          { title: "Attendee", fields: keep([{ label: "Name", value: b.visitorName }, { label: "Email", value: b.visitorEmail }, { label: "Phone", value: b.visitorPhone }]) },
          { title: "Booking", fields: keep([
            { label: "Workshop", value: b.itemName }, { label: "Type", value: b.bookingType }, { label: "Seats", value: b.quantity },
            { label: "Amount", value: b.amount, format: "money" }, { label: "Payment", value: b.paymentStatus, format: "status" },
            { label: "Referred by", value: [b.referralCode, b.referralOperatorName || (b.referralAgentName ? `Agent: ${b.referralAgentName}` : "")].filter(Boolean).join(" · ") },
            { label: "Checked in", value: !!b.hasCheckedIn, format: "bool" },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    if (section === "workshop-hosts") {
      const w: any = await this.workshopRequestModel.findOne({ _id: rowId, ...by }).lean();
      if (!w) throw new NotFoundException("Not found");
      mark("Applied", w.createdAt);
      mark("Approved", w.confirmationDate);
      mark("Rejected", w.rejectionDate);
      mark("Hosting fee paid", w.paymentDate);
      history(w.statusHistory);
      img("Host photo", w.hostImage);
      return {
        currency: org.currency,
        title: w.workshopName || "Workshop",
        subtitle: w.hostName ? `Applied by ${w.hostName}` : null,
        status: w.status,
        groups: [
          { title: "Host", fields: keep([{ label: "Name", value: w.hostName }, { label: "Email", value: w.hostEmail }, { label: "Phone", value: w.hostPhone }, { label: "About the host", value: w.hostBio }]) },
          { title: "Payout account", fields: keep([{ label: "Account name", value: w.hostAccountName }, { label: "Account details", value: w.hostAccountDetails }]) },
          { title: "Workshop", fields: keep([
            { label: "Status", value: w.status, format: "status" }, { label: "Description", value: w.workshopDescription },
            { label: "Proposed price", value: w.proposedPrice, format: "money" }, { label: "Visitor price", value: w.finalPrice, format: "money" },
            { label: "Max seats", value: w.maxSeats }, { label: "Time", value: [w.proposedStartTime, w.proposedEndTime].filter(Boolean).join(" - ") },
            { label: "Hosting fee", value: w.isCharged ? w.hostingFee : null, format: "money" }, { label: "Fee payment", value: w.isCharged ? w.paymentStatus : null, format: "status" },
            { label: "Organizer notes", value: w.organizerNotes },
          ]) },
        ].filter((g) => g.fields.length),
        timeline: sorted(),
        images,
      };
    }

    throw new NotFoundException("Not found");
  }
}
