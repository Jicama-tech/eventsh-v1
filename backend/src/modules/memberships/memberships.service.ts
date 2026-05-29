import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit");
import { OtpService } from "../otp/otp.service";
import {
  MembershipPlan,
  MembershipPlanDocument,
} from "./schemas/membership-plan.schema";
import {
  ExhibitorMembership,
  ExhibitorMembershipDocument,
} from "./schemas/exhibitor-membership.schema";
import {
  Organizer,
  OrganizerDocument,
} from "../organizers/schemas/organizer.schema";
import { Vendor, VendorDocument } from "../stalls/schemas/vendor.schema";
import {
  CreateMembershipPlanDto,
  UpdateMembershipPlanDto,
} from "./dto/membership-plan.dto";
import {
  ConfirmMembershipDto,
  RegisterMembershipPurchaseDto,
  RejectMembershipDto,
} from "./dto/exhibitor-membership.dto";
import { MailService } from "../roles/mail.service";

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: "INR",
  SG: "SGD",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  AU: "AUD",
  EU: "EUR",
};

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    @InjectModel(MembershipPlan.name)
    private readonly planModel: Model<MembershipPlanDocument>,
    @InjectModel(ExhibitorMembership.name)
    private readonly membershipModel: Model<ExhibitorMembershipDocument>,
    @InjectModel(Organizer.name)
    private readonly organizerModel: Model<OrganizerDocument>,
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
    private readonly mailService: MailService,
    // forwardRef because OtpModule pulls OrganizersModule which can
    // create a cycle if it ever imports MembershipsModule down the line.
    @Inject(forwardRef(() => OtpService))
    private readonly otpService: OtpService,
  ) {}

  private toObjectId(id: string, label = "id") {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return new Types.ObjectId(id);
  }

  private async resolveCurrency(organizerId: Types.ObjectId): Promise<string> {
    const org = await this.organizerModel
      .findById(organizerId)
      .select("country")
      .lean();
    const country = (org as any)?.country?.toUpperCase?.() || "US";
    return COUNTRY_CURRENCY[country] || "USD";
  }

  // ────────────────────────────────────────────────────────────────────
  // PLANS
  // ────────────────────────────────────────────────────────────────────

  async listPlansForOrganizer(organizerId: string) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    return this.planModel
      .find({ organizerId: orgObjId, archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Returns the minimum payment-config fields the storefront dialog
  // needs to render a dynamic PayNow / UPI QR. Mirrors the shape used
  // by the existing tablePaymentPage so the QR builder is the same.
  async getStorefrontPaymentInfo(slug: string) {
    const storeDoc: any = await this.organizerModel.db
      .collection("organizer_stores")
      .findOne({ slug });
    if (!storeDoc?.organizerId) return null;
    return this.getPaymentInfoForOrganizer(String(storeDoc.organizerId));
  }

  // Same payload as getStorefrontPaymentInfo but keyed by organizerId —
  // used by the eventfront's Member dialog which already knows the
  // organizer directly.
  async getPaymentInfoForOrganizer(organizerId: string) {
    if (!Types.ObjectId.isValid(organizerId)) return null;
    const org: any = await this.organizerModel
      .findById(organizerId)
      .select(
        "country UENNumber payNowId paymentURL organizationName businessName name",
      )
      .lean();
    if (!org) return null;
    return {
      organizerId: String(organizerId),
      country: org.country || null,
      UENNumber: org.UENNumber || null,
      payNowId: org.payNowId || null,
      paymentURL: org.paymentURL || null,
      company:
        org.organizationName ||
        org.businessName ||
        org.name ||
        "",
    };
  }

  // Public-storefront view — only published, non-archived plans.
  async listPublishedPlansForOrganizer(organizerId: string) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    return this.planModel
      .find({
        organizerId: orgObjId,
        published: true,
        archived: { $ne: true },
      })
      .sort({ price: 1 })
      .lean();
  }

  async createPlan(organizerId: string, dto: CreateMembershipPlanDto) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const currency =
      dto.currency?.toUpperCase() || (await this.resolveCurrency(orgObjId));
    const created = await this.planModel.create({
      organizerId: orgObjId,
      name: dto.name.trim(),
      description: dto.description,
      price: dto.price,
      currency,
      durationDays: dto.durationDays,
      perks: dto.perks || [],
      color: dto.color || "#6366f1",
      published: dto.published ?? false,
    });
    return created.toObject();
  }

  async updatePlan(
    organizerId: string,
    planId: string,
    dto: UpdateMembershipPlanDto,
  ) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const planObjId = this.toObjectId(planId, "planId");
    const plan = await this.planModel.findOne({
      _id: planObjId,
      organizerId: orgObjId,
    });
    if (!plan) throw new NotFoundException("Plan not found");
    Object.assign(plan, dto);
    if (typeof dto.name === "string") plan.name = dto.name.trim();
    await plan.save();
    return plan.toObject();
  }

  // Soft delete — archive so existing memberships keep their reference.
  async archivePlan(organizerId: string, planId: string) {
    return this.updatePlan(organizerId, planId, { archived: true });
  }

  // ────────────────────────────────────────────────────────────────────
  // EXHIBITOR MEMBERSHIPS
  // ────────────────────────────────────────────────────────────────────

  async listMembershipsForOrganizer(
    organizerId: string,
    opts: { status?: string; limit?: number } = {},
  ) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const q: any = { organizerId: orgObjId };
    if (opts.status) q.status = opts.status;
    const cursor = this.membershipModel
      .find(q)
      .populate("planId", "name price currency durationDays color")
      .sort({ createdAt: -1 });
    if (opts.limit) cursor.limit(opts.limit);
    return cursor.lean();
  }

  async getSummaryForOrganizer(organizerId: string) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [counts, expiring, revenueAgg] = await Promise.all([
      this.membershipModel.aggregate([
        { $match: { organizerId: orgObjId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.membershipModel.countDocuments({
        organizerId: orgObjId,
        status: "active",
        endDate: { $gte: now, $lte: in30 },
      }),
      this.membershipModel.aggregate([
        { $match: { organizerId: orgObjId, status: "active" } },
        { $group: { _id: null, revenue: { $sum: "$amountPaid" } } },
      ]),
    ]);
    const byStatus: Record<string, number> = {};
    for (const c of counts) byStatus[c._id as string] = c.count;
    return {
      counts: byStatus,
      expiringSoon: expiring,
      activeRevenue: (revenueAgg[0] as any)?.revenue || 0,
    };
  }

  // Storefront step 1: look up an exhibitor by WhatsApp number. We search
  // the WHOLE Vendor collection — not just vendors already linked to this
  // organizer — so a known exhibitor's name/email/business prefill no
  // matter whose storefront they're buying from. We still prefer a row
  // owned by the current organizer when one exists (e.g. they've booked
  // a stall before), since that copy is the most up-to-date for this
  // relationship.
  //
  // The `activeMembership` check stays organizer-scoped — being a member
  // of organizer A doesn't block buying from organizer B.
  //
  // Always returns the `{ vendor, activeMembership }` envelope so the
  // storefront dialog can parse without special-casing empty bodies.
  async lookupExhibitor(organizerId: string, whatsapp: string) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const normalized = whatsapp.replace(/[^\d+]/g, "");
    const candidates: any[] = [];
    if (normalized) candidates.push(normalized);
    if (normalized.startsWith("+")) candidates.push(normalized.slice(1));
    else candidates.push(`+${normalized}`);

    const phoneMatch = {
      $or: [
        { whatsAppNumber: { $in: candidates } },
        { whatsappNumber: { $in: candidates } },
        { phoneNumber: { $in: candidates } },
        { phone: { $in: candidates } },
      ],
    };

    // First-pass: prefer a vendor row already owned by this organizer.
    // Falls back to a global match if none — common for an exhibitor who's
    // never interacted with this organizer before.
    let vendor = await this.vendorModel
      .findOne({ organizerId: orgObjId, ...phoneMatch })
      .lean();
    if (!vendor) {
      vendor = await this.vendorModel.findOne(phoneMatch).lean();
    }

    if (!vendor) return { vendor: null, activeMembership: null };

    const active = await this.membershipModel
      .findOne({
        organizerId: orgObjId,
        exhibitorEmail: ((vendor as any).email || "").toLowerCase(),
        status: "active",
      })
      .populate("planId", "name endDate")
      .lean();
    return { vendor, activeMembership: active };
  }

  // Storefront step 3 (after payment): register the purchase. Lazy-creates
  // the Vendor record if needed.
  async registerPurchase(
    organizerId: string,
    dto: RegisterMembershipPurchaseDto,
  ) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const planObjId = this.toObjectId(dto.planId, "planId");
    const plan = await this.planModel
      .findOne({
        _id: planObjId,
        organizerId: orgObjId,
        archived: { $ne: true },
      })
      .lean();
    if (!plan) throw new NotFoundException("Membership plan not found");

    const email = dto.exhibitorEmail.toLowerCase().trim();

    // Block double-buy when there's already an active membership.
    const existingActive = await this.membershipModel
      .findOne({
        organizerId: orgObjId,
        exhibitorEmail: email,
        status: "active",
      })
      .lean();
    if (existingActive) {
      throw new ConflictException(
        "This exhibitor already has an active membership",
      );
    }

    // Find or create the Vendor row.
    //
    // Resolution order — we only create a brand-new Vendor when every
    // earlier match fails, so the same exhibitor never gets a duplicate
    // row when they buy a membership:
    //   1. Vendor already owned by this organizer with the same email
    //      → reuse (same data the organizer is used to seeing).
    //   2. Vendor already owned by this organizer with the same WhatsApp
    //      number → reuse and backfill the email if it was missing.
    //   3. ANY Vendor across the database with the same WhatsApp number
    //      → reuse the existing row — the membership is org-scoped via
    //      ExhibitorMembership.organizerId, so we don't need to clone
    //      the Vendor under this organizer just to link the purchase.
    //   4. Nothing found → lazy-create scoped to this organizer.
    const phone = dto.exhibitorWhatsapp;
    const phoneDigits = (phone || "").replace(/\D/g, "");
    const phoneCandidates: string[] = [];
    if (phone) phoneCandidates.push(phone);
    if (phoneDigits) {
      phoneCandidates.push(phoneDigits);
      if (!phone.startsWith("+")) phoneCandidates.push(`+${phoneDigits}`);
    }
    const phoneMatch =
      phoneCandidates.length > 0
        ? {
            $or: [
              { whatsAppNumber: { $in: phoneCandidates } },
              { whatsappNumber: { $in: phoneCandidates } },
              { phoneNumber: { $in: phoneCandidates } },
              { phone: { $in: phoneCandidates } },
            ],
          }
        : null;

    let vendor: any = await this.vendorModel.findOne({
      organizerId: orgObjId,
      email,
    });
    if (!vendor && phoneMatch) {
      vendor = await this.vendorModel.findOne({
        organizerId: orgObjId,
        ...phoneMatch,
      });
      if (vendor && !vendor.email && email) {
        vendor.email = email;
        await vendor.save?.();
      }
    }
    if (!vendor && phoneMatch) {
      // Global match — exhibitor exists in our system already, just
      // under a different organizer (or no organizer). Reuse rather
      // than spawning a duplicate row. The Vendor's organizerId is
      // left untouched; this membership is owned by `orgObjId` via
      // ExhibitorMembership.organizerId regardless.
      vendor = await this.vendorModel.findOne(phoneMatch);
    }
    if (!vendor) {
      vendor = await new this.vendorModel({
        organizerId: orgObjId,
        name: dto.exhibitorName.trim(),
        email,
        whatsAppNumber: dto.exhibitorWhatsapp,
        whatsappNumber: dto.exhibitorWhatsapp,
        businessName: dto.businessName,
        businessType: dto.businessCategory,
      }).save();
    }

    const created = await this.membershipModel.create({
      organizerId: orgObjId,
      planId: planObjId,
      exhibitorId: vendor._id,
      exhibitorEmail: email,
      exhibitorName: dto.exhibitorName.trim(),
      exhibitorWhatsapp: dto.exhibitorWhatsapp,
      status: "pending_verification",
      amountPaid: dto.amountPaid,
      currency: plan.currency,
      paymentMethod: dto.paymentMethod || "razorpay",
      paymentRef: dto.paymentRef,
      history: [
        {
          action: "purchase",
          at: new Date(),
          by: "exhibitor",
          planId: planObjId,
          amountPaid: dto.amountPaid,
        },
      ],
    });
    return created.toObject();
  }

  async confirmMembership(
    organizerId: string,
    membershipId: string,
    dto: ConfirmMembershipDto,
  ) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const mObjId = this.toObjectId(membershipId, "membershipId");
    const membership = await this.membershipModel.findOne({
      _id: mObjId,
      organizerId: orgObjId,
    });
    if (!membership) throw new NotFoundException("Membership not found");
    if (membership.status === "active") {
      throw new ConflictException("Membership is already active");
    }
    const plan = await this.planModel.findById(membership.planId).lean();
    if (!plan) throw new NotFoundException("Linked plan not found");
    const now = new Date();
    const end = new Date(
      now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
    );
    membership.status = "active";
    membership.startDate = now;
    membership.endDate = end;
    membership.history.push({
      action: "confirm",
      at: now,
      by: String(organizerId),
      planId: membership.planId,
      amountPaid: membership.amountPaid,
      note: dto.note,
    } as any);
    await membership.save();

    // Propagate the active-member flag to every Vendor row matching
    // this exhibitor (by email or WhatsApp). The eventfront then
    // surfaces member pricing as soon as the vendor logs in, without
    // having to re-query the memberships endpoint.
    await this.syncVendorMemberFlag(membership).catch((err) =>
      this.logger.warn(
        `[memberships] vendor flag sync failed for ${membership._id}: ${err?.message}`,
      ),
    );

    // Fire-and-forget welcome email — failure shouldn't block the
    // organizer's confirm action.
    // Fire-and-forget: generate the PDF receipt, email it as an
    // attachment, and ping the same PDF over WhatsApp. Failures in any
    // channel are logged but don't roll back the confirm — the
    // organizer can resend manually if needed.
    this.sendReceiptEverywhere(membership, plan as any).catch((err) =>
      this.logger.warn(
        `[memberships] receipt dispatch failed for ${membership._id}: ${err?.message}`,
      ),
    );

    return membership.toObject();
  }

  async rejectMembership(
    organizerId: string,
    membershipId: string,
    dto: RejectMembershipDto,
  ) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const mObjId = this.toObjectId(membershipId, "membershipId");
    const membership = await this.membershipModel.findOne({
      _id: mObjId,
      organizerId: orgObjId,
    });
    if (!membership) throw new NotFoundException("Membership not found");
    const wasActive = membership.status === "active";
    membership.status = "cancelled";
    membership.history.push({
      action: "reject",
      at: new Date(),
      by: String(organizerId),
      note: dto.reason,
    } as any);
    await membership.save();
    // If we just demoted an active membership, the vendor might no
    // longer be a member — recompute the flag.
    if (wasActive) {
      await this.syncVendorMemberFlag(membership).catch((err) =>
        this.logger.warn(
          `[memberships] vendor flag sync failed for ${membership._id}: ${err?.message}`,
        ),
      );
    }
    return membership.toObject();
  }

  // Used at booking time by the eventfront — "is this exhibitor a member of
  // this organizer right now?". Matches by email AND optionally by WhatsApp
  // because the vendor record's `email` field may not exactly equal the
  // exhibitorEmail captured at purchase time (vendors created via stall
  // flow vs membership flow can drift); the phone is the stable axis.
  // Returns the membership doc (with plan) or null.
  async getActiveMembership(
    organizerId: string,
    exhibitorEmail: string,
    exhibitorWhatsapp?: string,
  ) {
    const orgObjId = this.toObjectId(organizerId, "organizerId");
    const email = (exhibitorEmail || "").toLowerCase().trim();
    const orClauses: any[] = [];
    if (email) orClauses.push({ exhibitorEmail: email });
    if (exhibitorWhatsapp) {
      const digits = exhibitorWhatsapp.replace(/\D/g, "");
      const candidates: string[] = [];
      if (exhibitorWhatsapp) candidates.push(exhibitorWhatsapp);
      if (digits) {
        candidates.push(digits);
        if (!exhibitorWhatsapp.startsWith("+"))
          candidates.push(`+${digits}`);
      }
      if (candidates.length > 0)
        orClauses.push({ exhibitorWhatsapp: { $in: candidates } });
    }
    if (orClauses.length === 0) return null;
    return this.membershipModel
      .findOne({
        organizerId: orgObjId,
        status: "active",
        $or: orClauses,
      })
      // Hand the dialog enough plan fields to render the rich member
      // card (name, color, perks list, validity, prices).
      .populate("planId", "name color perks price currency durationDays description")
      .lean();
  }

  // Cron-friendly worker — sweeps active rows whose endDate has passed and
  // flips them to expired. Returns the count for logging.
  async expireDueMemberships(): Promise<number> {
    // Capture the rows we're about to expire so we can refresh the
    // Vendor.isMember flag for each one afterwards.
    const due = await this.membershipModel
      .find({ status: "active", endDate: { $lt: new Date() } })
      .lean();
    const res = await this.membershipModel.updateMany(
      { status: "active", endDate: { $lt: new Date() } },
      {
        $set: { status: "expired" },
        $push: {
          history: {
            action: "expire",
            at: new Date(),
            by: "system",
          },
        },
      },
    );
    for (const m of due) {
      await this.syncVendorMemberFlag(m as any).catch((err) =>
        this.logger.warn(
          `[memberships] vendor flag sync failed for ${(m as any)._id}: ${err?.message}`,
        ),
      );
    }
    return (res as any).modifiedCount || 0;
  }

  // One-shot maintenance — walks every active ExhibitorMembership and
  // syncs the Vendor.isMember flag for the matching vendors. Used at
  // boot to backfill vendors that already had active memberships
  // before this field existed. Returns the count of vendors touched.
  async backfillVendorMemberFlags(): Promise<number> {
    const actives = await this.membershipModel
      .find({ status: "active" })
      .lean();
    let touched = 0;
    for (const m of actives) {
      try {
        await this.syncVendorMemberFlag(m as any);
        touched++;
      } catch {
        // skip on individual failure; the cron runs again tomorrow
      }
    }
    return touched;
  }

  // Recompute the Vendor.isMember flag for every vendor matching this
  // membership's email or WhatsApp number. A vendor is a member if ANY
  // ExhibitorMembership for that email is currently active — so a
  // membership being confirmed flips the flag on, and one being
  // rejected/expired flips it off only when no other active enrollment
  // remains for that exhibitor.
  private async syncVendorMemberFlag(membership: any) {
    const email = (membership?.exhibitorEmail || "").toLowerCase();
    const whatsapp = String(membership?.exhibitorWhatsapp || "");
    if (!email && !whatsapp) return;

    const stillActive = email
      ? await this.membershipModel.exists({
          exhibitorEmail: email,
          status: "active",
        })
      : null;
    const isMember = !!stillActive;

    // Build a fuzzy phone candidate list to cover the four legacy
    // phone fields and their +/no-+ variants.
    const phoneDigits = whatsapp.replace(/\D/g, "");
    const phoneCandidates: string[] = [];
    if (whatsapp) phoneCandidates.push(whatsapp);
    if (phoneDigits) {
      phoneCandidates.push(phoneDigits);
      if (!whatsapp.startsWith("+")) phoneCandidates.push(`+${phoneDigits}`);
    }

    const orFilters: any[] = [];
    if (email) orFilters.push({ email });
    if (phoneCandidates.length > 0) {
      orFilters.push(
        { whatsAppNumber: { $in: phoneCandidates } },
        { whatsappNumber: { $in: phoneCandidates } },
        { phoneNumber: { $in: phoneCandidates } },
        { phone: { $in: phoneCandidates } },
      );
    }
    if (orFilters.length === 0) return;
    await this.vendorModel.updateMany({ $or: orFilters }, { $set: { isMember } });
  }

  // After a confirm: generate the PDF receipt once, then ship it on
  // both channels in parallel. Each channel is wrapped so one failure
  // (e.g. SMTP down, WhatsApp gateway not paired) doesn't block the
  // other. Caller is fire-and-forget — surfaces only as a logged warn
  // on the confirm path.
  private async sendReceiptEverywhere(membership: any, plan: any) {
    const org = await this.organizerModel
      .findById(membership.organizerId)
      .select("organizationName businessEmail name")
      .lean();
    const orgName = (org as any)?.organizationName || "Your organizer";

    // Build the PDF first so it's reusable across channels. Use the
    // membership id in the filename so the recipient can correlate.
    const fileName = `eventsh-membership-${String(membership._id).slice(-8)}.pdf`;
    const filePath = await this.writeMembershipReceiptPdf(
      org as any,
      plan,
      membership,
      fileName,
    );

    const perks = Array.isArray(plan.perks) ? plan.perks : [];
    const validTill = membership.endDate
      ? new Date(membership.endDate).toLocaleDateString()
      : "";

    // ── Email channel ───────────────────────────────────────────────
    if (membership?.exhibitorEmail) {
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;color:#111">
          <h2 style="margin:0 0 8px">Welcome to ${escapeHtml(plan.name)} membership at ${escapeHtml(orgName)}</h2>
          <p>Your membership is now active. The receipt is attached as a PDF.</p>
          <table style="border-collapse:collapse;margin:12px 0">
            <tr><td style="padding:4px 12px 4px 0;color:#666">Plan</td><td><b>${escapeHtml(plan.name)}</b></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666">Valid till</td><td>${escapeHtml(validTill)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666">Amount paid</td><td>${escapeHtml(String(membership.amountPaid))} ${escapeHtml(membership.currency)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666">Transaction</td><td>${escapeHtml(membership.paymentRef || "—")}</td></tr>
          </table>
          ${
            perks.length
              ? `<h3 style="margin:16px 0 6px">Member perks</h3><ul style="padding-left:20px">${perks
                  .map((p: string) => `<li>${escapeHtml(p)}</li>`)
                  .join("")}</ul>`
              : ""
          }
          <p style="color:#666;font-size:12px;margin-top:20px">If you have any questions, reply to this email and we'll help you out.</p>
        </div>
      `;
      try {
        const buffer = await fs.promises.readFile(filePath);
        await this.mailService.sendEmail({
          to: membership.exhibitorEmail,
          subject: `Welcome to ${plan.name} membership at ${orgName}`,
          html,
          attachments: [{ filename: fileName, content: buffer }],
        });
      } catch (err: any) {
        this.logger.warn(
          `[memberships] welcome email send failed: ${err?.message}`,
        );
      }
    }

    // ── WhatsApp channel ─────────────────────────────────────────────
    if (membership?.exhibitorWhatsapp) {
      try {
        const caption =
          `Welcome to *${plan.name}* membership at *${orgName}*.\n\n` +
          `Valid till: ${validTill}\n` +
          `Amount paid: ${membership.currency} ${membership.amountPaid}\n` +
          `Reference: ${membership.paymentRef || "—"}\n\n` +
          `Your receipt is attached.`;
        await this.otpService.sendMediaMessage(
          membership.exhibitorWhatsapp,
          filePath,
          caption,
          fileName,
        );
      } catch (err: any) {
        this.logger.warn(
          `[memberships] WhatsApp receipt send failed: ${err?.message}`,
        );
      }
    }
  }

  // PDF builder — mirrors the structure used by billing receipts so the
  // visual style is consistent. Writes to `uploads/receipts/<file>.pdf`
  // (same directory) and returns the absolute path.
  private writeMembershipReceiptPdf(
    organizer: any,
    plan: any,
    membership: any,
    fileName: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.join(process.cwd(), "uploads", "receipts");
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      const filePath = path.join(dir, fileName);
      const stream = fs.createWriteStream(filePath);
      const pdf = new PDFDocument({ size: "A4", margin: 40 });
      pdf.pipe(stream);

      const C = {
        ink: "#0f172a",
        body: "#1f2937",
        muted: "#64748b",
        line: "#e2e8f0",
        accentBg: plan?.color || "#6366f1",
        accentInk: "#ffffff",
      };
      const pageLeft = 40;
      const pageRight = 595 - 40;
      const usable = pageRight - pageLeft;
      const orgName = organizer?.organizationName || organizer?.name || "—";
      const issued = new Date().toLocaleString();
      const validTill = membership.endDate
        ? new Date(membership.endDate).toLocaleDateString()
        : "—";
      const startDate = membership.startDate
        ? new Date(membership.startDate).toLocaleDateString()
        : "—";
      const ref = `MEM-${String(membership._id).slice(-8).toUpperCase()}`;
      const amountStr = `${membership.currency} ${Number(membership.amountPaid || 0).toFixed(2)}`;

      // Header band
      pdf.rect(pageLeft, 40, usable, 70).fill(C.accentBg);
      pdf
        .fillColor(C.accentInk)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("EVENTSH", pageLeft + 18, 55);
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#e2e8f0")
        .text("Membership receipt", pageLeft + 18, 82);
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(C.accentInk)
        .text("MEMBERSHIP RECEIPT", pageLeft, 55, {
          width: usable - 18,
          align: "right",
        });
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#e2e8f0")
        .text(`Ref: ${ref}`, pageLeft, 75, {
          width: usable - 18,
          align: "right",
        })
        .text(`Issued: ${issued}`, pageLeft, 88, {
          width: usable - 18,
          align: "right",
        });

      let y = 130;

      // Bill-to + Plan boxes
      const colW = (usable - 12) / 2;
      const billToX = pageLeft;
      const payX = pageLeft + colW + 12;
      const boxH = 96;
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("MEMBER", billToX, y)
        .text("PLAN & PAYMENT", payX, y);
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
          membership.exhibitorName || "—",
          billToX + 10,
          y + 22,
          { width: colW - 20 },
        );
      pdf
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(C.body)
        .text(membership.exhibitorEmail || "", billToX + 10, y + 40, {
          width: colW - 20,
        })
        .text(membership.exhibitorWhatsapp || "", billToX + 10, y + 56, {
          width: colW - 20,
        })
        .text(`Issued by ${orgName}`, billToX + 10, y + 78, {
          width: colW - 20,
        });

      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(C.ink)
        .text(plan?.name || "—", payX + 10, y + 22, {
          width: colW - 20,
        });
      pdf
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(C.body)
        .text(`Start: ${startDate}`, payX + 10, y + 40, {
          width: colW - 20,
        })
        .text(`Valid till: ${validTill}`, payX + 10, y + 56, {
          width: colW - 20,
        })
        .text(`Transaction: ${membership.paymentRef || "—"}`, payX + 10, y + 72, {
          width: colW - 20,
        });

      y += boxH + 30;

      // Amount block
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("AMOUNT PAID", pageLeft, y);
      pdf
        .moveTo(pageLeft, y + 16)
        .lineTo(pageRight, y + 16)
        .lineWidth(0.6)
        .strokeColor(C.line)
        .stroke();
      pdf
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(C.ink)
        .text(amountStr, pageLeft, y + 26, {
          width: usable,
          align: "right",
        });

      y += 70;

      // Perks list
      const perks: string[] = Array.isArray(plan?.perks) ? plan.perks : [];
      if (perks.length > 0) {
        pdf
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(C.muted)
          .text("MEMBER PERKS", pageLeft, y);
        y += 16;
        for (const perk of perks) {
          pdf
            .font("Helvetica")
            .fontSize(10)
            .fillColor(C.body)
            .text(`•  ${perk}`, pageLeft, y, { width: usable });
          y += 14;
        }
        y += 8;
      }

      pdf
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(C.muted)
        .text(
          `This receipt confirms the membership purchase noted above. Keep it for your records.`,
          pageLeft,
          770,
          { width: usable, align: "center" },
        );

      pdf.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
