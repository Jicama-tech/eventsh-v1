import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { OtpService } from "../otp/otp.service";
import { MailService } from "../roles/mail.service";
import {
  computePlanExpiry,
  formatPlanValidity,
} from "../plans/plan-validity.util";
import {
  computeAddOnProration,
  MIN_ADDON_REMAINING_DAYS,
} from "../plans/addon-proration.util";
import * as fs from "fs";
import * as path from "path";
// pdfkit ships without @types; use require to skip the missing-type error
// (matches the qrcode-reader pattern already used in payments.service.ts).
const PDFDocument = require("pdfkit");

interface InitiateBody {
  planId: string;
}

interface InitiateAddOnBody {
  addOnKey: string;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel("PendingSubscriptionPayment")
    private pendingModel: Model<any>,
    @InjectModel("Plan") private planModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("OrganizerAddOnPurchase")
    private addOnPurchaseModel: Model<any>,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Resolve the right price for the organizer's region.
   * IN-country → priceINR (currency INR, UPI scheme); everything else → price
   * (currency USD; we route through PayNow on SG and treat USD as the QR
   * face value — the QR generator accepts USD by mapping it to "840").
   */
  private resolveCharge(plan: any, country?: string) {
    const isIN = country === "IN" || country === "India";
    if (isIN) {
      const amount = Number(plan.priceINR || 0);
      return { amount, currency: "INR", scheme: "UPI" as const };
    }
    const isSG = country === "SG" || country === "Singapore" || country === "SGP";
    return {
      amount: Number(plan.price || 0),
      currency: isSG ? "SGD" : "USD",
      scheme: isSG ? ("PAYNOW" as const) : ("PAYNOW" as const),
    };
  }

  async initiate(organizerId: string, body: InitiateBody) {
    if (!body?.planId) throw new BadRequestException("planId required");
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");
    const plan = (await this.planModel.findById(body.planId).lean()) as any;
    if (!plan || !plan.isActive)
      throw new NotFoundException("Plan not found or inactive");

    const { amount, currency, scheme } = this.resolveCharge(
      plan,
      organizer.country,
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        "This plan has no price for your region — switch directly without checkout.",
      );
    }

    // Block double-submit: if there's already an open PLAN request, return it
    // instead of creating a second row. Add-on rows (type "addon") don't
    // block a plan purchase — they're independent line items. Legacy rows
    // predate the type field, so "not addon" rather than "type === plan".
    const existing = (await this.pendingModel
      .findOne({
        organizerId,
        status: { $in: ["awaiting_payment", "submitted"] },
        type: { $ne: "addon" },
      })
      .lean()) as any;
    if (existing) {
      return this.toClient(existing, plan);
    }

