import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as fs from "fs";
import * as path from "path";
import { OtpService } from "../otp/otp.service";
import { MailService } from "../roles/mail.service";
import {
  billForCategory,
  resolveEffectiveRates,
  resolvePlanForCountry,
  EffectiveBillingRates,
} from "../admin/billing-rate-calc.util";
import {
  computeEventBillables,
  amountForBillables,
  flattenBillable,
} from "../admin/billables.util";
const PDFDocument = require("pdfkit");

type BillingRates = EffectiveBillingRates;

/**
 * Organization-scoped prepaid token wallet — replaces the old per-event
 * "Platform Fees" claim/QR-pay/admin-confirm flow (billing-payments module,
 * left in place but no longer surfaced to organizers/admins).
 *
 * Consumption is LAZY / on-read: reconcileEvent()/reconcileMemberships()
 * recompute "total owed" fresh from live data (reusing the exact same
 * computeEventBillables/amountForBillables calc billing-payments.service.ts
 * already has) every time the wallet is read, and debit/credit only the
 * DELTA vs. what's already been debited (tracked via the ledger itself, so
 * idempotent by construction — see billables.util.ts for the shared calc).
 */
@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    @InjectModel("TokenWallet") private walletModel: Model<any>,
    @InjectModel("TokenLedgerEntry") private ledgerModel: Model<any>,
    @InjectModel("TokenTopUpRequest") private topupModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("SpeakerRequest") private speakerRequestModel: Model<any>,
    @InjectModel("WorkshopBooking") private workshopBookingModel: Model<any>,
    @InjectModel("SponsorRequest") private sponsorRequestModel: Model<any>,
    @InjectModel("SupplierRequest") private supplierRequestModel: Model<any>,
    @InjectModel("Ticket") private ticketModel: Model<any>,
    @InjectModel("PlatformBillingRates") private ratesModel: Model<any>,
    @InjectModel("OrganizerBillingRateOverride")
    private rateOverrideModel: Model<any>,
    @InjectModel("ExhibitorMembership")
    private membershipModel: Model<any>,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  //  Shared helpers (small, deliberately duplicated from
  //  billing-payments.service.ts rather than cross-importing a sibling
  //  service — same convention as that file's own loadRates/regionFromCountry).
  // ---------------------------------------------------------------------------
  private async loadRates(
    organizerId?: string,
    country?: string,
  ): Promise<BillingRates> {
    const [plans, overrideDoc] = await Promise.all([
      this.ratesModel.find({}).lean(),
      organizerId
        ? this.rateOverrideModel.findOne({ organizerId }).lean()
        : Promise.resolve(null),
    ]);
    const plan = resolvePlanForCountry(plans, country);
    return resolveEffectiveRates(plan, overrideDoc);
  }

  private regionFromCountry(country?: string): {
    scheme: "UPI" | "PAYNOW";
    currency: string;
  } | null {
    const c = (country || "").trim().toLowerCase();
    if (c === "in" || c === "india")
      return { scheme: "UPI", currency: "INR" };
    if (c === "sg" || c === "singapore" || c === "sgp")
      return { scheme: "PAYNOW", currency: "SGD" };
    return null;
  }

  private currencySymbol(currency: string) {
    if (currency === "INR") return "Rs.";
    if (currency === "SGD") return "SG$";
    return "$";
  }

  // ---------------------------------------------------------------------------
  //  Wallet primitives
  // ---------------------------------------------------------------------------
  async getWallet(organizerId: string) {
    const wallet = await this.walletModel.findOneAndUpdate(
      { organizerId },
      { $setOnInsert: { organizerId, balance: 0 } },
      { upsert: true, new: true },
    );
    return { organizerId: String(wallet.organizerId), balance: wallet.balance };
  }

  // Atomic balance mutation + matching ledger row. `amountChange` is added
  // directly to balance (positive credits, negative debits) — callers pick
  // the right sign for their scenario.
  private async mutateWallet(
    organizerId: string,
    amountChange: number,
    ledger: {
      type: "topup" | "debit" | "credit" | "admin_adjust";
      amount: number;
      eventId?: Types.ObjectId | "memberships" | null;
      category?: string;
      description?: string;
    },
  ) {
    const wallet = await this.walletModel.findOneAndUpdate(
      { organizerId },
      { $inc: { balance: amountChange }, $setOnInsert: { organizerId } },
      { upsert: true, new: true },
    );
    await this.ledgerModel.create({
      organizerId,
      balanceAfter: wallet.balance,
      ...ledger,
    });
    return wallet;
  }

  // Net (debit + baseline - credit) already reconciled for this
  // organizer+scope, so reconcileEvent/reconcileMemberships know how much
  // of `totalOwed` has already been applied to the wallet (or grand-
  // fathered in for free via a baseline entry, which counts toward
  // "already accounted for" the same as a real debit even though it never
  // touched wallet.balance).
  private async netReconciledForScope(
    organizerId: string,
    eventId: string | "memberships",
  ): Promise<number> {
    const match: any = {
      organizerId: new Types.ObjectId(organizerId),
      category: { $in: ["reconcile", "reconcile-credit", "baseline"] },
    };
    match.eventId =
      eventId === "memberships" ? "memberships" : new Types.ObjectId(eventId);
    const rows = await this.ledgerModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          debit: {
            $sum: {
              $cond: [{ $ne: ["$category", "reconcile-credit"] }, "$amount", 0],
            },
          },
          credit: {
            $sum: {
              $cond: [{ $eq: ["$category", "reconcile-credit"] }, "$amount", 0],
            },
          },
        },
      },
    ]);
    const r = rows[0];
    return r ? r.debit - r.credit : 0;
  }

  // True once ANY reconcile/baseline ledger entry exists for this scope —
  // i.e. this organizer+event (or organizer+memberships) has been through
  // reconciliation before. Used to detect "first ever reconciliation" so
  // pre-existing activity can be grandfathered in via a baseline entry
  // instead of billed in one lump sum.
  private async hasReconciled(
    organizerId: string,
    eventId: string | "memberships",
  ): Promise<boolean> {
    const match: any = {
      organizerId: new Types.ObjectId(organizerId),
      category: { $in: ["reconcile", "reconcile-credit", "baseline"] },
    };
    match.eventId =
      eventId === "memberships" ? "memberships" : new Types.ObjectId(eventId);
    const exists = await this.ledgerModel.exists(match);
    return !!exists;
  }

  // Records `totalOwed` as the starting baseline for this scope WITHOUT
  // touching wallet.balance — grandfathers in activity that predates this
  // scope's first reconciliation (which may already have been billed/
  // settled under the old Platform Fees system, or was never carried
  // forward per the Tokens cutover decision). A no-op when there's
  // nothing to grandfather in.
  private async establishBaseline(
    organizerId: string,
    eventId: Types.ObjectId | "memberships",
    totalOwed: number,
    description: string,
  ) {
    if (totalOwed <= 0) return;
    const wallet = await this.getWallet(organizerId);
    await this.ledgerModel.create({
      organizerId,
      type: "baseline",
      amount: totalOwed,
      balanceAfter: wallet.balance,
      eventId,
      category: "baseline",
      description,
    });
  }

  private async applyReconcileDelta(
    organizerId: string,
    eventId: Types.ObjectId | "memberships",
    delta: number,
    description: string,
  ) {
    if (delta === 0) return;
    if (delta > 0) {
      await this.mutateWallet(organizerId, -delta, {
        type: "debit",
        amount: delta,
        eventId,
        category: "reconcile",
        description,
      });
    } else {
      await this.mutateWallet(organizerId, -delta, {
        type: "credit",
        amount: -delta,
        eventId,
        category: "reconcile-credit",
        description,
      });
    }
  }

  // ---------------------------------------------------------------------------
  //  GET /tokens/estimate/:eventId — publish-time turnover estimate.
  //  Pre-sale only (no bookings exist yet at publish time) — sums
  //  qty × price across the event's own configured pricing templates,
  //  applies the organizer's current moneyInRate. Suppliers excluded (not
  //  part of Event's own templates, arranged separately post-creation).
  // ---------------------------------------------------------------------------
  async estimatePublishTurnover(eventId: string) {
    const event = (await this.eventModel.findById(eventId).lean()) as any;
    if (!event) throw new NotFoundException("Event not found");
    const organizerId = String(event.organizer);
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");

    const rates = await this.loadRates(organizerId, organizer.country);

    const ticketItems = this.estimateTicketItems(event);
    const stallItems = flattenBillable(event.venueTables)
      .filter((t: any) => t?.forSale !== false)
      .map((t: any) => ({ tablePrice: Number(t.tablePrice) || 0 }));
    const { tableItems, chairItems } = this.estimateRoundTableItems(event);
    const speakerItems = flattenBillable(event.speakerSlotTemplates).flatMap(
      (t: any) =>
        Array.from({ length: Math.max(0, Number(t.maxSpeakers) || 0) }, () => ({
          fee: Number(t.slotPrice) || 0,
        })),
    );
    const sponsorItems = flattenBillable(event.sponsorTypes)
      .filter((s: any) => s?.isActive !== false)
      .map((s: any) => ({ amount: Number(s.price) || 0 }));
    const workshopItems = flattenBillable(event.workshopSessions).flatMap(
      (w: any) =>
        Array.from({ length: Math.max(0, Number(w.maxSeats) || 0) }, () => ({
          amount: Number(w.price) || 0,
        })),
    );

    const estimatedFee =
      billForCategory(
        ticketItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (t: any) => t.totalAmount,
      ) +
      billForCategory(
        stallItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (t: any) => t.tablePrice,
      ) +
      billForCategory(
        tableItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (t: any) => t.tablePrice,
      ) +
      billForCategory(
        chairItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (c: any) => c.chairPrice,
      ) +
      billForCategory(
        speakerItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (s: any) => s.fee,
      ) +
      billForCategory(
        sponsorItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (s: any) => s.amount,
      ) +
      billForCategory(
        workshopItems,
        rates.moneyInRate,
        rates.moneyInRateMode,
        (w: any) => w.amount,
      );

    const wallet = await this.getWallet(organizerId);
    const rounded = Math.round(estimatedFee * 100) / 100;
    return {
      eventId: String(event._id),
      estimatedFee: rounded,
      currency: rates.currency,
      walletBalance: wallet.balance,
      shortfall: Math.max(0, Math.round((rounded - wallet.balance) * 100) / 100),
    };
  }

  private estimateTicketItems(event: any): { totalAmount: number }[] {
    const visitorTypes = flattenBillable(event.visitorTypes).filter(
      (v: any) => v?.isActive !== false && Number(v?.maxCount) > 0,
    );
    if (visitorTypes.length) {
      return visitorTypes.flatMap((v: any) =>
        Array.from({ length: Math.max(0, Number(v.maxCount) || 0) }, () => ({
          totalAmount: Number(v.price) || 0,
        })),
      );
    }
    const totalTickets = Number(event.totalTickets) || 0;
    const ticketPrice = Number(event.ticketPrice) || 0;
    if (totalTickets > 0 && ticketPrice > 0) {
      return Array.from({ length: totalTickets }, () => ({
        totalAmount: ticketPrice,
      }));
    }
    return [];
  }

  private estimateRoundTableItems(event: any): {
    tableItems: { tablePrice: number }[];
    chairItems: { chairPrice: number }[];
  } {
    const rounds = flattenBillable(event.venueRoundTables).filter(
      (rt: any) => rt?.forSale !== false,
    );
    const tableItems: { tablePrice: number }[] = [];
    const chairItems: { chairPrice: number }[] = [];
    for (const rt of rounds) {
      if (rt.sellingMode === "chair") {
        const n = Math.max(0, Number(rt.numberOfChairs) || 0);
        for (let i = 0; i < n; i++) {
          chairItems.push({ chairPrice: Number(rt.chairPrice) || 0 });
        }
      } else {
        tableItems.push({ tablePrice: Number(rt.tablePrice) || 0 });
      }
    }
    return { tableItems, chairItems };
  }

  // ---------------------------------------------------------------------------
  //  Reconciliation — the core consumption mechanism. Called on every wallet
  //  read (organizer dashboard, admin view) plus a cron backstop.
  // ---------------------------------------------------------------------------
  async reconcileEvent(eventId: string) {
    const event = (await this.eventModel.findById(eventId).lean()) as any;
    if (!event) return null;
    const organizerId = String(event.organizer);
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) return null;

    const rates = await this.loadRates(organizerId, organizer.country);
    const [speakerDocs, workshopDocs, sponsorDocs, supplierDocs, ticketDocs] =
      await Promise.all([
        this.speakerRequestModel
          .find({ organizerId, eventId, status: "Confirmed" })
          .select("fee")
          .lean(),
        this.workshopBookingModel
          .find({ organizerId, eventId, paymentStatus: "Paid" })
          .select("amount")
          .lean(),
        this.sponsorRequestModel
          .find({ organizerId, eventId, status: "Confirmed" })
          .select("amount")
          .lean(),
        this.supplierRequestModel
          .find({ organizerId, eventId, status: "Paid" })
          .select("agreedTotal quotationTotal")
          .lean(),
        this.ticketModel
          .find({
            organizerId,
            eventId,
            paymentConfirmed: true,
            status: { $ne: "cancelled" },
          })
          .select("totalAmount")
          .lean(),
      ]);
    const billables = computeEventBillables(
      event,
      speakerDocs,
      workshopDocs,
      sponsorDocs,
      supplierDocs,
      ticketDocs,
    );
    const totalOwed = amountForBillables(billables, rates);

    if (!(await this.hasReconciled(organizerId, eventId))) {
      // First-ever reconciliation for this event — grandfather in
      // whatever's already accrued rather than billing its entire history
      // in one lump sum. Only activity from this point forward is charged.
      await this.establishBaseline(
        organizerId,
        new Types.ObjectId(eventId),
        totalOwed,
        `Baseline for "${event.title || ""}" — pre-existing activity grandfathered in, not charged`,
      );
      return { eventId: String(event._id), totalOwed, billables };
    }

    const already = await this.netReconciledForScope(organizerId, eventId);
    const delta = totalOwed - already;
    await this.applyReconcileDelta(
      organizerId,
      new Types.ObjectId(eventId),
      delta,
      `Event reconciliation: ${event.title || ""}`,
    );

    return { eventId: String(event._id), totalOwed, billables };
  }

  async reconcileMemberships(organizerId: string) {
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) return null;
    const rates = await this.loadRates(organizerId, organizer.country);
    const activeMemberships = (await this.membershipModel
      .find({ organizerId: new Types.ObjectId(organizerId), status: "active" })
      .select("amountPaid exhibitorName planId")
      .populate("planId", "name")
      .lean()) as any[];
    const totalOwed = billForCategory(
      activeMemberships,
      rates.moneyInRate,
      rates.moneyInRateMode,
      (m: any) => m.amountPaid,
    );

    if (!(await this.hasReconciled(organizerId, "memberships"))) {
      // Same grandfather-in treatment as reconcileEvent() — don't bill an
      // organizer's entire pre-existing membership history in one shot the
      // first time this runs.
      await this.establishBaseline(
        organizerId,
        "memberships",
        totalOwed,
        "Baseline for memberships — pre-existing activity grandfathered in, not charged",
      );
    } else {
      const already = await this.netReconciledForScope(organizerId, "memberships");
      const delta = totalOwed - already;
      await this.applyReconcileDelta(
        organizerId,
        "memberships",
        delta,
        "Membership fees reconciliation",
      );
    }

    const rows = activeMemberships.map((m: any) => ({
      _id: String(m._id),
      exhibitorName: m.exhibitorName || "",
      planName:
        typeof m.planId === "object" && m.planId ? m.planId.name : "—",
      amountPaid: m.amountPaid || 0,
      fee: billForCategory(
        [m],
        rates.moneyInRate,
        rates.moneyInRateMode,
        (mm: any) => mm.amountPaid,
      ),
    }));
    return { totalOwed, rows };
  }

  // ---------------------------------------------------------------------------
  //  GET /tokens/me and GET /tokens/admin/organizer/:organizerId — reconciles
  //  every one of the organizer's events + memberships, then returns fresh
  //  balance + per-event breakdown + ledger. Shared by both surfaces.
  // ---------------------------------------------------------------------------
  async getOrganizerWalletSummary(organizerId: string) {
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");

    const events = (await this.eventModel
      .find({ organizer: organizerId })
      .select("title startDate endDate status")
      .sort({ startDate: -1 })
      .lean()) as any[];

    const rows: any[] = [];
    for (const e of events) {
      const result = await this.reconcileEvent(String(e._id));
      if (!result) continue;
      rows.push({
        eventId: String(e._id),
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        ticketsSold: result.billables.ticketsSold,
        stallsSold: result.billables.stallsSold,
        tablesBooked: result.billables.tablesBooked,
        chairsBooked: result.billables.chairsBooked,
        speakersBooked: result.billables.speakersBooked,
        workshopsBooked: result.billables.workshopsBooked,
        sponsorsConfirmed: result.billables.sponsorsConfirmed,
        suppliersConfirmed: result.billables.suppliersConfirmed,
        amount: result.totalOwed,
      });
    }

    const membershipsResult = await this.reconcileMemberships(organizerId);
    const wallet = await this.getWallet(organizerId);
    const ledger = (await this.ledgerModel
      .find({ organizerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()) as any[];
    const region = this.regionFromCountry(organizer.country);

    return {
      organizer: {
        _id: String(organizer._id),
        name: organizer.name,
        organizationName: organizer.organizationName,
        country: organizer.country,
      },
      wallet,
      events: rows,
      memberships: membershipsResult || { totalOwed: 0, rows: [] },
      ledger: ledger.map((l: any) => ({
        _id: String(l._id),
        type: l.type,
        amount: l.amount,
        balanceAfter: l.balanceAfter,
        eventId: l.eventId ? String(l.eventId) : null,
        category: l.category,
        description: l.description,
        createdAt: l.createdAt,
      })),
      region: region ? { scheme: region.scheme, currency: region.currency } : null,
    };
  }

  // ---------------------------------------------------------------------------
  //  Cron backstop — reconciles recently-active events even if nobody opened
  //  the organizer/admin wallet view. On-read reconciliation (above) is the
  //  primary mechanism; this just keeps balances from staying stale for
  //  organizers who never look at the dashboard.
  // ---------------------------------------------------------------------------
  async sweepRecentActivity(hours = 24): Promise<{
    eventsReconciled: number;
    organizersSwept: number;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const events = (await this.eventModel
      .find({ updatedAt: { $gte: since } })
      .select("_id organizer")
      .lean()) as any[];
    const orgIds = new Set<string>();
    for (const e of events) {
      await this.reconcileEvent(String(e._id));
      orgIds.add(String(e.organizer));
    }
    for (const orgId of orgIds) {
      await this.reconcileMemberships(orgId);
    }
    return { eventsReconciled: events.length, organizersSwept: orgIds.size };
  }

  // ---------------------------------------------------------------------------
  //  Token top-ups — same PayNow/UPI QR + admin-confirm flow as the old
  //  per-event claims, just organization-scoped instead of per-event.
  // ---------------------------------------------------------------------------
  async createTopUpRequest(organizerId: string, tokensRequested: number) {
    const qty = Number(tokensRequested);
    if (!qty || qty <= 0) {
      throw new BadRequestException("tokensRequested must be a positive number");
    }
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");
    const region = this.regionFromCountry(organizer.country);
    if (!region) {
      throw new BadRequestException(
        "Your country has no QR payment scheme configured. Contact admin to settle off-band.",
      );
    }
    const ref = `TOK-${String(organizerId).slice(-4)}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const doc = await this.topupModel.create({
      organizerId,
      tokensRequested: qty,
      amount: qty,
      currency: region.currency,
      scheme: region.scheme,
      ref,
      status: "awaiting_payment",
    });
    return this.topupToClient(doc.toObject());
  }

  async markTopUpSubmitted(organizerId: string, id: string) {
    const doc = await this.topupModel.findById(id);
    if (!doc) throw new NotFoundException("Top-up request not found");
    if (String(doc.organizerId) !== String(organizerId)) {
      throw new BadRequestException("Not your top-up request");
    }
    if (doc.status === "confirmed" || doc.status === "rejected") {
      throw new ConflictException(
        `Already ${doc.status}; cannot mark as paid again`,
      );
    }
    doc.status = "submitted";
    doc.submittedAt = new Date();
    await doc.save();
    return { ok: true, status: doc.status };
  }

  async listPendingTopUps() {
    const rows = (await this.topupModel
      .find({ status: { $in: ["awaiting_payment", "submitted"] } })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean()) as any[];
    if (rows.length === 0) return [];
    const orgIds = Array.from(
      new Set(rows.map((r: any) => String(r.organizerId))),
    );
    const orgs = (await this.organizerModel
      .find({ _id: { $in: orgIds } })
      .select("name organizationName email whatsAppNumber country")
      .lean()) as any[];
    const orgMap = new Map<string, any>(
      orgs.map((o: any) => [String(o._id), o]),
    );
    return rows.map((r: any) => ({
      _id: String(r._id),
      organizer: orgMap.get(String(r.organizerId)) || null,
      tokensRequested: r.tokensRequested,
      amount: r.amount,
      currency: r.currency,
      scheme: r.scheme,
      status: r.status,
      ref: r.ref,
      submittedAt: r.submittedAt || null,
      createdAt: r.createdAt,
    }));
  }

  async confirmTopUp(id: string, adminId?: string) {
    const doc = await this.topupModel.findById(id);
    if (!doc) throw new NotFoundException("Top-up request not found");
    if (doc.status === "confirmed")
      throw new ConflictException("Already confirmed");
    if (doc.status === "rejected")
      throw new ConflictException("Already rejected");
    const organizer = await this.organizerModel.findById(doc.organizerId);
    if (!organizer) throw new NotFoundException("Organizer no longer exists");

    doc.status = "confirmed";
    doc.confirmedAt = new Date();
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    await doc.save();

    await this.mutateWallet(String(doc.organizerId), doc.tokensRequested, {
      type: "topup",
      amount: doc.tokensRequested,
      category: "topup",
      description: `Token top-up ${doc.ref}`,
    });

    const pdfPath = await this.writeTopUpReceiptPdf(organizer, doc);
    const whatsapp = await this.sendWhatsAppReceipt(organizer, doc, pdfPath);
    const email = await this.sendEmailReceipt(organizer, doc, pdfPath);

    return {
      ok: true,
      receiptPath: "/" + pdfPath.replace(/\\/g, "/").replace(/^\.?\//, ""),
      whatsapp,
      email,
    };
  }

  async rejectTopUp(id: string, reason?: string, adminId?: string) {
    const doc = await this.topupModel.findById(id);
    if (!doc) throw new NotFoundException("Top-up request not found");
    if (doc.status === "confirmed")
      throw new ConflictException("Already confirmed; cannot reject");
    doc.status = "rejected";
    doc.rejectionReason = (reason || "").slice(0, 500);
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    doc.confirmedAt = new Date();
    await doc.save();
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  //  Admin manual wallet adjustment — direct replacement for
  //  OrganizerBillingDialog's old "Record payment" action; also the tool
  //  used for the one-time legacy-Platform-Fees-balance seeding at cutover.
  //  `delta` is applied directly to balance (positive credits, negative
  //  debits) — the sign the admin intends, unlike reconcile's owed-based delta.
  // ---------------------------------------------------------------------------
  async adminAdjustWallet(
    organizerId: string,
    delta: number,
    note: string,
    adminId?: string,
  ) {
    const d = Number(delta);
    if (!d) throw new BadRequestException("delta must be a non-zero number");
    const organizer = await this.organizerModel.findById(organizerId).lean();
    if (!organizer) throw new NotFoundException("Organizer not found");
    const wallet = await this.mutateWallet(organizerId, d, {
      type: "admin_adjust",
      amount: Math.abs(d),
      category: "admin_adjust",
      description: (note || "").slice(0, 500),
    });
    this.logger.log(
      `Admin ${adminId || "?"} adjusted organizer ${organizerId} wallet by ${d} (${note || ""})`,
    );
    return { ok: true, balance: wallet.balance };
  }

  // ---------------------------------------------------------------------------
  //  Receipt helpers (compact version of billing-payments.service.ts's —
  //  a top-up has no per-category line items to itemize).
  // ---------------------------------------------------------------------------
  private writeTopUpReceiptPdf(organizer: any, doc: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.join(process.cwd(), "uploads", "receipts");
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      const filePath = path.join(dir, `${doc.ref}.pdf`);
      const stream = fs.createWriteStream(filePath);
      const pdf = new PDFDocument({ size: "A4", margin: 40 });
      pdf.pipe(stream);

      const sym = this.currencySymbol(doc.currency);
      const amountStr = `${sym}${Number(doc.amount).toFixed(2)} ${doc.currency}`;
      const issued = new Date().toLocaleString();

      pdf.rect(40, 40, 515, 70).fill("#0f172a");
      pdf
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("EVENTSH", 58, 55);
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text("Token top-up receipt", 58, 82);
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#ffffff")
        .text("TOKEN TOP-UP RECEIPT", 40, 55, { width: 497, align: "right" });
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text(`Ref: ${doc.ref}`, 40, 75, { width: 497, align: "right" })
        .text(`Issued: ${issued}`, 40, 88, { width: 497, align: "right" });

      let y = 140;
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#64748b")
        .text("BILLED TO", 40, y);
      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0f172a")
        .text(organizer.organizationName || organizer.name || "—", 40, y + 16);
      pdf
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#1f2937")
        .text(organizer.email || organizer.businessEmail || "—", 40, y + 32);
      y += 70;

      pdf.rect(40, y, 515, 60).fillAndStroke("#f8fafc", "#e2e8f0");
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#64748b")
        .text("TOKENS PURCHASED", 55, y + 12);
      pdf
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#0f172a")
        .text(`${doc.tokensRequested} tokens`, 55, y + 28);
      pdf
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#0f172a")
        .text(amountStr, 40, y + 28, { width: 500, align: "right" });
      y += 80;

      pdf.roundedRect(40, y, 80, 24, 12).fillAndStroke("#dcfce7", "#16a34a");
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#16a34a")
        .text("PAID", 40, y + 7, { width: 80, align: "center" });
      y += 50;

      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#64748b")
        .text(
          "This is an electronically generated receipt — no signature required.",
          40,
          y,
          { width: 515, align: "center" },
        );

      pdf.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }

  private async sendWhatsAppReceipt(
    organizer: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    if (!organizer.whatsAppNumber)
      return { sent: false, error: "no_whatsapp_number" };
    try {
      const caption = `Eventsh — token top-up confirmed (${doc.tokensRequested} tokens). Receipt attached. Ref: ${doc.ref}`;
      await this.otpService.sendMediaMessage(
        organizer.whatsAppNumber,
        pdfPath,
        caption,
        `eventsh-token-receipt-${doc.ref}.pdf`,
      );
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `WhatsApp receipt failed for topup ${doc._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private async sendEmailReceipt(
    organizer: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const to = MailService.recipientList(
      organizer.email,
      organizer.businessEmail,
    );
    if (!to) return { sent: false, error: "no_email" };
    try {
      const symbol = this.currencySymbol(doc.currency);
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
          <h2>Tokens purchased</h2>
          <p>Hi ${this.escapeHtml(organizer.name || "there")},</p>
          <p>Your token top-up has been confirmed. PDF receipt attached.</p>
          <table style="border-collapse: collapse; margin: 12px 0;">
            <tr><td style="padding: 4px 12px; color: #6b7280;">Tokens</td><td style="padding: 4px 12px; font-weight: 600;">${doc.tokensRequested}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Amount</td><td style="padding: 4px 12px; font-weight: 600;">${symbol}${doc.amount} ${doc.currency}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Reference</td><td style="padding: 4px 12px; font-family: monospace;">${this.escapeHtml(doc.ref)}</td></tr>
          </table>
          <p>— The Eventsh Team</p>
        </div>`;
      await this.mailService.sendEmail({
        to,
        subject: `Eventsh — Tokens purchased (${doc.ref})`,
        html,
        attachments: [
          {
            filename: `eventsh-token-receipt-${doc.ref}.pdf`,
            content: fs.readFileSync(pdfPath),
          },
        ],
      });
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `Email receipt failed for topup ${doc._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private escapeHtml(s: string): string {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private topupToClient(row: any) {
    return {
      _id: String(row._id),
      tokensRequested: row.tokensRequested,
      amount: row.amount,
      currency: row.currency,
      scheme: row.scheme,
      ref: row.ref,
      status: row.status,
      submittedAt: row.submittedAt || null,
      createdAt: row.createdAt,
    };
  }
}
