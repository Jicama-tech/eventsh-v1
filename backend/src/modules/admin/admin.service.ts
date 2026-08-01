import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PaymentsService } from "../payments/payments.service";
import { CreateAdminDto } from "./dto/create-admin.dto";
import { InjectModel } from "@nestjs/mongoose/dist";
import { Admin } from "./entities/admin.entity";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { LoginDto } from "./dto/login.dto";
import { Organizer } from "../organizers/schemas/organizer.schema";
import { User } from "../users/schemas/user.schema";
import { Event } from "../events/schemas/event.schema";
import { Ticket } from "../tickets/entities/ticket.entity";
import { Plan } from "../plans/entities/plan.entity";
import { Agent } from "../agents/schemas/agent.schema";
import { MailService } from "../roles/mail.service";
import {
  billForCategory,
  defaultPlanForCountry,
  hasAnyOverride,
  resolveEffectiveRates,
  resolvePlanForCountry,
} from "./billing-rate-calc.util";
import { toIso2, currencyForCountry } from "../../common/currency.util";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Organizer.name) private organizerModel: Model<Organizer>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(Agent.name) private agentModel: Model<Agent>,
    @InjectModel("Operator") private operatorModel: Model<any>,
    @InjectModel("Vendor") private vendorModel: Model<any>,
    @InjectModel("SpeakerRequest") private speakerRequestModel: Model<any>,
    @InjectModel("OrganizerPayment") private organizerPaymentModel: Model<any>,
    @InjectModel("PlatformBillingRates")
    private platformBillingRatesModel: Model<any>,
    @InjectModel("OrganizerBillingRateOverride")
    private organizerRateOverrideModel: Model<any>,
    @InjectModel("PaymentConfig")
    private paymentConfigModel: Model<any>,
    // Active-membership count drives the per-organizer membership fee
    // shown on the billing dialog. Injected by name to avoid pulling the
    // memberships module's typed schema into the admin module.
    @InjectModel("ExhibitorMembership")
    private exhibitorMembershipModel: Model<any>,
    // Confirmed rows in these two collections are the only money the
    // platform itself actually receives (organizer ticket/stall sales
    // pass through the organizer's own account, not ours) — the
    // dashboard's per-currency "money received" breakdown is built
    // straight from them since both already carry a `currency` field.
    @InjectModel("PendingBillingPayment")
    private pendingBillingPaymentModel: Model<any>,
    @InjectModel("PendingSubscriptionPayment")
    private pendingSubscriptionPaymentModel: Model<any>,
    // Confirmed Token top-ups are the go-forward replacement for
    // PendingBillingPayment as an organizer-fee revenue source — both are
    // unioned into revenueByCurrency below so the cutover doesn't show a
    // dip on the dashboard.
    @InjectModel("TokenTopUpRequest")
    private tokenTopUpRequestModel: Model<any>,
    // Workshop/sponsor/supplier billing categories — same per-event
    // aggregation pattern as speakers.
    @InjectModel("WorkshopBooking")
    private workshopBookingModel: Model<any>,
    @InjectModel("SponsorRequest")
    private sponsorRequestModel: Model<any>,
    @InjectModel("SupplierRequest")
    private supplierRequestModel: Model<any>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly paymentsService: PaymentsService
  ) {}

  // ===========================================================================
  //  Super-admin billing — per-organizer aggregation + payment ledger.
  //  Rates are managed as PLANS, one per country plus a fallback plan
  //  (countryCode: null) used for any country without its own plan — see
  //  /admin/billing-rates/plans and /admin/billing-rates/organizer/:id
  //  (per-organizer overrides). Defaults if no plan exists yet: $20/stall,
  //  $20/round-table, $5/chair (additive: a fully booked 8-chair table is
  //  $20+$40), $20/Confirmed SpeakerRequest, $5/active membership. Each
  //  category is flat $ or rate% of that item's own price — see
  //  billing-rate-calc.util.ts. A country plan's currency always follows
  //  that country (currencyForCountry); only the fallback plan's currency
  //  is admin-editable.
  // ===========================================================================

  private static readonly BUILT_IN_PLAN_COUNTRIES = ["SG", "IN"];

  /**
   * Returns every billing-rate plan (fallback + all country plans),
   * seeding the fallback and the built-in Singapore/India plans on first
   * read so they always exist without a manual migration step.
   */
  async getBillingRatePlans() {
    let docs: any[] = await this.platformBillingRatesModel.find({}).lean();
    // Only seed the built-in Singapore/India plans on a genuinely empty
    // collection (first-ever load). Once any plan exists, an admin may
    // have deliberately removed a built-in one — re-seeding it here would
    // undo that delete on every subsequent read.
    const isFirstEverLoad = docs.length === 0;
    const have = new Set(docs.map((d) => d.countryCode ?? null));
    const toSeed: (string | null)[] = [];
    if (!have.has(null)) toSeed.push(null);
    if (isFirstEverLoad) {
      for (const cc of AdminService.BUILT_IN_PLAN_COUNTRIES) {
        if (!have.has(cc)) toSeed.push(cc);
      }
    }
    if (toSeed.length) {
      await this.platformBillingRatesModel.insertMany(
        toSeed.map((cc) => defaultPlanForCountry(cc)),
      );
      docs = await this.platformBillingRatesModel.find({}).lean();
    }
    return docs
      .map((doc) => ({
        ...resolveEffectiveRates(doc, null),
        countryCode: doc.countryCode ?? null,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
      }))
      .sort((a, b) => {
        // Fallback plan always first, then alphabetically by country code.
        if (a.countryCode === b.countryCode) return 0;
        if (a.countryCode === null) return -1;
        if (b.countryCode === null) return 1;
        return a.countryCode.localeCompare(b.countryCode);
      });
  }

  /** Creates a new country plan, seeded with default rates + that country's currency. */
  async addBillingRatePlan(countryCode: string) {
    const iso2 = toIso2(countryCode);
    if (!iso2) {
      throw new ConflictException("Unrecognized country code");
    }
    const existing = await this.platformBillingRatesModel
      .findOne({ countryCode: iso2 })
      .lean();
    if (existing) {
      throw new ConflictException(`A plan for ${iso2} already exists`);
    }
    await this.platformBillingRatesModel.create(defaultPlanForCountry(iso2));
    return this.getBillingRatePlans();
  }

  /**
   * Upsert one plan's rates, keyed by countryCode ("DEFAULT" sentinel for
   * the fallback plan). Negative or non-numeric values are rejected;
   * missing keys keep their current (or default) value. A country plan's
   * currency is always recomputed from the country, ignoring any
   * client-sent currency; the fallback plan's currency stays editable.
   */
  async updateBillingRatePlan(
    countryCodeParam: string,
    body: {
      moneyInRate?: number;
      moneyInRateMode?: string;
      moneyOutRate?: number;
      moneyOutRateMode?: string;
      currency?: string;
    },
    adminId?: string,
  ) {
    const isFallback = countryCodeParam === "DEFAULT";
    const countryCode = isFallback ? null : toIso2(countryCodeParam);
    if (!isFallback && !countryCode) {
      throw new ConflictException("Unrecognized country code");
    }

    const validNumber = (v: any): number | undefined => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new ConflictException(
          "Rates must be non-negative numbers",
        );
      }
      return n;
    };
    const validMode = (v: any): string | undefined => {
      if (v === undefined || v === null || v === "") return undefined;
      if (v !== "flat" && v !== "percent") {
        throw new ConflictException('Rate mode must be "flat" or "percent"');
      }
      return v;
    };
    const update: any = { $set: {} };
    const rateFields: Array<[string, string]> = [
      ["moneyInRate", "moneyInRateMode"],
      ["moneyOutRate", "moneyOutRateMode"],
    ];
    for (const [rateKey, modeKey] of rateFields) {
      const n = validNumber((body as any)[rateKey]);
      if (n !== undefined) update.$set[rateKey] = n;
      const m = validMode((body as any)[modeKey]);
      if (m !== undefined) update.$set[modeKey] = m;
    }
    if (isFallback) {
      if (body.currency && typeof body.currency === "string") {
        update.$set.currency = body.currency.slice(0, 6).toUpperCase();
      }
    } else {
      // Country plans never take a client-sent currency — always derived.
      update.$set.currency = currencyForCountry(countryCode).code;
    }
    if (adminId) update.$set.updatedBy = adminId;

    await this.platformBillingRatesModel.updateOne(
      { countryCode },
      update,
      { upsert: true },
    );
    return this.getBillingRatePlans();
  }

  /** Removes a country-specific plan (the fallback plan can't be deleted). */
  async deleteBillingRatePlan(countryCodeParam: string) {
    if (countryCodeParam === "DEFAULT") {
      throw new ConflictException("The default plan can't be removed");
    }
    const countryCode = toIso2(countryCodeParam);
    if (!countryCode) {
      throw new ConflictException("Unrecognized country code");
    }
    await this.platformBillingRatesModel.deleteOne({ countryCode });
    return this.getBillingRatePlans();
  }

  // ===========================================================================
  //  Per-organizer billing-rate overrides. A category left unset on the
  //  override doc inherits the platform default for that category — see
  //  billing-rate-calc.util.ts resolveEffectiveRates.
  // ===========================================================================

  /** Organizer picker list for the "Per-organizer overrides" table. */
  async getBillingRateOrganizers() {
    const [organizers, overrides] = await Promise.all([
      this.organizerModel
        .find({})
        .select("name organizationName email country")
        .sort({ name: 1 })
        .lean(),
      this.organizerRateOverrideModel.find({}).lean(),
    ]);
    const overrideByOrg = new Map<string, any>(
      (overrides as any[]).map((o: any) => [String(o.organizerId), o]),
    );
    return (organizers as any[]).map((o: any) => ({
      _id: String(o._id),
      name: o.name,
      organizationName: o.organizationName,
      email: o.email,
      country: o.country,
      hasOverride: hasAnyOverride(overrideByOrg.get(String(o._id))),
    }));
  }

  /** Effective + raw-override + platform-default rates for one organizer. */
  async getOrganizerBillingRateOverride(organizerId: string) {
    const organizer = await this.organizerModel
      .findById(organizerId)
      .select("country")
      .lean();
    if (!organizer) throw new NotFoundException("Organizer not found");
    await this.getBillingRatePlans(); // ensures fallback/SG/IN are seeded
    const [plans, overrideDoc] = await Promise.all([
      this.platformBillingRatesModel.find({}).lean(),
      this.organizerRateOverrideModel.findOne({ organizerId }).lean(),
    ]);
    const plan = resolvePlanForCountry(plans, (organizer as any).country);
    return {
      effective: resolveEffectiveRates(plan, overrideDoc),
      default: resolveEffectiveRates(plan, null),
      override: overrideDoc
        ? {
            moneyInRate: (overrideDoc as any).moneyInRate ?? null,
            moneyInRateMode: (overrideDoc as any).moneyInRateMode ?? null,
            moneyOutRate: (overrideDoc as any).moneyOutRate ?? null,
            moneyOutRateMode: (overrideDoc as any).moneyOutRateMode ?? null,
          }
        : null,
    };
  }

  /**
   * Upsert an organizer's rate overrides. A category omitted from the body
   * clears that category's override (falls back to inherit). Passing `null`
   * for a rate has the same clearing effect as omitting it.
   */
  async updateOrganizerBillingRateOverride(
    organizerId: string,
    body: {
      moneyInRate?: number | null;
      moneyInRateMode?: string | null;
      moneyOutRate?: number | null;
      moneyOutRateMode?: string | null;
    },
    adminId?: string,
  ) {
    const organizer = await this.organizerModel.findById(organizerId).lean();
    if (!organizer) throw new NotFoundException("Organizer not found");

    const validNumber = (v: any): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new ConflictException("Rates must be non-negative numbers");
      }
      return n;
    };
    const validMode = (v: any): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      if (v !== "flat" && v !== "percent") {
        throw new ConflictException('Rate mode must be "flat" or "percent"');
      }
      return v;
    };

    const set: any = {};
    const unset: any = {};
    const rateFields = [
      "moneyInRate",
      "moneyInRateMode",
      "moneyOutRate",
      "moneyOutRateMode",
    ] as const;
    for (const key of rateFields) {
      const isMode = key.endsWith("Mode");
      const v = isMode ? validMode((body as any)[key]) : validNumber((body as any)[key]);
      if (v === undefined) continue;
      if (v === null) unset[key] = "";
      else set[key] = v;
    }
    if (adminId) set.updatedBy = adminId;

    const update: any = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (Object.keys(update).length === 0) {
      return this.getOrganizerBillingRateOverride(organizerId);
    }

    await this.organizerRateOverrideModel.updateOne(
      { organizerId },
      update,
      { upsert: true },
    );
    return this.getOrganizerBillingRateOverride(organizerId);
  }

  /** Resets every category for this organizer back to the platform default. */
  async deleteOrganizerBillingRateOverride(organizerId: string) {
    await this.organizerRateOverrideModel.deleteOne({ organizerId });
    return this.getOrganizerBillingRateOverride(organizerId);
  }

  /**
   * Returns the full billing snapshot for an organizer:
   *  - their basic profile
   *  - per-event counts (stalls/tables/chairs/speakers + amount)
   *  - totals: billable, paid, owed
   *  - payment ledger (most recent first)
   */
  async getOrganizerBilling(organizerId: string) {
    const organizer = await this.organizerModel
      .findById(organizerId)
      .select("name organizationName email businessEmail country createdAt")
      .lean();
    if (!organizer) throw new NotFoundException("Organizer not found");

    // Pull the plan matching this organizer's country, merged with their
    // per-category overrides (if any) — see billing-rate-calc.util.ts.
    await this.getBillingRatePlans(); // ensures fallback/SG/IN are seeded
    const [plans, rateOverrideDoc] = await Promise.all([
      this.platformBillingRatesModel.find({}).lean(),
      this.organizerRateOverrideModel.findOne({ organizerId }).lean(),
    ]);
    const plan = resolvePlanForCountry(plans, (organizer as any).country);
    const rates = resolveEffectiveRates(plan, rateOverrideDoc);

    // Pull all events for this organizer once. We compute stall / round-table
    // counts directly from the embedded arrays — no aggregation pipeline needed
    // because the data lives on the event doc.
    const events = await this.eventModel
      .find({ organizer: organizerId })
      .select(
        "title startDate endDate venueTables venueRoundTables status",
      )
      .lean();

    // Confirmed speakers grouped by event, carrying `fee` so percent-mode
    // rates have a price to apply to (flat mode only needs the count).
    const speakerDocs: Array<{ eventId: any; fee?: number }> =
      await this.speakerRequestModel
        .find({
          organizerId: new (require("mongoose").Types.ObjectId)(organizerId),
          status: "Confirmed",
        })
        .select("eventId fee")
        .lean();
    const speakersByEvent = new Map<string, any[]>();
    for (const s of speakerDocs) {
      const k = String(s.eventId);
      if (!speakersByEvent.has(k)) speakersByEvent.set(k, []);
      speakersByEvent.get(k)!.push(s);
    }

    // Paid workshop bookings, confirmed sponsors, and paid supplier
    // requests — all three are per-event, same grouping pattern as
    // speakers above.
    const orgObjectId = new (require("mongoose").Types.ObjectId)(organizerId);
    const [ticketDocs, workshopDocs, sponsorDocs, supplierDocs] =
      await Promise.all([
        this.ticketModel
          .find({
            organizerId: orgObjectId,
            paymentConfirmed: true,
            status: { $ne: "cancelled" },
          })
          .select("eventId totalAmount")
          .lean(),
        this.workshopBookingModel
          .find({ organizerId: orgObjectId, paymentStatus: "Paid" })
          .select("eventId amount")
          .lean(),
        this.sponsorRequestModel
          .find({ organizerId: orgObjectId, status: "Confirmed" })
          .select("eventId amount")
          .lean(),
        this.supplierRequestModel
          .find({ organizerId: orgObjectId, status: "Paid" })
          .select("eventId agreedTotal quotationTotal")
          .lean(),
      ]);
    const groupByEvent = (docs: any[]) => {
      const map = new Map<string, any[]>();
      for (const d of docs) {
        const k = String(d.eventId);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(d);
      }
      return map;
    };
    const ticketsByEvent = groupByEvent(ticketDocs);
    const workshopsByEvent = groupByEvent(workshopDocs);
    const sponsorsByEvent = groupByEvent(sponsorDocs);
    const suppliersByEvent = groupByEvent(supplierDocs);

    // venueTables / venueRoundTables can be either flat arrays (legacy/canonical
    // schema) or `Record<configId, item[]>` (the shape the create-event form
    // ships). Flatten defensively so older AND newer events both work.
    const flatten = (v: any): any[] => {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") {
        return Object.values(v).flat() as any[];
      }
      return [];
    };

    const eventRows = events.map((e: any) => {
      const tables = flatten(e.venueTables);
      const rounds = flatten(e.venueRoundTables);
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
      const speakers = speakersByEvent.get(String(e._id)) || [];
      const workshops = workshopsByEvent.get(String(e._id)) || [];
      const sponsors = sponsorsByEvent.get(String(e._id)) || [];
      const suppliers = suppliersByEvent.get(String(e._id)) || [];
      const tickets = ticketsByEvent.get(String(e._id)) || [];
      const amount =
        billForCategory(tickets, rates.moneyInRate, rates.moneyInRateMode, (t: any) => t.totalAmount) +
        billForCategory(bookedStalls, rates.moneyInRate, rates.moneyInRateMode, (t: any) => t.tablePrice) +
        billForCategory(bookedRoundTables, rates.moneyInRate, rates.moneyInRateMode, (rt: any) => rt.tablePrice) +
        billForCategory(bookedChairs, rates.moneyInRate, rates.moneyInRateMode, (c: any) => c.chairPrice) +
        billForCategory(speakers, rates.moneyInRate, rates.moneyInRateMode, (s: any) => s.fee) +
        billForCategory(workshops, rates.moneyInRate, rates.moneyInRateMode, (w: any) => w.amount) +
        billForCategory(sponsors, rates.moneyInRate, rates.moneyInRateMode, (s: any) => s.amount) +
        billForCategory(suppliers, rates.moneyOutRate, rates.moneyOutRateMode, (s: any) => s.agreedTotal ?? s.quotationTotal);
      return {
        eventId: String(e._id),
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        ticketsSold: tickets.length,
        stallsSold: bookedStalls.length,
        tablesBooked: bookedRoundTables.length,
        chairsBooked: bookedChairs.length,
        speakersBooked: speakers.length,
        workshopsBooked: workshops.length,
        sponsorsConfirmed: sponsors.length,
        suppliersConfirmed: suppliers.length,
        amount,
      };
    });

    const eventsBillable = eventRows.reduce((s, r) => s + r.amount, 0);

    // Memberships are organizer-scoped (not per-event) — one row per active
    // ExhibitorMembership, billed flat or at rate% of that row's own
    // amountPaid.
    const activeMemberships: Array<{ amountPaid?: number }> =
      await this.exhibitorMembershipModel
        .find({
          organizerId: new (require("mongoose").Types.ObjectId)(organizerId),
          status: "active",
        })
        .select("amountPaid")
        .lean();
    const activeMembershipCount = activeMemberships.length;
    const membershipsAmount = billForCategory(
      activeMemberships,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (m: any) => m.amountPaid,
    );
    const totalBillable = eventsBillable + membershipsAmount;

    const payments = await this.organizerPaymentModel
      .find({ organizerId })
      .sort({ paidOn: -1 })
      .lean();
    const totalPaid = payments.reduce(
      (s: number, p: any) => s + (Number(p.amount) || 0),
      0,
    );

    return {
      organizer: {
        _id: String(organizer._id),
        name: organizer.name,
        organizationName: organizer.organizationName,
        email: organizer.email || organizer.businessEmail,
        country: organizer.country,
        createdAt: organizer.createdAt,
      },
      rates: {
        moneyIn: rates.moneyInRate,
        moneyInMode: rates.moneyInRateMode,
        moneyOut: rates.moneyOutRate,
        moneyOutMode: rates.moneyOutRateMode,
        currency: rates.currency,
        hasOverride: hasAnyOverride(rateOverrideDoc),
      },
      events: eventRows,
      memberships: {
        active: activeMembershipCount,
        amount: membershipsAmount,
      },
      totals: {
        eventsBillable,
        membershipsBillable: membershipsAmount,
        billable: totalBillable,
        paid: totalPaid,
        owed: Math.max(0, totalBillable - totalPaid),
      },
      payments: payments.map((p: any) => ({
        _id: String(p._id),
        amount: p.amount,
        paidOn: p.paidOn,
        note: p.note || "",
        recordedBy: p.recordedBy ? String(p.recordedBy) : null,
      })),
    };
  }

  /**
   * Get the per-event drill-down: which specific stalls / tables / speakers
   * make up the counts for an event. Used by the second-level dialog.
   */
  async getEventBookingBreakdown(organizerId: string, eventId: string) {
    const event = await this.eventModel
      .findOne({ _id: eventId, organizer: organizerId })
      .select("title startDate endDate venueTables venueRoundTables")
      .lean();
    if (!event) throw new NotFoundException("Event not found for organizer");

    const flatten = (v: any): any[] => {
      if (Array.isArray(v)) return v;
      if (v && typeof v === "object") return Object.values(v).flat() as any[];
      return [];
    };

    const stalls = flatten((event as any).venueTables)
      .filter((t: any) => !!t?.isBooked)
      .map((t: any) => ({
        positionId: t.positionId,
        name: t.tableName || t.name,
        bookedBy: t.bookedBy || null,
      }));

    const rounds = flatten((event as any).venueRoundTables)
      .filter(
        (rt: any) =>
          !!rt?.isFullyBooked ||
          (Array.isArray(rt?.bookedChairs) && rt.bookedChairs.length > 0),
      )
      .map((rt: any) => ({
        positionId: rt.positionId,
        name: rt.name,
        chairs: Array.isArray(rt.bookedChairs) ? rt.bookedChairs.length : 0,
        isFullyBooked: !!rt.isFullyBooked,
      }));

    const speakers = await this.speakerRequestModel
      .find({
        organizerId,
        eventId,
        status: "Confirmed",
      })
      .select("speakerName speakerEmail status updatedAt")
      .lean();

    return {
      event: {
        _id: String((event as any)._id),
        title: (event as any).title,
        startDate: (event as any).startDate,
        endDate: (event as any).endDate,
      },
      stalls,
      rounds,
      speakers: speakers.map((s: any) => ({
        _id: String(s._id),
        name: s.speakerName,
        email: s.speakerEmail,
        status: s.status,
        updatedAt: s.updatedAt,
      })),
    };
  }

  /**
   * Log a payment received from the organizer. The /billing endpoint will
   * subtract the sum of these from the live total to compute "owed".
   */
  async recordOrganizerPayment(
    organizerId: string,
    body: { amount: number; paidOn?: string; note?: string },
    recordedBy?: string,
  ) {
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ConflictException("amount must be a positive number");
    }
    const organizer = await this.organizerModel.findById(organizerId).lean();
    if (!organizer) throw new NotFoundException("Organizer not found");

    const doc = await this.organizerPaymentModel.create({
      organizerId,
      amount,
      paidOn: body?.paidOn ? new Date(body.paidOn) : new Date(),
      note: (body?.note || "").slice(0, 500),
      recordedBy: recordedBy || undefined,
    });
    return { ok: true, paymentId: String(doc._id) };
  }

  // ===========================================================================
  //  Platform payment configuration — singleton doc the super-admin edits from
  //  the Settings → Payment Settings tab. Drives Singapore corporate-PayNow QR
  //  generation (company UEN + merchant name baked into the EMVCo payload).
  // ===========================================================================
  async getPaymentConfig() {
    const doc: any = await this.paymentConfigModel.findOne({}).lean();
    if (!doc) {
      return {
        companyName: "",
        companyUEN: "",
        platformUPIId: "",
        upiQrImagePath: "",
        persisted: false,
      };
    }
    return {
      companyName: doc.companyName || "",
      companyUEN: doc.companyUEN || "",
      platformUPIId: doc.platformUPIId || "",
      upiQrImagePath: doc.upiQrImagePath || "",
      updatedAt: doc.updatedAt,
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
      persisted: true,
    };
  }

  /**
   * Upload the static UPI QR image, decode it to pull out the VPA, then
   * persist both onto the singleton PaymentConfig. Multer has already saved
   * the file to disk by the time this runs — we just decode + persist.
   */
  async uploadPlatformUPIQr(file: Express.Multer.File, adminId?: string) {
    if (!file) throw new BadRequestException("No file uploaded");
    let decoded: { raw: string; params?: Record<string, string> };
    try {
      decoded = await this.paymentsService.decodeQrFromFile(file.path);
    } catch (e: any) {
      throw new BadRequestException(
        "Could not read the QR image. Upload a clear UPI QR.",
      );
    }
    const vpa = decoded?.params?.pa;
    if (!vpa || !decoded?.raw?.startsWith("upi://")) {
      throw new BadRequestException(
        "This QR isn't a UPI QR (expected upi://… with a `pa` parameter).",
      );
    }
    // Convert "uploads/paymentConfig/foo.png" to a /uploads-prefixed public
    // path. file.path on Windows uses backslashes; normalize to forward.
    const publicPath =
      "/" + file.path.replace(/\\/g, "/").replace(/^\.?\//, "");
    await this.paymentConfigModel.updateOne(
      {},
      {
        $set: {
          platformUPIId: vpa,
          upiQrImagePath: publicPath,
          ...(adminId ? { updatedBy: adminId } : {}),
        },
      },
      { upsert: true },
    );
    return this.getPaymentConfig();
  }

  async updatePaymentConfig(
    body: { companyName?: string; companyUEN?: string; platformUPIId?: string },
    adminId?: string,
  ) {
    const update: any = { $set: {} };
    if (typeof body.companyName === "string") {
      update.$set.companyName = body.companyName.trim().slice(0, 25);
    }
    if (typeof body.companyUEN === "string") {
      const uen = body.companyUEN.trim().toUpperCase();
      // Allow empty to clear; otherwise enforce Singapore PayNow corporate
      // proxy format (9 digits + 1 uppercase letter), the same shape the QR
      // generator branches on in payments.service.ts.
      if (uen && !/^\d{9}[A-Z]$/.test(uen)) {
        throw new ConflictException(
          "Company UEN must be 9 digits followed by 1 uppercase letter (e.g. 200012345A)",
        );
      }
      update.$set.companyUEN = uen;
    }
    if (typeof body.platformUPIId === "string") {
      const vpa = body.platformUPIId.trim();
      // Allow empty to clear; otherwise a UPI VPA is "handle@bank" — no
      // spaces, exactly one "@", both sides non-empty.
      if (vpa && !/^[\w.+-]+@[\w.-]+$/.test(vpa)) {
        throw new ConflictException(
          "UPI ID must look like a VPA, e.g. yourname@upi",
        );
      }
      update.$set.platformUPIId = vpa;
    }
    if (adminId) update.$set.updatedBy = adminId;

    await this.paymentConfigModel.updateOne({}, update, { upsert: true });
    return this.getPaymentConfig();
  }

  async create(createAdminDto: CreateAdminDto) {
    try {
      const existingAdmin = await this.adminModel.findOne({
        email: createAdminDto.email,
      });
      if (existingAdmin) {
        throw new ConflictException("Admin Already Exists");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        createAdminDto.password,
        saltRounds
      );

      let creatorName = "System";

      const adminToCreate = {
        ...createAdminDto,
        password: hashedPassword,
      };

      const adminData = await this.adminModel.create(adminToCreate);

      await this.mailService.sendNewAdminCredentials({
        name: createAdminDto.name,
        email: createAdminDto.email,
        password: createAdminDto.password,
        createdBy: creatorName,
      });

      return {
        message: "Admin Created Successfully",
        adminData: { id: adminData._id, email: adminData.email },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async approveApplicant(id: string, role: "Organizer") {
    let applicant: any;
    if (role === "Organizer") {
      applicant = await this.organizerModel.findById(id);
    }
    if (!applicant) throw new NotFoundException(`${role} not found`);

    applicant.approved = true;
    applicant.rejected = false;
    applicant.statusUpdatedAt = new Date();
    await applicant.save();

    await this.mailService.sendStatusUpdate({
      name: applicant.name,
      email: applicant.email,
      role,
      status: "Approved",
    });

    return { message: `${role} approved successfully` };
  }

  async rejectApplicant(id: string, role: "Organizer") {
    let applicant: any;
    if (role === "Organizer") {
      applicant = await this.organizerModel.findById(id);
    }
    if (!applicant) throw new NotFoundException(`${role} not found`);

    applicant.approved = false;
    applicant.rejected = true;
    applicant.statusUpdatedAt = new Date();
    await applicant.save();

    await this.mailService.sendStatusUpdate({
      name: applicant.name,
      email: applicant.email,
      role,
      status: "Rejected",
    });

    return { message: `${role} rejected successfully` };
  }

  async getDashboardData() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        totalEvents,
        thisMonthEvents,
        totalOrganizers,
        activeOrganizers,
        thisMonthOrganizers,
        pendingOrganizers,
        totalAgents,
        activeAgents,
        totalPlans,
        activePlans,
        totalTickets,
        activeSubscriptions,
        revenueAgg,
        billingRevenueAgg,
        subscriptionRevenueAgg,
        tokenRevenueAgg,
      ] = await Promise.all([
        this.userModel.countDocuments(),
        this.eventModel.countDocuments(),
        this.eventModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
        this.organizerModel.countDocuments(),
        this.organizerModel.countDocuments({ approved: true }),
        this.organizerModel.countDocuments({
          createdAt: { $gte: startOfMonth },
        }),
        this.organizerModel.find({ approved: false, rejected: false }).lean(),
        this.agentModel.countDocuments(),
        this.agentModel.countDocuments({ isActive: true }),
        this.planModel.countDocuments(),
        this.planModel.countDocuments({ isActive: true }),
        this.ticketModel.countDocuments(),
        this.organizerModel.countDocuments({
          subscribed: true,
          planExpiryDate: { $gt: now },
        }),
        this.ticketModel.aggregate([
          { $match: { paymentConfirmed: true } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        this.pendingBillingPaymentModel.aggregate([
          { $match: { status: "confirmed" } },
          { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
        this.pendingSubscriptionPaymentModel.aggregate([
          { $match: { status: "confirmed" } },
          { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
        this.tokenTopUpRequestModel.aggregate([
          { $match: { status: "confirmed" } },
          { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        ]),
      ]);

      const totalRevenue = revenueAgg[0]?.total || 0;

      // Money the platform itself has actually received, split by
      // currency — legacy platform-fee claims (pre-Tokens cutover), Token
      // top-ups (go-forward), and subscription payments, merged per
      // currency code. Legacy rows stay in the union indefinitely so the
      // "Total revenue" figure doesn't show a dip on cutover day.
      const revenueByCurrency: Record<string, { total: number; count: number }> = {};
      for (const row of [
        ...billingRevenueAgg,
        ...tokenRevenueAgg,
        ...subscriptionRevenueAgg,
      ] as any[]) {
        const code = row._id || "USD";
        if (!revenueByCurrency[code]) revenueByCurrency[code] = { total: 0, count: 0 };
        revenueByCurrency[code].total += row.total || 0;
        revenueByCurrency[code].count += row.count || 0;
      }
      const revenueByCurrencyList = Object.entries(revenueByCurrency)
        .map(([currency, v]) => ({ currency, total: v.total, count: v.count }))
        .sort((a, b) => b.total - a.total);

      const [
        recentStatusUpdatesOrganizers,
        recentAddedAdmins,
        recentEvents,
        recentUsers,
        recentTickets,
        recentAgents,
      ] = await Promise.all([
        this.organizerModel
          .find({ updatedAt: { $gte: sevenDaysAgo } })
          .sort({ updatedAt: -1 })
          .limit(20)
          .lean(),
        this.adminModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        this.eventModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        this.userModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        this.ticketModel
          .find({ purchaseDate: { $gte: sevenDaysAgo } })
          .sort({ purchaseDate: -1 })
          .limit(20)
          .lean(),
        this.agentModel
          .find({ createdAt: { $gte: sevenDaysAgo } })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      ]);

      const recentActivity = [
        ...recentAddedAdmins.map((a: any) => ({
          id: a._id,
          type: "admin",
          name: a.name || a.email,
          action: "added as admin",
          time: a.createdAt,
          status: "added",
        })),
        ...recentStatusUpdatesOrganizers.map((o: any) => ({
          id: o._id,
          type: "organizer",
          name: o.name,
          action: o.approved
            ? "organizer activated"
            : o.rejected
              ? "organizer rejected"
              : "organizer pending",
          time: o.updatedAt,
          status: o.approved ? "approved" : o.rejected ? "rejected" : "pending",
        })),
        ...recentEvents.map((e: any) => ({
          id: e._id,
          type: "event",
          name: e.title || "Untitled Event",
          action: "event created",
          time: e.createdAt,
          status: "live",
        })),
        ...recentUsers.map((u: any) => ({
          id: u._id,
          type: "user",
          name: u.name || u.email,
          action: "user registered",
          time: u.createdAt,
          status: "active",
        })),
        ...recentTickets.map((t: any) => ({
          id: t._id,
          type: "ticket",
          name: t.customerName || t.eventTitle || "Ticket",
          action: `ticket purchased — ${t.eventTitle}`,
          time: t.purchaseDate,
          status: t.paymentConfirmed ? "approved" : "pending",
        })),
        ...recentAgents.map((a: any) => ({
          id: a._id,
          type: "agent",
          name: a.name,
          action: "agent created",
          time: a.createdAt,
          status: "active",
        })),
      ];

      recentActivity.sort(
        (a: any, b: any) =>
          new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      return {
        message: "Admin dashboard data fetched successfully",
        stats: {
          totalUsers,
          totalEvents,
          thisMonthEvents,
          totalOrganizers,
          activeOrganizers,
          thisMonthOrganizers,
          pendingApprovals: pendingOrganizers.length,
          totalAgents,
          activeAgents,
          totalPlans,
          activePlans,
          totalTickets,
          totalRevenue,
          activeSubscriptions,
          revenueByCurrency: revenueByCurrencyList,
        },
        pendingApprovals: {
          organizers: pendingOrganizers,
        },
        recentActivity: recentActivity.slice(0, 30),
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getOrganizersOverview() {
    const [organizers, eventsAgg, ticketsAgg, plans, agents] =
      await Promise.all([
        this.organizerModel.find().lean(),
        this.eventModel.aggregate([
          { $group: { _id: "$organizer", count: { $sum: 1 } } },
        ]),
        this.ticketModel.aggregate([
          {
            $group: {
              _id: "$organizerId",
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: ["$paymentConfirmed", "$totalAmount", 0],
                },
              },
            },
          },
        ]),
        this.planModel.find().select("planName").lean(),
        this.agentModel.find().select("name referralCode").lean(),
      ]);

    const eventsMap = new Map<string, number>(
      eventsAgg.map((e: any) => [String(e._id), e.count]),
    );
    const ticketsMap = new Map<
      string,
      { count: number; revenue: number }
    >(
      ticketsAgg.map((t: any) => [
        String(t._id),
        { count: t.count, revenue: t.revenue || 0 },
      ]),
    );
    const planMap = new Map<string, string>(
      plans.map((p: any) => [String(p._id), p.planName]),
    );
    const agentMap = new Map<
      string,
      { name: string; referralCode: string }
    >(
      agents.map((a: any) => [
        String(a._id),
        { name: a.name, referralCode: a.referralCode },
      ]),
    );

    const now = Date.now();
    const list = (organizers as any[]).map((o: any) => {
      const id = String(o._id);
      const t = ticketsMap.get(id) || { count: 0, revenue: 0 };
      const planName = o.planId ? planMap.get(String(o.planId)) : null;
      const agent =
        o.provider === "Agent" && o.providerId
          ? agentMap.get(String(o.providerId)) || null
          : null;
      const planActive =
        !!o.subscribed &&
        !!o.planExpiryDate &&
        new Date(o.planExpiryDate).getTime() > now;
      const status = o.approved
        ? "active"
        : o.rejected
          ? "rejected"
          : "pending";
      return {
        _id: id,
        name: o.name,
        organizationName: o.organizationName,
        email: o.email,
        businessEmail: o.businessEmail,
        phone: o.phone,
        whatsAppNumber: o.whatsAppNumber,
        country: o.country,
        address: o.address,
        bio: o.bio,
        approved: !!o.approved,
        rejected: !!o.rejected,
        status,
        subscribed: !!o.subscribed,
        planId: o.planId ? String(o.planId) : null,
        planName: planName || null,
        planStartDate: o.planStartDate || null,
        planExpiryDate: o.planExpiryDate || null,
        planActive,
        pricePaid: o.pricePaid || null,
        commissionPercentage: o.commissionPercentage,
        provider: o.provider || "self",
        providerId: o.providerId || null,
        referredByAgent: agent,
        eventsCreated: eventsMap.get(id) || 0,
        ticketsSold: t.count,
        revenue: t.revenue,
        bankTransferEnabled: !!o.bankTransferEnabled,
        razorpayStatus: o.razorpay?.status || null,
        receiptType: o.receiptType,
        operationsPausedFromDate: o.operationsPausedFromDate || null,
        operationsPausedToDate: o.operationsPausedToDate || null,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    list.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    const summary = {
      total: list.length,
      active: list.filter((o) => o.status === "active").length,
      pending: list.filter((o) => o.status === "pending").length,
      rejected: list.filter((o) => o.status === "rejected").length,
      subscribed: list.filter((o) => o.planActive).length,
      referred: list.filter((o) => o.provider === "Agent").length,
      totalRevenue: list.reduce((s, o) => s + (o.revenue || 0), 0),
      totalEvents: list.reduce((s, o) => s + (o.eventsCreated || 0), 0),
      totalTickets: list.reduce((s, o) => s + (o.ticketsSold || 0), 0),
    };

    return { summary, organizers: list };
  }

  async getUsersOverview() {
    const [
      organizers,
      users,
      operators,
      vendors,
      speakers,
      tickets,
      agents,
      eventsByOrg,
    ] = await Promise.all([
      this.organizerModel
        .find()
        .select(
          "name email organizationName phone whatsAppNumber country approved rejected createdAt updatedAt subscribed planExpiryDate provider providerId",
        )
        .lean(),
      this.userModel
        .find()
        .select("name email firstName lastName whatsAppNumber roles createdAt")
        .lean(),
      this.operatorModel
        .find()
        .select("name email whatsAppNumber organizerId createdAt")
        .lean(),
      this.vendorModel
        .find()
        .select(
          "name email whatsAppNumber whatsappNumber phoneNumber businessName shopName approved isActive createdAt",
        )
        .lean(),
      this.speakerRequestModel
        .find()
        .select(
          "name email phone organization status eventId organizerId createdAt",
        )
        .lean(),
      this.ticketModel
        .find()
        .select(
          "customerName customerEmail customerWhatsapp totalAmount paymentConfirmed eventTitle organizerId purchaseDate",
        )
        .lean(),
      this.agentModel
        .find()
        .select("name email whatsAppNumber referralCode salesTarget isActive createdAt")
        .lean(),
      this.eventModel.aggregate([
        { $group: { _id: "$organizer", count: { $sum: 1 } } },
      ]),
    ]);

    const eventsCountByOrganizer = new Map<string, number>(
      eventsByOrg.map((e: any) => [String(e._id), e.count]),
    );

    type Entry = {
      key: string;
      name: string;
      email: string;
      phone: string;
      whatsAppNumber: string;
      country?: string;
      organizationName?: string;
      roles: Set<string>;
      eventsCreated: number;
      ticketsPurchased: number;
      ticketRevenue: number;
      stallsRegistered: number;
      speakerRequests: number;
      operatorOf: string[];
      referralCode?: string;
      referredOrganizers: number;
      subscribed: boolean;
      planExpiryDate?: Date | null;
      approvedOrganizer?: boolean | null;
      firstSeen: Date;
      lastSeen: Date;
      sources: { type: string; id: string }[];
    };

    const merge = (entry: Entry, candidate: Partial<Entry>) => {
      if (!entry.name && candidate.name) entry.name = candidate.name as string;
      if (!entry.phone && candidate.phone)
        entry.phone = candidate.phone as string;
      if (!entry.whatsAppNumber && candidate.whatsAppNumber)
        entry.whatsAppNumber = candidate.whatsAppNumber as string;
      if (!entry.country && candidate.country)
        entry.country = candidate.country as string;
      if (!entry.organizationName && candidate.organizationName)
        entry.organizationName = candidate.organizationName as string;
      if (!entry.referralCode && candidate.referralCode)
        entry.referralCode = candidate.referralCode as string;
      if (
        candidate.firstSeen &&
        (!entry.firstSeen || candidate.firstSeen < entry.firstSeen)
      )
        entry.firstSeen = candidate.firstSeen as Date;
      if (
        candidate.lastSeen &&
        (!entry.lastSeen || candidate.lastSeen > entry.lastSeen)
      )
        entry.lastSeen = candidate.lastSeen as Date;
      if (candidate.subscribed) entry.subscribed = true;
      if (candidate.planExpiryDate)
        entry.planExpiryDate = candidate.planExpiryDate as Date;
      if (typeof candidate.approvedOrganizer === "boolean")
        entry.approvedOrganizer = candidate.approvedOrganizer;
    };

    const map = new Map<string, Entry>();
    const keyFor = (email?: string, whatsApp?: string) => {
      const e = (email || "").toLowerCase().trim();
      if (e) return `e:${e}`;
      const w = (whatsApp || "").replace(/\D/g, "");
      if (w) return `w:${w}`;
      return null;
    };
    const upsert = (
      key: string | null,
      base: Partial<Entry>,
      role: string,
      source: { type: string; id: string },
    ) => {
      if (!key) return null;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          key,
          name: base.name || "",
          email: base.email || "",
          phone: base.phone || "",
          whatsAppNumber: base.whatsAppNumber || "",
          country: base.country,
          organizationName: base.organizationName,
          roles: new Set<string>(),
          eventsCreated: 0,
          ticketsPurchased: 0,
          ticketRevenue: 0,
          stallsRegistered: 0,
          speakerRequests: 0,
          operatorOf: [],
          referralCode: base.referralCode,
          referredOrganizers: 0,
          subscribed: !!base.subscribed,
          planExpiryDate: base.planExpiryDate ?? null,
          approvedOrganizer: base.approvedOrganizer ?? null,
          firstSeen: base.firstSeen as Date,
          lastSeen: (base.lastSeen as Date) || (base.firstSeen as Date),
          sources: [],
        };
        map.set(key, entry);
      } else {
        merge(entry, base);
      }
      entry.roles.add(role);
      entry.sources.push(source);
      return entry;
    };

    // Referral counts per agent
    const referralCounts = new Map<string, number>();
    for (const o of organizers) {
      if (o.provider === "Agent" && o.providerId) {
        const id = String(o.providerId);
        referralCounts.set(id, (referralCounts.get(id) || 0) + 1);
      }
    }

    // Organizers
    for (const o of organizers as any[]) {
      const key = keyFor(o.email, o.whatsAppNumber);
      const entry = upsert(
        key,
        {
          name: o.name,
          email: (o.email || "").toLowerCase().trim(),
          phone: o.phone || "",
          whatsAppNumber: o.whatsAppNumber || "",
          country: o.country,
          organizationName: o.organizationName,
          subscribed: !!o.subscribed,
          planExpiryDate: o.planExpiryDate || null,
          approvedOrganizer: !!o.approved,
          firstSeen: o.createdAt,
          lastSeen: o.updatedAt || o.createdAt,
        },
        "Organizer",
        { type: "organizer", id: String(o._id) },
      );
      if (entry)
        entry.eventsCreated += eventsCountByOrganizer.get(String(o._id)) || 0;
    }

    // Users (visitors)
    for (const u of users as any[]) {
      const key = keyFor(u.email, u.whatsAppNumber);
      const composedName =
        u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.email ||
        "";
      const role =
        Array.isArray(u.roles) && u.roles.includes("admin")
          ? "Admin"
          : "Visitor";
      upsert(
        key,
        {
          name: composedName,
          email: (u.email || "").toLowerCase().trim(),
          whatsAppNumber: u.whatsAppNumber || "",
          firstSeen: u.createdAt,
          lastSeen: u.createdAt,
        },
        role,
        { type: "user", id: String(u._id) },
      );
    }

    // Operators
    for (const op of operators as any[]) {
      const key = keyFor(op.email, op.whatsAppNumber);
      const entry = upsert(
        key,
        {
          name: op.name,
          email: (op.email || "").toLowerCase().trim(),
          whatsAppNumber: op.whatsAppNumber || "",
          firstSeen: op.createdAt,
          lastSeen: op.createdAt,
        },
        "Operator",
        { type: "operator", id: String(op._id) },
      );
      if (entry && op.organizerId)
        entry.operatorOf.push(String(op.organizerId));
    }

    // Vendors / Exhibitors
    for (const v of vendors as any[]) {
      const wa = v.whatsAppNumber || v.whatsappNumber || v.phoneNumber || "";
      const key = keyFor(v.email, wa);
      const entry = upsert(
        key,
        {
          name: v.name,
          email: (v.email || "").toLowerCase().trim(),
          whatsAppNumber: wa,
          organizationName: v.businessName || v.shopName,
          firstSeen: v.createdAt,
          lastSeen: v.createdAt,
        },
        "Exhibitor",
        { type: "vendor", id: String(v._id) },
      );
      if (entry) entry.stallsRegistered += 1;
    }

    // Speakers
    for (const s of speakers as any[]) {
      const key = keyFor(s.email, s.phone);
      const entry = upsert(
        key,
        {
          name: s.name,
          email: (s.email || "").toLowerCase().trim(),
          phone: s.phone || "",
          organizationName: s.organization,
          firstSeen: s.createdAt,
          lastSeen: s.createdAt,
        },
        "Speaker",
        { type: "speaker", id: String(s._id) },
      );
      if (entry) entry.speakerRequests += 1;
    }

    // Ticket buyers
    for (const t of tickets as any[]) {
      const key = keyFor(t.customerEmail, t.customerWhatsapp);
      const entry = upsert(
        key,
        {
          name: t.customerName || t.customerEmail || "Ticket Buyer",
          email: (t.customerEmail || "").toLowerCase().trim(),
          whatsAppNumber: t.customerWhatsapp || "",
          firstSeen: t.purchaseDate,
          lastSeen: t.purchaseDate,
        },
        "Ticket Buyer",
        { type: "ticket", id: String(t._id) },
      );
      if (entry) {
        entry.ticketsPurchased += 1;
        if (t.paymentConfirmed && typeof t.totalAmount === "number") {
          entry.ticketRevenue += t.totalAmount;
        }
      }
    }

    // Agents
    for (const a of agents as any[]) {
      const key = keyFor(a.email, a.whatsAppNumber);
      const entry = upsert(
        key,
        {
          name: a.name,
          email: (a.email || "").toLowerCase().trim(),
          whatsAppNumber: a.whatsAppNumber || "",
          referralCode: a.referralCode,
          firstSeen: a.createdAt,
          lastSeen: a.createdAt,
        },
        "Agent",
        { type: "agent", id: String(a._id) },
      );
      if (entry) {
        entry.referredOrganizers = referralCounts.get(String(a._id)) || 0;
      }
    }

    const list = Array.from(map.values()).map((e) => ({
      ...e,
      roles: Array.from(e.roles),
    }));

    list.sort(
      (a, b) =>
        new Date(b.lastSeen || 0).getTime() -
        new Date(a.lastSeen || 0).getTime(),
    );

    const summary = {
      totalUnique: list.length,
      organizers: list.filter((u) => u.roles.includes("Organizer")).length,
      visitors: list.filter((u) => u.roles.includes("Visitor")).length,
      exhibitors: list.filter((u) => u.roles.includes("Exhibitor")).length,
      speakers: list.filter((u) => u.roles.includes("Speaker")).length,
      ticketBuyers: list.filter((u) => u.roles.includes("Ticket Buyer")).length,
      operators: list.filter((u) => u.roles.includes("Operator")).length,
      agents: list.filter((u) => u.roles.includes("Agent")).length,
      multiRole: list.filter((u) => u.roles.length > 1).length,
    };

    return { summary, users: list };
  }

  async login(dto: LoginDto) {
    try {
      const admin = await this.adminModel.findOne({
        email: dto.email,
      });

      if (!admin) {
        throw new NotFoundException("Admin Not Found");
      }

      const isValidPassword = await bcrypt.compare(
        dto.password,
        admin.password
      );

      if (!isValidPassword) {
        throw new UnauthorizedException("Invalid Password");
      }

      const payload = {
        sub: admin._id,
        email: admin.email,
        name: admin.name,
        roles: admin.role || [],
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "12h",
      });

      return { message: "login Successfull", data: token };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  findAll() {
    return `This action returns all admin`;
  }

  async findOne(id: string) {
    const admin = await this.adminModel.findById(id).select("-password").exec();
    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }
    return admin;
  }

  async remove(id: string) {
    const deleted = await this.adminModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }
    return { message: "Admin deleted successfully" };
  }
}