    const ref = `SUB-${String(organizerId).slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const doc = await this.pendingModel.create({
      organizerId,
      planId: plan._id,
      amount,
      currency,
      scheme,
      ref,
      status: "awaiting_payment",
    });
    return this.toClient(doc.toObject(), plan);
  }

  /**
   * Effective expiry of the organizer's CURRENT cycle — same rule as
   * organizers.service.getSubscriptionDetail: date-based plans track the
   * plan's validUntil live (admin edits reflect immediately); day-based
   * plans use the per-organizer expiry stamped at activation.
   */
  private effectivePlanExpiry(organizer: any, plan: any): Date | null {
    if (plan?.validityType === "date" && plan?.validUntil) {
      return new Date(plan.validUntil);
    }
    return organizer?.planExpiryDate
      ? new Date(organizer.planExpiryDate)
      : null;
  }

  // Regional full-cycle price for an add-on — mirrors resolveCharge.
  private resolveAddOnCharge(addOn: any, country?: string) {
    const isIN = country === "IN" || country === "India";
    if (isIN) {
      return {
        amount: Number(addOn.priceINR || 0),
        currency: "INR",
        scheme: "UPI" as const,
      };
    }
    const isSG =
      country === "SG" || country === "Singapore" || country === "SGP";
    return {
      amount: Number(addOn.price || 0),
      currency: isSG ? "SGD" : "USD",
      scheme: "PAYNOW" as const,
    };
  }

  /**
   * Quote endpoint — every active add-on on the organizer's current plan,
   * with live proration for "buy it today" plus ownership/pending state.
   * Purely informational: initiate recomputes everything server-side.
   */
  async listAddOns(organizerId: string) {
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");
    if (!organizer.subscribed || !organizer.planId) {
      return { planActive: false, addOns: [] };
    }
    const plan = (await this.planModel
      .findById(organizer.planId)
      .lean()) as any;
    const expiry = this.effectivePlanExpiry(organizer, plan);
    const now = new Date();
    if (!plan || !expiry || expiry.getTime() <= now.getTime()) {
      return { planActive: false, addOns: [] };
    }

    const startDate = organizer.planStartDate
      ? new Date(organizer.planStartDate)
      : now;

    // Ownership/pending state from this organizer's purchase rows.
    const purchases = (await this.addOnPurchaseModel
      .find({
        organizerId,
        status: { $in: ["pending_payment", "submitted", "active"] },
      })
      .lean()) as any[];
    const ownedKeys = new Set(
      purchases
        .filter(
          (p) =>
            p.status === "active" &&
            p.endDate &&
            new Date(p.endDate).getTime() >= now.getTime(),
        )
        .map((p) => p.addOnKey),
    );
    const pendingKeys = new Set(
      purchases
        .filter((p) => p.status === "pending_payment" || p.status === "submitted")
        .map((p) => p.addOnKey),
    );

    const baseModules = plan.modules || {};
    const rows = (Array.isArray(plan.addOns) ? plan.addOns : [])
      .filter((a: any) => a && a.isActive !== false)
      .map((a: any) => {
        const { amount, currency } = this.resolveAddOnCharge(
          a,
          organizer.country,
        );
        const proration = computeAddOnProration(amount, startDate, expiry, now);
        const owned = ownedKeys.has(a.key);
        const pending = pendingKeys.has(a.key);
        // "module" or "module:section" — section add-ons unlock one
        // sub-toggle and need their parent module live first.
        const [modKey, sectionKey] = String(a.key).split(":");
        const baseIncluded = sectionKey
          ? baseModules[modKey]?.sections?.[sectionKey] === true
          : baseModules[modKey]?.enabled === true;
        const parentLive =
          baseModules[modKey]?.enabled === true || ownedKeys.has(modKey);
        let blockedReason: string | null = null;
        if (!Number.isFinite(amount) || amount <= 0) {
          blockedReason = "No price configured for your region.";
        } else if (baseIncluded) {
          blockedReason = "Already included in your plan.";
        } else if (!a.limitDelta && owned) {
          blockedReason = "Already active on your plan.";
        } else if (pending) {
          blockedReason = "A purchase for this add-on is awaiting confirmation.";
        } else if (sectionKey && !parentLive) {
          blockedReason = `Requires the "${modKey}" module — unlock that add-on first.`;
        } else if (proration.remainingDays < MIN_ADDON_REMAINING_DAYS) {
          blockedReason = `Less than ${MIN_ADDON_REMAINING_DAYS} days left on your plan — renew the plan to add features.`;
        }
        return {
          key: a.key,
          name: a.name,
          description: a.description || null,
          limitDelta: a.limitDelta || null,
          fullPrice: amount,
          currency,
          proratedPrice: proration.proratedPrice,
          remainingDays: proration.remainingDays,
          cycleDays: proration.cycleDays,
          owned,
          pending,
          canPurchase: !blockedReason,
          blockedReason,
        };
      });

    return {
      planActive: true,
      planName: plan.planName,
      planExpiryDate: expiry,
      addOns: rows,
    };
  }

  /**
   * Start an add-on purchase. Recomputes proration server-side and FREEZES
   * the quoted amount on the purchase + payment rows — what the organizer
   * sees at the QR is what the admin confirms against, even if the transfer
   * is verified days later. Rides the same QR → mark-paid → admin-confirm
   * pipeline as plan purchases.
   */
  async initiateAddOn(organizerId: string, body: InitiateAddOnBody) {
    if (!body?.addOnKey) throw new BadRequestException("addOnKey required");
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");
    if (!organizer.subscribed || !organizer.planId) {
      throw new BadRequestException(
        "You need an active plan before buying add-ons.",
      );
    }
    const plan = (await this.planModel
      .findById(organizer.planId)
      .lean()) as any;
    if (!plan || !plan.isActive)
      throw new NotFoundException("Your plan is no longer available");

    const now = new Date();
    const expiry = this.effectivePlanExpiry(organizer, plan);
    if (!expiry || expiry.getTime() <= now.getTime()) {
      throw new BadRequestException(
        "Your plan has expired — renew it before buying add-ons.",
      );
    }

    const addOn = (Array.isArray(plan.addOns) ? plan.addOns : []).find(
      (a: any) => a?.key === body.addOnKey && a.isActive !== false,
    );
    if (!addOn)
      throw new NotFoundException("Add-on not available on your plan");

    const { amount, currency, scheme } = this.resolveAddOnCharge(
      addOn,
      organizer.country,
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        "This add-on has no price for your region.",
      );
    }

    // Pointless-purchase guards: the base plan may already include this
    // module/section (e.g. admin re-included it after pricing it earlier).
    const [modKey, sectionKey] = String(addOn.key).split(":");
    const baseModules = plan.modules || {};
    const baseIncluded = sectionKey
      ? baseModules[modKey]?.sections?.[sectionKey] === true
      : baseModules[modKey]?.enabled === true;
    if (baseIncluded) {
      throw new ConflictException("Already included in your plan.");
    }

    // Toggle add-ons can't be double-owned; limit packs may stack.
    if (!addOn.limitDelta) {
      const owned = await this.addOnPurchaseModel.exists({
        organizerId,
        addOnKey: addOn.key,
        status: "active",
        endDate: { $gte: now },
      });
      if (owned) {
        throw new ConflictException("This add-on is already active on your plan.");
      }
    }

    // Section add-ons need their parent module live (base or owned add-on)
    // — a section unlock inside a disabled module would grant nothing.
    if (sectionKey) {
      const parentOwned = await this.addOnPurchaseModel.exists({
        organizerId,
        addOnKey: modKey,
        status: "active",
        endDate: { $gte: now },
      });
      if (baseModules[modKey]?.enabled !== true && !parentOwned) {
        throw new BadRequestException(
          `Requires the "${modKey}" module — unlock that add-on first.`,
        );
      }
    }

    // Open request for the same key → return its payment row instead of
    // creating a duplicate (same double-submit guard as plan purchases).
    const openPurchase = (await this.addOnPurchaseModel
      .findOne({
        organizerId,
        addOnKey: addOn.key,
        status: { $in: ["pending_payment", "submitted"] },
      })
      .lean()) as any;
    if (openPurchase?.pendingPaymentId) {
      const existing = (await this.pendingModel
        .findById(openPurchase.pendingPaymentId)
        .lean()) as any;
      if (
        existing &&
        ["awaiting_payment", "submitted"].includes(existing.status)
      ) {
        return this.toAddOnClient(existing, openPurchase);
      }
    }

    const startDate = organizer.planStartDate
      ? new Date(organizer.planStartDate)
      : now;
    const proration = computeAddOnProration(amount, startDate, expiry, now);
    if (proration.remainingDays < MIN_ADDON_REMAINING_DAYS) {
      throw new BadRequestException(
        `Less than ${MIN_ADDON_REMAINING_DAYS} days left on your plan — renew the plan to add features.`,
      );
    }

    const purchase = await this.addOnPurchaseModel.create({
      organizerId,
      planId: plan._id,
      addOnKey: addOn.key,
      addOnName: addOn.name,
      limitDelta: addOn.limitDelta || undefined,
      fullPrice: proration.fullPrice,
      proratedPrice: proration.proratedPrice,
      currency,
      remainingDays: proration.remainingDays,
      cycleDays: proration.cycleDays,
      status: "pending_payment",
      history: [
        { action: "initiate", at: now, by: String(organizerId) },
      ],
    });

    const ref = `ADD-${String(organizerId).slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const payment = await this.pendingModel.create({
      organizerId,
      planId: plan._id,
      type: "addon",
      addOnPurchaseId: purchase._id,
      addOnKey: addOn.key,
      addOnName: addOn.name,
      amount: proration.proratedPrice,
      currency,
      scheme,
      ref,
      status: "awaiting_payment",
    });
    purchase.pendingPaymentId = payment._id;
    await purchase.save();

    return this.toAddOnClient(payment.toObject(), purchase.toObject());
  }

