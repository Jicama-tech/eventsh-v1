import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AnalyticsService } from "../analytics/analytics.service";
import { awaitingApproval } from "./combox-payments.service";

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
] as const;
export type FeedSection = (typeof FEED_SECTIONS)[number];

const MAX_ROWS = 1000;

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

  async eventDetail(organizerId: string, eventId: string) {
    const event = await this.ownEvent(organizerId, eventId);
    const org = await this.organizer(organizerId);
    const by = this.byEvent(eventId);

    const [tickets, exhibitors, speakers, sponsors, workshops, roundtables, rsvp, feedback, expenses, scheduledSpaces] =
      await Promise.all([
        this.ticketModel
          .aggregate([
            { $match: { eventId: new Types.ObjectId(eventId), status: { $in: ["confirmed", "used"] } } },
            { $unwind: "$ticketDetails" },
            { $group: { _id: null, orders: { $addToSet: "$_id" }, quantity: { $sum: "$ticketDetails.quantity" }, checkedIn: { $sum: { $cond: [{ $or: ["$isUsed", "$attendance"] }, "$ticketDetails.quantity", 0] } } } },
          ])
          .exec(),
        this.stallModel.countDocuments(by),
        this.speakerModel.countDocuments(by),
        this.sponsorModel.countDocuments(by),
        this.workshopBookingModel.countDocuments(by),
        this.roundTableModel.countDocuments(by),
        this.rsvpModel.countDocuments(by),
        this.feedbackModel.aggregate([{ $match: { eventId: new Types.ObjectId(eventId) } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } }]).exec(),
        this.expenseModel.countDocuments(by),
        this.scheduledModel.countDocuments(by),
      ]);

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
      },
      pnl,
    };
  }

  // ---- one section as a ready table ----------------------------------------

  async section(organizerId: string, eventId: string, section: FeedSection) {
    await this.ownEvent(organizerId, eventId);
    const org = await this.organizer(organizerId);
    const by = this.byEvent(eventId);
    const out = await this.build(section, eventId, by);
    return { currency: org.currency, section, ...out };
  }

  private async build(section: FeedSection, eventId: string, by: any): Promise<{ columns: FeedColumn[]; rows: any[]; summary?: any }> {
    switch (section) {
      case "tickets": {
        const rows: any[] = await this.ticketModel.find(by).sort({ purchaseDate: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
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
            };
          }),
        };
      }

      case "speakers": {
        const rows: any[] = await this.speakerModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
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
            status: w.status,
          })),
        };
      }

      case "roundtables": {
        const rows: any[] = await this.roundTableModel.find(by).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();
        return {
          columns: [
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
}