  /** Organizer's add-on purchases — active entitlements first, then history. */
  async listMyAddOns(organizerId: string) {
    const rows = (await this.addOnPurchaseModel
      .find({ organizerId })
      .sort({ createdAt: -1 })
      .lean()) as any[];
    const now = Date.now();
    return rows.map((r) => ({
      _id: String(r._id),
      addOnKey: r.addOnKey,
      addOnName: r.addOnName,
      limitDelta: r.limitDelta || null,
      fullPrice: r.fullPrice,
      proratedPrice: r.proratedPrice,
      currency: r.currency,
      remainingDays: r.remainingDays,
      cycleDays: r.cycleDays,
      status: r.status,
      startDate: r.startDate || null,
      endDate: r.endDate || null,
      isLive:
        r.status === "active" &&
        r.endDate &&
        new Date(r.endDate).getTime() >= now,
      createdAt: r.createdAt,
    }));
  }

  async markSubmitted(organizerId: string, id: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Subscription request not found");
    if (String(doc.organizerId) !== String(organizerId)) {
      throw new BadRequestException("Not your subscription request");
    }
    if (doc.status === "confirmed" || doc.status === "rejected") {
      throw new ConflictException(
        `Already ${doc.status}; cannot mark as paid again`,
      );
    }
    doc.status = "submitted";
    doc.submittedAt = new Date();
    await doc.save();
    // Keep the linked add-on purchase row in step so dashboards show
    // "awaiting confirmation" without joining the payments table.
    if (doc.type === "addon" && doc.addOnPurchaseId) {
      await this.addOnPurchaseModel.updateOne(
        { _id: doc.addOnPurchaseId, status: "pending_payment" },
        {
          $set: { status: "submitted" },
          $push: {
            history: {
              action: "mark_paid",
              at: new Date(),
              by: String(organizerId),
            },
          },
        },
      );
    }
    return { ok: true, status: doc.status };
  }

  async listPending() {
    const rows = await this.pendingModel
      .find({ status: { $in: ["awaiting_payment", "submitted"] } })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    if (rows.length === 0) return [];
    const orgIds = Array.from(new Set(rows.map((r: any) => String(r.organizerId))));
    const planIds = Array.from(new Set(rows.map((r: any) => String(r.planId))));
    const [orgs, plans] = await Promise.all([
      this.organizerModel
        .find({ _id: { $in: orgIds } })
        .select("name organizationName email whatsAppNumber country")
        .lean(),
      this.planModel
        .find({ _id: { $in: planIds } })
        .select("planName price priceINR validityInDays validityType validUntil")
        .lean(),
    ]);
    const orgMap = new Map(orgs.map((o: any) => [String(o._id), o]));
    const planMap = new Map(plans.map((p: any) => [String(p._id), p]));
    return rows.map((r: any) => ({
      _id: String(r._id),
      organizer: orgMap.get(String(r.organizerId)) || null,
      plan: planMap.get(String(r.planId)) || null,
      // "plan" or "addon" — legacy rows have no type field.
      type: r.type === "addon" ? "addon" : "plan",
      addOnKey: r.addOnKey || null,
      addOnName: r.addOnName || null,
      amount: r.amount,
      currency: r.currency,
      scheme: r.scheme,
      status: r.status,
      ref: r.ref,
      submittedAt: r.submittedAt || null,
      createdAt: r.createdAt,
    }));
  }

  async confirm(id: string, adminId?: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Subscription request not found");
    if (doc.status === "confirmed") {
      throw new ConflictException("Already confirmed");
    }
    if (doc.status === "rejected") {
      throw new ConflictException("Already rejected");
    }
    // Add-on settlements activate the linked purchase row instead of
    // switching the organizer's plan.
    if (doc.type === "addon") {
      return this.confirmAddOn(doc, adminId);
    }
    const plan = await this.planModel.findById(doc.planId);
    if (!plan || !plan.isActive)
      throw new NotFoundException("Plan no longer available");
    const organizer = await this.organizerModel.findById(doc.organizerId);
    if (!organizer) throw new NotFoundException("Organizer no longer exists");

    // Activate plan — mirrors organizers.service.ts:addSubscriptionPlan
    organizer.subscribed = true;
    organizer.planId = plan._id;
    organizer.planStartDate = new Date();
    organizer.planExpiryDate = computePlanExpiry(
      plan,
      organizer.planStartDate,
    );
    organizer.pricePaid = String(doc.amount);
    await organizer.save();

    doc.status = "confirmed";
    doc.confirmedAt = new Date();
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    await doc.save();

    // Generate the PDF receipt once and ship it via WhatsApp + email.
    // Both are best-effort — confirmation already succeeded, so a delivery
    // failure shouldn't roll back the plan activation. We DO surface the
    // status on the response so admin can see what went out.
    const pdfPath = await this.writeReceiptPdf(organizer, plan, doc);
    const whatsapp = await this.sendWhatsAppReceipt(organizer, doc, pdfPath);
    const email = await this.sendEmailReceipt(organizer, plan, doc, pdfPath);

    return {
      ok: true,
      organizerId: String(organizer._id),
      receiptPath: "/" + pdfPath.replace(/\\/g, "/").replace(/^\.?\//, ""),
      whatsapp,
      email,
    };
  }

  /**
   * Activate an add-on after the admin verified the transfer. The
   * entitlement is pinned to the organizer's CURRENT plan expiry
   * (co-terminus) — if the plan lapsed while the payment sat unverified,
   * activation is refused so the admin rejects/refunds instead of granting
   * a dead entitlement.
   */
  private async confirmAddOn(doc: any, adminId?: string) {
    const purchase = await this.addOnPurchaseModel.findById(
      doc.addOnPurchaseId,
    );
    if (!purchase)
      throw new NotFoundException("Add-on purchase record not found");
    if (purchase.status === "active")
      throw new ConflictException("Add-on already activated");
    const organizer = await this.organizerModel.findById(doc.organizerId);
    if (!organizer) throw new NotFoundException("Organizer no longer exists");
    const plan = await this.planModel.findById(purchase.planId).lean();
    const now = new Date();
    const expiry = this.effectivePlanExpiry(organizer, plan);
    if (!expiry || expiry.getTime() <= now.getTime()) {
      throw new ConflictException(
        "Organizer's plan has expired since this purchase — reject it instead.",
      );
    }
    if (
      !organizer.planId ||
      String(organizer.planId) !== String(purchase.planId)
    ) {
      throw new ConflictException(
        "Organizer switched plans since this purchase — reject it instead.",
      );
    }

    purchase.status = "active";
    purchase.startDate = now;
    purchase.endDate = expiry;
    purchase.history.push({
      action: "confirm",
      at: now,
      by: adminId ? String(adminId) : "admin",
    });
    await purchase.save();

    doc.status = "confirmed";
    doc.confirmedAt = now;
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    await doc.save();

    // Receipt with the proration breakdown — best-effort, like plan receipts.
    let receiptPath: string | null = null;
    let whatsapp: { sent: boolean; error?: string } = { sent: false };
    let email: { sent: boolean; error?: string } = { sent: false };
    try {
      const pdfPath = await this.writeAddOnReceiptPdf(
        organizer,
        purchase,
        doc,
      );
      receiptPath =
        "/" + pdfPath.replace(/\\/g, "/").replace(/^\.?\//, "");
      whatsapp = await this.sendWhatsAppReceipt(organizer, doc, pdfPath);
      email = await this.sendAddOnEmailReceipt(
        organizer,
        purchase,
        doc,
        pdfPath,
      );
    } catch (e: any) {
      this.logger.warn(
        `Add-on receipt failed for org=${organizer._id}: ${e?.message || e}`,
      );
    }

    return {
      ok: true,
      organizerId: String(organizer._id),
      addOnKey: purchase.addOnKey,
      activeUntil: expiry,
      receiptPath,
      whatsapp,
      email,
    };
  }

  async reject(id: string, reason?: string, adminId?: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Subscription request not found");
    if (doc.status === "confirmed")
      throw new ConflictException("Already confirmed; cannot reject");
    doc.status = "rejected";
    doc.rejectionReason = (reason || "").slice(0, 500);
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    doc.confirmedAt = new Date();
    await doc.save();
    // Close out the linked add-on purchase so it stops blocking re-buys.
    if (doc.type === "addon" && doc.addOnPurchaseId) {
      await this.addOnPurchaseModel.updateOne(
        { _id: doc.addOnPurchaseId, status: { $in: ["pending_payment", "submitted"] } },
        {
          $set: { status: "rejected" },
          $push: {
            history: {
              action: "reject",
              at: new Date(),
              by: adminId ? String(adminId) : "admin",
              note: doc.rejectionReason || undefined,
            },
          },
        },
      );
    }
    return { ok: true };
  }

  /**
   * Daily hygiene — flips `active` add-on purchases whose endDate passed to
   * `expired`. Entitlement checks also filter by endDate at read time, so
   * this sweep is bookkeeping, not the security boundary. Idempotent.
   */
  async expireDueAddOns(): Promise<number> {
    const res = await this.addOnPurchaseModel.updateMany(
      { status: "active", endDate: { $lt: new Date() } },
      {
        $set: { status: "expired" },
        $push: {
          history: { action: "expire", at: new Date(), by: "system" },
        },
      },
    );
    return res.modifiedCount || 0;
  }

  // ----- helpers -----

  private toClient(row: any, plan: any) {
    return {
      _id: String(row._id),
      planId: String(row.planId),
      planName: plan?.planName,
      amount: row.amount,
      currency: row.currency,
      scheme: row.scheme,
      ref: row.ref,
      status: row.status,
      submittedAt: row.submittedAt || null,
      createdAt: row.createdAt,
    };
  }

  // Same client shape as toClient so SubscriptionCheckoutDialog renders
  // add-on checkouts unchanged; addOn fields ride along for labelling.
  private toAddOnClient(payment: any, purchase: any) {
    return {
      _id: String(payment._id),
      planId: String(payment.planId),
      type: "addon",
      addOnKey: purchase.addOnKey,
      addOnName: purchase.addOnName,
      fullPrice: purchase.fullPrice,
      remainingDays: purchase.remainingDays,
      cycleDays: purchase.cycleDays,
      amount: payment.amount,
      currency: payment.currency,
      scheme: payment.scheme,
      ref: payment.ref,
      status: payment.status,
      submittedAt: payment.submittedAt || null,
      createdAt: payment.createdAt,
    };
  }

  private currencySymbol(currency: string) {
    if (currency === "INR") return "Rs.";
    if (currency === "SGD") return "SG$";
    return "$";
  }

  /**
   * Build an invoice-style PDF receipt and persist it under
   * uploads/receipts/<ref>.pdf so it can be attached to email and shipped
   * via the WhatsApp media path. Layout:
   *   - branded header with reference + issue date
   *   - Bill-To and Payment Details two-column box
   *   - line-items table with column headers and totals row
   *   - included-features table (numbered)
   *   - footer with validity + active-status pill
   * pdfkit currency note: the built-in Helvetica WinAnsi encoding doesn't
   * include the rupee glyph (₹) — INR amounts use "Rs." so the PDF
   * doesn't show a missing-glyph box.
   */
  private writeReceiptPdf(organizer: any, plan: any, doc: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.join(process.cwd(), "uploads", "receipts");
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore — usually exists
      }
      const filePath = path.join(dir, `${doc.ref}.pdf`);
      const stream = fs.createWriteStream(filePath);
      const pdf = new PDFDocument({ size: "A4", margin: 40 });
      pdf.pipe(stream);

      // ----- palette + layout constants ---------------------------------
      const C = {
        ink: "#0f172a",          // slate-900
        body: "#1f2937",         // slate-800
        muted: "#64748b",        // slate-500
        line: "#e2e8f0",         // slate-200
        zebra: "#f8fafc",        // slate-50
        accentBg: "#0f172a",     // dark band header
        accentInk: "#ffffff",
        good: "#16a34a",         // green-600
        goodBg: "#dcfce7",       // green-100
      };
      const pageLeft = 40;
      const pageRight = 595 - 40; // A4 width in pts
      const usable = pageRight - pageLeft;

      const symbol = this.currencySymbol(doc.currency);
      const amountStr = `${symbol}${doc.amount.toFixed(2)} ${doc.currency}`;
      const issued = new Date().toLocaleString();
      const validTill = organizer.planExpiryDate
        ? new Date(organizer.planExpiryDate).toLocaleDateString()
        : "—";
      const methodLabel =
        doc.scheme === "UPI" ? "UPI (India)" : "PayNow (Singapore)";

      // ----- header band ------------------------------------------------
      pdf.rect(pageLeft, 40, usable, 70).fill(C.accentBg);
      pdf
        .fillColor(C.accentInk)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("EVENTSH", pageLeft + 18, 55);
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text("Event management platform", pageLeft + 18, 82);
      // right side: receipt title + meta
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(C.accentInk)
        .text("PAYMENT RECEIPT", pageLeft, 55, {
          width: usable - 18,
          align: "right",
        });
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text(`Ref: ${doc.ref}`, pageLeft, 75, {
          width: usable - 18,
          align: "right",
        })
        .text(`Issued: ${issued}`, pageLeft, 88, {
          width: usable - 18,
          align: "right",
        });

      let y = 130;

      // ----- Bill-To + Payment Details two-column box ------------------
      const colW = (usable - 12) / 2;
      const billToX = pageLeft;
      const payX = pageLeft + colW + 12;
      const boxH = 90;

      // titles
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("BILLED TO", billToX, y)
        .text("PAYMENT DETAILS", payX, y);

      // boxes
      pdf
        .lineWidth(0.6)
        .strokeColor(C.line)
        .rect(billToX, y + 14, colW, boxH)
        .stroke();
      pdf.rect(payX, y + 14, colW, boxH).stroke();

      // bill-to body
      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(C.ink)
        .text(
          organizer.organizationName || organizer.name || "—",
          billToX + 10,
          y + 22,
          { width: colW - 20 },
        );
      pdf
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(C.body)
        .text(organizer.name || "", billToX + 10, y + 38, {
          width: colW - 20,
        })
        .text(organizer.email || organizer.businessEmail || "—", billToX + 10, y + 52, {
          width: colW - 20,
        })
        .text(
          organizer.whatsAppNumber ? `WhatsApp: ${organizer.whatsAppNumber}` : "",
          billToX + 10,
          y + 66,
          { width: colW - 20 },
        );
      if (organizer.country) {
        pdf
          .fontSize(9)
          .fillColor(C.muted)
          .text(`Country: ${organizer.country}`, billToX + 10, y + 82, {
            width: colW - 20,
          });
      }

      // payment-details body — key/value rows
      const payRows: Array<[string, string]> = [
        ["Reference", doc.ref],
        ["Method", methodLabel],
        ["Currency", doc.currency],
        ["Amount", amountStr],
        ["Issued", issued],
      ];
      payRows.forEach(([k, v], i) => {
        const ry = y + 22 + i * 14;
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.muted)
          .text(k, payX + 10, ry, { width: 72 });
        pdf
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor(C.body)
          .text(v, payX + 10 + 75, ry, { width: colW - 95 });
      });

      y += 14 + boxH + 24;

      // ----- Line items table ------------------------------------------
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ITEMS", pageLeft, y);
      y += 14;

      const cols = [
        { x: pageLeft, w: usable * 0.55, label: "DESCRIPTION", align: "left" as const },
        {
          x: pageLeft + usable * 0.55,
          w: usable * 0.2,
          label: "PERIOD",
          align: "center" as const,
        },
        {
          x: pageLeft + usable * 0.75,
          w: usable * 0.25,
          label: "AMOUNT",
          align: "right" as const,
        },
      ];

      // header row
      pdf.rect(pageLeft, y, usable, 22).fill(C.accentBg);
      cols.forEach((c) => {
        pdf
          .fillColor(C.accentInk)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(c.label, c.x + 8, y + 7, {
            width: c.w - 16,
            align: c.align,
          });
      });
      y += 22;

      // body row(s) — just the plan line for now
      const descText = plan.description
        ? `${plan.planName}\n${plan.description}`
        : plan.planName;
      pdf
        .font("Helvetica")
        .fontSize(10)
        .fillColor(C.body);
      // measure desc height with wrapping at the desc column width
      const descH = pdf.heightOfString(descText, {
        width: cols[0].w - 16,
      });
      const rowH = Math.max(34, descH + 14);
      pdf.rect(pageLeft, y, usable, rowH).fillAndStroke(C.zebra, C.line);
      pdf
        .fillColor(C.ink)
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .text(plan.planName, cols[0].x + 8, y + 8, {
          width: cols[0].w - 16,
        });
      if (plan.description) {
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.muted)
          .text(plan.description, cols[0].x + 8, y + 22, {
            width: cols[0].w - 16,
          });
      }
      pdf
        .fillColor(C.body)
        .font("Helvetica")
        .fontSize(10.5)
        .text(`${formatPlanValidity(plan)}`, cols[1].x + 8, y + 12, {
          width: cols[1].w - 16,
          align: "center",
        })
        .font("Helvetica-Bold")
        .text(amountStr, cols[2].x + 8, y + 12, {
          width: cols[2].w - 16,
          align: "right",
        });
      y += rowH;

      // totals row
      const totalRowH = 26;
      pdf
        .rect(pageLeft, y, usable, totalRowH)
        .fillAndStroke("#ffffff", C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(C.muted)
        .text("TOTAL PAID", cols[1].x + 8, y + 9, {
          width: cols[1].w - 16,
          align: "right",
        });
      pdf
        .fillColor(C.ink)
        .fontSize(12)
        .text(amountStr, cols[2].x + 8, y + 7, {
          width: cols[2].w - 16,
          align: "right",
        });
      y += totalRowH + 18;

      // ----- Included features table -----------------------------------
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("INCLUDED IN THIS PLAN", pageLeft, y);
      y += 14;

      const features: string[] =
        Array.isArray(plan.features) && plan.features.length
          ? plan.features
          : ["(no features listed)"];
      const featCols = [
        { x: pageLeft, w: 32, label: "#", align: "center" as const },
        {
          x: pageLeft + 32,
          w: usable - 32,
          label: "FEATURE",
          align: "left" as const,
        },
      ];
      pdf.rect(pageLeft, y, usable, 20).fill(C.accentBg);
      featCols.forEach((c) => {
        pdf
          .fillColor(C.accentInk)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(c.label, c.x + 8, y + 6, {
            width: c.w - 16,
            align: c.align,
          });
      });
      y += 20;

      pdf.font("Helvetica").fontSize(10).fillColor(C.body);
      features.forEach((f, i) => {
        // page-overflow guard — start a new page if we'd cross the margin
        if (y > 760) {
          pdf.addPage();
          y = 50;
        }
        const fh =
          pdf.heightOfString(f, { width: featCols[1].w - 16 }) + 12;
        const fill = i % 2 === 0 ? "#ffffff" : C.zebra;
        pdf.rect(pageLeft, y, usable, fh).fillAndStroke(fill, C.line);
        pdf
          .fillColor(C.muted)
          .font("Helvetica")
          .fontSize(10)
          .text(String(i + 1), featCols[0].x + 8, y + 6, {
            width: featCols[0].w - 16,
            align: "center",
          });
        pdf
          .fillColor(C.body)
          .font("Helvetica")
          .fontSize(10)
          .text(f, featCols[1].x + 8, y + 6, {
            width: featCols[1].w - 16,
          });
        y += fh;
      });

      y += 18;
      if (y > 740) {
        pdf.addPage();
        y = 50;
      }

      // ----- Validity footer with status pill --------------------------
      pdf.rect(pageLeft, y, usable, 44).fillAndStroke(C.zebra, C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ACTIVE UNTIL", pageLeft + 14, y + 10);
      pdf
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(C.ink)
        .text(validTill, pageLeft + 14, y + 22, { width: usable / 2 - 14 });
      // status pill on the right
      const pillW = 70;
      const pillX = pageRight - pillW - 14;
      pdf
        .roundedRect(pillX, y + 14, pillW, 18, 9)
        .fillAndStroke(C.goodBg, C.good);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.good)
        .text("ACTIVE", pillX, y + 19, {
          width: pillW,
          align: "center",
        });
      y += 44 + 18;

      // ----- Footer note ----------------------------------------------
      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text(
          "This is an electronically generated receipt — no signature required. " +
            "If you have any questions, reply to the email this receipt was attached to.",
          pageLeft,
          y,
          { width: usable, align: "center" },
        );

      pdf.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }

  /**
   * Add-on receipt — same invoice styling as writeReceiptPdf but the line
   * item is the add-on with an explicit proration breakdown (full-cycle
   * price, days covered, prorated charge) and a co-terminus expiry footer.
   */
  private writeAddOnReceiptPdf(
    organizer: any,
    purchase: any,
    doc: any,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.join(process.cwd(), "uploads", "receipts");
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore — usually exists
      }
      const filePath = path.join(dir, `${doc.ref}.pdf`);
      const stream = fs.createWriteStream(filePath);
      const pdf = new PDFDocument({ size: "A4", margin: 40 });
      pdf.pipe(stream);

      const C = {
        ink: "#0f172a",
        body: "#1f2937",
        muted: "#64748b",
        line: "#e2e8f0",
        zebra: "#f8fafc",
        accentBg: "#0f172a",
        accentInk: "#ffffff",
        good: "#16a34a",
        goodBg: "#dcfce7",
      };
      const pageLeft = 40;
      const pageRight = 595 - 40;
      const usable = pageRight - pageLeft;

      const symbol = this.currencySymbol(doc.currency);
      const amountStr = `${symbol}${Number(doc.amount).toFixed(2)} ${doc.currency}`;
      const fullStr = `${symbol}${Number(purchase.fullPrice).toFixed(2)} ${doc.currency}`;
      const issued = new Date().toLocaleString();
      const validTill = purchase.endDate
        ? new Date(purchase.endDate).toLocaleDateString()
        : "—";
      const methodLabel =
        doc.scheme === "UPI" ? "UPI (India)" : "PayNow (Singapore)";

      // ----- header band ------------------------------------------------
      pdf.rect(pageLeft, 40, usable, 70).fill(C.accentBg);
      pdf
        .fillColor(C.accentInk)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("EVENTSH", pageLeft + 18, 55);
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text("Event management platform", pageLeft + 18, 82);
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(C.accentInk)
        .text("ADD-ON RECEIPT", pageLeft, 55, {
          width: usable - 18,
          align: "right",
        });
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text(`Ref: ${doc.ref}`, pageLeft, 75, {
          width: usable - 18,
          align: "right",
        })
        .text(`Issued: ${issued}`, pageLeft, 88, {
          width: usable - 18,
          align: "right",
        });

      let y = 130;

      // ----- Bill-To + Payment Details two-column box ------------------
      const colW = (usable - 12) / 2;
      const billToX = pageLeft;
      const payX = pageLeft + colW + 12;
      const boxH = 90;

      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("BILLED TO", billToX, y)
        .text("PAYMENT DETAILS", payX, y);
      pdf
        .lineWidth(0.6)
        .strokeColor(C.line)
        .rect(billToX, y + 14, colW, boxH)
        .stroke();
      pdf.rect(payX, y + 14, colW, boxH).stroke();

      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(C.ink)
        .text(
          organizer.organizationName || organizer.name || "—",
          billToX + 10,
          y + 22,
          { width: colW - 20 },
        );
      pdf
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(C.body)
        .text(organizer.name || "", billToX + 10, y + 38, {
          width: colW - 20,
        })
        .text(
          organizer.email || organizer.businessEmail || "—",
          billToX + 10,
          y + 52,
          { width: colW - 20 },
        );

      const payRows: Array<[string, string]> = [
        ["Reference", doc.ref],
        ["Method", methodLabel],
        ["Currency", doc.currency],
        ["Amount", amountStr],
        ["Issued", issued],
      ];
      payRows.forEach(([k, v], i) => {
        const ry = y + 22 + i * 14;
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.muted)
          .text(k, payX + 10, ry, { width: 72 });
        pdf
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor(C.body)
          .text(v, payX + 10 + 75, ry, { width: colW - 95 });
      });

      y += 14 + boxH + 24;

      // ----- Line item + proration breakdown ----------------------------
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ITEMS", pageLeft, y);
      y += 14;

      const cols = [
        { x: pageLeft, w: usable * 0.55, label: "DESCRIPTION", align: "left" as const },
        {
          x: pageLeft + usable * 0.55,
          w: usable * 0.2,
          label: "PERIOD",
          align: "center" as const,
        },
        {
          x: pageLeft + usable * 0.75,
          w: usable * 0.25,
          label: "AMOUNT",
          align: "right" as const,
        },
      ];
      pdf.rect(pageLeft, y, usable, 22).fill(C.accentBg);
      cols.forEach((c) => {
        pdf
          .fillColor(C.accentInk)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(c.label, c.x + 8, y + 7, { width: c.w - 16, align: c.align });
      });
      y += 22;

      const addOnLabel = purchase.limitDelta
        ? `${purchase.addOnName} (+${purchase.limitDelta})`
        : purchase.addOnName;
      const rowH = 44;
      pdf.rect(pageLeft, y, usable, rowH).fillAndStroke(C.zebra, C.line);
      pdf
        .fillColor(C.ink)
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .text(`${addOnLabel} — Add-On`, cols[0].x + 8, y + 8, {
          width: cols[0].w - 16,
        });
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor(C.muted)
        .text(
          `Full-cycle price ${fullStr}, prorated for the days left on your plan`,
          cols[0].x + 8,
          y + 24,
          { width: cols[0].w - 16 },
        );
      pdf
        .fillColor(C.body)
        .font("Helvetica")
        .fontSize(10.5)
        .text(
          `${purchase.remainingDays} of ${purchase.cycleDays} days`,
          cols[1].x + 8,
          y + 16,
          { width: cols[1].w - 16, align: "center" },
        )
        .font("Helvetica-Bold")
        .text(amountStr, cols[2].x + 8, y + 16, {
          width: cols[2].w - 16,
          align: "right",
        });
      y += rowH;

      const totalRowH = 26;
      pdf.rect(pageLeft, y, usable, totalRowH).fillAndStroke("#ffffff", C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(C.muted)
        .text("TOTAL PAID", cols[1].x + 8, y + 9, {
          width: cols[1].w - 16,
          align: "right",
        });
      pdf
        .fillColor(C.ink)
        .fontSize(12)
        .text(amountStr, cols[2].x + 8, y + 7, {
          width: cols[2].w - 16,
          align: "right",
        });
      y += totalRowH + 18;

      // ----- Validity footer with status pill --------------------------
      pdf.rect(pageLeft, y, usable, 44).fillAndStroke(C.zebra, C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ACTIVE UNTIL (EXPIRES WITH YOUR PLAN)", pageLeft + 14, y + 10);
      pdf
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(C.ink)
        .text(validTill, pageLeft + 14, y + 22, { width: usable / 2 - 14 });
      const pillW = 70;
      const pillX = pageRight - pillW - 14;
      pdf
        .roundedRect(pillX, y + 14, pillW, 18, 9)
        .fillAndStroke(C.goodBg, C.good);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.good)
        .text("ACTIVE", pillX, y + 19, { width: pillW, align: "center" });
      y += 44 + 18;

      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text(
          "This is an electronically generated receipt — no signature required. " +
            "Add-ons expire together with your plan; renew them with your next plan cycle.",
          pageLeft,
          y,
          { width: usable, align: "center" },
        );

      pdf.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }

  private async sendAddOnEmailReceipt(
    organizer: any,
    purchase: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const to = organizer.email || organizer.businessEmail;
    if (!to) return { sent: false, error: "no_email" };
    try {
      const symbol = this.currencySymbol(doc.currency);
      const validTill = purchase.endDate
        ? new Date(purchase.endDate).toLocaleDateString()
        : "—";
      const addOnLabel = purchase.limitDelta
        ? `${purchase.addOnName} (+${purchase.limitDelta})`
        : purchase.addOnName;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
          <h2>Add-on activated</h2>
          <p>Hi ${this.escapeHtml(organizer.name || "there")},</p>
          <p>The <strong>${this.escapeHtml(addOnLabel)}</strong> add-on is now active on your plan. A PDF receipt is attached for your records.</p>
          <table style="border-collapse: collapse; margin: 12px 0;">
            <tr><td style="padding: 4px 12px; color: #6b7280;">Full-cycle price</td><td style="padding: 4px 12px; font-weight: 600;">${symbol}${purchase.fullPrice} ${doc.currency}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Prorated for</td><td style="padding: 4px 12px; font-weight: 600;">${purchase.remainingDays} of ${purchase.cycleDays} days</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Amount paid</td><td style="padding: 4px 12px; font-weight: 600;">${symbol}${doc.amount} ${doc.currency}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Active until</td><td style="padding: 4px 12px; font-weight: 600;">${validTill} (expires with your plan)</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Reference</td><td style="padding: 4px 12px; font-family: monospace;">${this.escapeHtml(doc.ref)}</td></tr>
          </table>
          <p>— The Eventsh Team</p>
        </div>`;
      await this.mailService.sendEmail({
        to,
        subject: `Eventsh — ${addOnLabel} add-on activated (${doc.ref})`,
        html,
        attachments: [
          {
            filename: `eventsh-receipt-${doc.ref}.pdf`,
            content: fs.readFileSync(pdfPath),
          },
        ],
      });
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `Add-on email receipt failed for org=${organizer._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private async sendWhatsAppReceipt(
    organizer: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    if (!organizer.whatsAppNumber) {
      return { sent: false, error: "no_whatsapp_number" };
    }
    try {
      const caption =
        doc.type === "addon"
          ? `Your Eventsh add-on${doc.addOnName ? ` "${doc.addOnName}"` : ""} is active. Receipt attached. Ref: ${doc.ref}`
          : `Your Eventsh subscription is active. Receipt attached. Ref: ${doc.ref}`;
      await this.otpService.sendMediaMessage(
        organizer.whatsAppNumber,
        pdfPath,
        caption,
        `eventsh-receipt-${doc.ref}.pdf`,
      );
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `WhatsApp receipt failed for org=${organizer._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private async sendEmailReceipt(
    organizer: any,
    plan: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const to = organizer.email || organizer.businessEmail;
    if (!to) return { sent: false, error: "no_email" };
    try {
      const symbol = this.currencySymbol(doc.currency);
      const validTill = organizer.planExpiryDate
        ? new Date(organizer.planExpiryDate).toLocaleDateString()
        : "—";
      const featuresHtml =
        Array.isArray(plan.features) && plan.features.length
          ? `<ul>${plan.features
              .map((f: string) => `<li>${this.escapeHtml(f)}</li>`)
              .join("")}</ul>`
          : "<p><em>(no features listed)</em></p>";
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
          <h2>Subscription activated</h2>
          <p>Hi ${this.escapeHtml(organizer.name || "there")},</p>
          <p>Your <strong>${this.escapeHtml(plan.planName)}</strong> plan is now active. A PDF receipt is attached for your records.</p>
          <table style="border-collapse: collapse; margin: 12px 0;">
            <tr><td style="padding: 4px 12px; color: #6b7280;">Amount paid</td><td style="padding: 4px 12px; font-weight: 600;">${symbol}${doc.amount} ${doc.currency}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Validity</td><td style="padding: 4px 12px; font-weight: 600;">${formatPlanValidity(plan)}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Active until</td><td style="padding: 4px 12px; font-weight: 600;">${validTill}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Reference</td><td style="padding: 4px 12px; font-family: monospace;">${this.escapeHtml(doc.ref)}</td></tr>
          </table>
          ${plan.description ? `<p>${this.escapeHtml(plan.description)}</p>` : ""}
          <h3>What's included</h3>
          ${featuresHtml}
          <p>— The Eventsh Team</p>
        </div>`;
      await this.mailService.sendEmail({
        to,
        subject: `Eventsh — ${plan.planName} activated (${doc.ref})`,
        html,
        attachments: [
          {
            filename: `eventsh-receipt-${doc.ref}.pdf`,
            content: fs.readFileSync(pdfPath),
          },
        ],
      });
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `Email receipt failed for org=${organizer._id}: ${e?.message || e}`,
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

  private renderReceipt(organizer: any, plan: any, doc: any) {
    const features =
      Array.isArray(plan.features) && plan.features.length
        ? plan.features.map((f: string) => `  • ${f}`).join("\n")
        : "  • (no features listed)";
    const symbol = doc.currency === "INR" ? "₹" : doc.currency === "SGD" ? "SG$" : "$";
    const validTill = organizer.planExpiryDate
      ? new Date(organizer.planExpiryDate).toLocaleDateString()
      : "—";
    return [
      `*Eventsh — Subscription Receipt*`,
      ``,
      `Hi ${organizer.name || organizer.organizationName || "there"},`,
      `Your payment has been confirmed. Here are your plan details:`,
      ``,
      `*Plan:* ${plan.planName}`,
      plan.description ? `*About:* ${plan.description}` : null,
      `*Amount paid:* ${symbol}${doc.amount}`,
      `*Validity:* ${formatPlanValidity(plan)} (until ${validTill})`,
      `*Reference:* ${doc.ref}`,
      ``,
      `*Included:*`,
      features,
      ``,
      `Thanks for choosing Eventsh.`,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
