import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  SponsorRequest,
  SponsorRequestDocument,
  SponsorRequestStatus,
} from "./entities/sponsor-request.entity";
import { Sponsor, SponsorDocument } from "./schemas/sponsor.schema";
import { MailService } from "../roles/mail.service";

// pdfkit ships CommonJS only — same require style as memberships/billing.
const PDFDocument = require("pdfkit");
import { CreateSponsorRequestDto } from "./dto/create-sponsor-request.dto";
import { CreateSponsorDto } from "./dto/create-sponsor.dto";
import { UpdateSponsorDto } from "./dto/update-sponsor.dto";
import { UpdateSponsorStatusDto } from "./dto/update-sponsor-status.dto";
import {
  SubmitSponsorPaymentDto,
  VerifySponsorPaymentDto,
} from "./dto/submit-sponsor-payment.dto";

/**
 * Prefix a national number with its dial code, unless it already carries one.
 * Keeps the sponsor directory's phone format identical to the supplier CRM's.
 */
function joinPhone(countryCode?: string, phone?: string): string {
  const n = (phone || "").trim();
  const cc = (countryCode || "").trim();
  if (!n) return "";
  if (n.startsWith("+") || !cc) return n;
  return `${cc}${n}`;
}

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    @InjectModel(SponsorRequest.name)
    private requestModel: Model<SponsorRequestDocument>,
    @InjectModel(Sponsor.name)
    private sponsorModel: Model<SponsorDocument>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private readonly mailService: MailService,
  ) {}

  private assertId(id: string, label = "id") {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  // ============ PUBLIC: TIERS + APPLICATION ============

  /**
   * What the public sponsor page shows: the event's active tiers plus minimal
   * event info. Only tiers the organizer left enabled are returned.
   */
  async getTiersForEvent(eventId: string) {
    this.assertId(eventId, "eventId");
    const event = await this.eventModel
      .findById(eventId)
      .select("title startDate endDate location sponsorTypes organizer features")
      .lean();
    if (!event) throw new NotFoundException("Event not found");

    const tiers = ((event as any).sponsorTypes || []).filter(
      (t: any) => t?.isActive !== false,
    );
    // Currency follows the organizer's country, same convention as the rest
    // of the app (SG → SG$, everything else → ₹).
    const organizerId = (event as any).organizer;
    let currency = "IN";
    if (organizerId) {
      const org = await this.organizerModel.findById(organizerId).lean();
      currency = (org as any)?.country || "IN";
    }

    return {
      tiers,
      currency,
      event: {
        id: String((event as any)._id),
        title: (event as any).title,
        startDate: (event as any).startDate,
        endDate: (event as any).endDate,
        location: (event as any).location,
      },
    };
  }

  /** An applicant's existing application for this event, if any. */
  async getMyApplication(eventId: string, email: string) {
    this.assertId(eventId, "eventId");
    const clean = (email || "").trim().toLowerCase();
    if (!clean) return null;
    return this.requestModel
      .findOne({ eventId: new Types.ObjectId(eventId), email: clean })
      .lean();
  }

  /**
   * Submit a sponsorship application. The tier's name and price are resolved
   * from the event — never trusted from the client — so a tampered form can't
   * buy a Gold package at Bronze prices.
   */
  async apply(dto: CreateSponsorRequestDto, logoPath?: string) {
    this.assertId(dto.eventId, "eventId");
    const event = await this.eventModel
      .findById(dto.eventId)
      .select("sponsorTypes organizer")
      .lean();
    if (!event) throw new NotFoundException("Event not found");

    const tier = ((event as any).sponsorTypes || []).find(
      (t: any) => String(t?.id) === String(dto.sponsorTypeId),
    );
    if (!tier) {
      throw new BadRequestException("That sponsorship tier is not available.");
    }
    if (tier.isActive === false) {
      throw new BadRequestException(
        "That sponsorship tier is no longer open.",
      );
    }

    const organizerId = (event as any).organizer;
    if (!organizerId) {
      throw new BadRequestException("This event has no organizer attached.");
    }

    const email = (dto.email || "").trim().toLowerCase();
    const businessEmail = (dto.businessEmail || "").trim().toLowerCase();
    const orgObjId = new Types.ObjectId(String(organizerId));

    // Non-cash tier: keep only options the organizer actually offers on
    // this tier — never trust the client's list wholesale.
    const collectPayment = tier.collectPayment !== false;
    let selectedOptions: string[] = [];
    if (!collectPayment) {
      const offered = new Set((tier.customOptions || []) as string[]);
      try {
        const parsed = dto.selectedOptions
          ? JSON.parse(dto.selectedOptions)
          : [];
        if (Array.isArray(parsed)) {
          selectedOptions = parsed.filter(
            (o: any) => typeof o === "string" && offered.has(o),
          );
        }
      } catch {
        // Malformed JSON — treat as no selection rather than failing the
        // whole application.
      }
      if (selectedOptions.length === 0) {
        throw new BadRequestException(
          "Pick at least one of the tier's options.",
        );
      }
    }

    // Find-or-create the organizer's directory entry for this business, keyed
    // by email, so an applicant lands in the Sponsors CRM automatically and
    // their applications hang off a real foreign key.
    const sponsor = await this.upsertDirectoryEntry(orgObjId, {
      companyName: dto.companyName,
      contactName: dto.contactName,
      email,
      businessEmail,
      // The public form posts the dial code and the national number
      // separately; the directory (like the supplier CRM and the Excel
      // importer) stores one dial-code-inclusive string.
      phone: joinPhone(dto.countryCode, dto.phone),
      countryCode: dto.countryCode,
      website: dto.website,
      logo: logoPath,
    });

    try {
      const created = await this.requestModel.create({
        eventId: new Types.ObjectId(dto.eventId),
        organizerId: orgObjId,
        sponsorId: sponsor?._id,
        sponsorTypeId: String(tier.id),
        sponsorTypeName: tier.name,
        amount: Number(tier.price) || 0,
        collectPayment,
        selectedOptions,
        companyName: dto.companyName,
        contactName: dto.contactName,
        email,
        businessEmail,
        phone: dto.phone || "",
        countryCode: dto.countryCode || "",
        website: dto.website || "",
        logo: logoPath || "",
        message: dto.message || "",
        status: SponsorRequestStatus.Applied,
        statusHistory: [
          {
            status: SponsorRequestStatus.Applied,
            note: `Applied for ${tier.name}`,
            changedAt: new Date(),
            changedBy: dto.companyName,
          },
        ],
        submittedAt: new Date(),
      });

      // Best-effort — the organizer would otherwise only learn of a new
      // application by polling the dashboard.
      this.notifyOrganizer(orgObjId, dto.eventId, {
        heading: "New sponsorship application",
        summary: `${dto.companyName} applied for the ${tier.name} tier${
          collectPayment ? "" : " (non-cash)"
        }.`,
      }).catch((err) =>
        this.logger.warn(
          `New-application organizer email failed for ${created._id}: ${err?.message || err}`,
        ),
      );

      return created;
    } catch (err: any) {
      // Unique (eventId, email) → they already applied.
      if (err?.code === 11000) {
        throw new ConflictException(
          "You have already applied to sponsor this event.",
        );
      }
      this.logger.error(`apply failed: ${err?.message || err}`, err?.stack);
      throw err;
    }
  }

  /**
   * Upsert the organizer's directory entry for a business. Existing entries
   * are enriched (never blanked) — an organizer's hand-typed contact name
   * shouldn't be wiped by a sparser application.
   */
  private async upsertDirectoryEntry(
    organizerId: Types.ObjectId,
    fields: {
      companyName: string;
      contactName?: string;
      email?: string;
      businessEmail?: string;
      phone?: string;
      countryCode?: string;
      website?: string;
      logo?: string;
    },
  ) {
    const email = (fields.email || "").trim().toLowerCase();
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const company = (fields.companyName || "").trim();

    // Match on email first; fall back to an exact company-name match so a
    // hand-added entry without an email still gets picked up.
    const or: any[] = [];
    if (email) or.push({ email });
    if (company) or.push({ companyName: new RegExp(`^${esc(company)}$`, "i") });
    const existing = or.length
      ? await this.sponsorModel.findOne({ organizerId, $or: or })
      : null;

    if (existing) {
      // Only fill gaps.
      if (!existing.email && email) existing.email = email;
      if (!existing.businessEmail && fields.businessEmail)
        existing.businessEmail = fields.businessEmail;
      if (!existing.contactName && fields.contactName)
        existing.contactName = fields.contactName;
      if (!existing.phone && fields.phone) existing.phone = fields.phone;
      if (!existing.countryCode && fields.countryCode)
        existing.countryCode = fields.countryCode;
      if (!existing.website && fields.website) existing.website = fields.website;
      if (!existing.logo && fields.logo) existing.logo = fields.logo;
      await existing.save();
      return existing;
    }

    try {
      return await this.sponsorModel.create({
        organizerId,
        companyName: company,
        contactName: fields.contactName || "",
        email,
        businessEmail: (fields.businessEmail || "").trim().toLowerCase(),
        phone: fields.phone || "",
        countryCode: fields.countryCode || "",
        website: fields.website || "",
        logo: fields.logo || "",
        isActive: true,
      });
    } catch (err: any) {
      // A directory entry is a convenience, never a reason to fail the
      // application the sponsor just submitted.
      this.logger.warn(
        `Could not create sponsor directory entry: ${err?.message || err}`,
      );
      return null;
    }
  }

  /**
   * Sponsor submits their transfer details + proof. Only valid once the
   * organizer has approved them — there's nothing to pay for before that.
   */
  async submitPayment(
    eventId: string,
    email: string,
    dto: SubmitSponsorPaymentDto,
    screenshotPath?: string,
  ) {
    const found = await this.getMyApplication(eventId, email);
    if (!found) throw new NotFoundException("No application found for you.");
    const req = await this.requestModel.findById((found as any)._id);
    if (!req) throw new NotFoundException("No application found for you.");

    // Sponsors pay straight after submitting the form — the organizer's
    // verification is the gate, not a pre-approval. Re-submitting is allowed
    // so a wrong reference or screenshot can be corrected.
    const payable = [
      SponsorRequestStatus.Applied,
      SponsorRequestStatus.Approved,
      SponsorRequestStatus.PaymentSubmitted,
    ];
    if (!payable.includes(req.status)) {
      throw new BadRequestException(
        req.status === SponsorRequestStatus.Confirmed
          ? "This sponsorship is already confirmed."
          : "This application is no longer awaiting payment.",
      );
    }

    req.transactionId = dto.transactionId || req.transactionId || "";
    req.paymentMethod = dto.paymentMethod || req.paymentMethod || "";
    if (screenshotPath) req.transactionScreenshot = screenshotPath;
    req.paidAt = new Date();
    req.status = SponsorRequestStatus.PaymentSubmitted;
    req.statusHistory.push({
      status: SponsorRequestStatus.PaymentSubmitted,
      note:
        dto.notes ||
        `Payment submitted${dto.transactionId ? ` (ref: ${dto.transactionId})` : ""}.`,
      changedAt: new Date(),
      changedBy: req.companyName,
    } as any);
    await req.save();

    // Best-effort — otherwise the organizer only sees the submitted payment
    // by opening the dashboard themselves.
    this.notifyOrganizer(req.organizerId, req.eventId, {
      heading: "Sponsor payment submitted",
      summary: `${req.companyName} submitted payment for the ${req.sponsorTypeName} tier — verify it to confirm the sponsorship.`,
    }).catch((err) =>
      this.logger.warn(
        `Payment-submitted organizer email failed for ${req._id}: ${err?.message || err}`,
      ),
    );

    return req;
  }

  // ============ ORGANIZER ============

  /**
   * Applications for one event, with the organizer's currency so the per-event
   * tab prices them the same way the public page did.
   */
  async listByEvent(eventId: string) {
    this.assertId(eventId, "eventId");
    const requests = await this.requestModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .sort({ createdAt: -1 })
      .lean();
    let currency = "IN";
    try {
      const { currency: c } = await this.resolveEventCurrency(eventId);
      currency = c;
    } catch {
      // Event vanished — fall back to the default rather than failing the list.
    }
    return { requests, currency };
  }

  /** Currency for an event = its organizer's country. */
  private async resolveEventCurrency(eventId: string) {
    const event = await this.eventModel
      .findById(eventId)
      .select("organizer")
      .lean();
    if (!event) throw new NotFoundException("Event not found");
    const organizerId = (event as any).organizer;
    let currency = "IN";
    if (organizerId) {
      const org = await this.organizerModel.findById(organizerId).lean();
      currency = (org as any)?.country || "IN";
    }
    return { organizerId, currency };
  }

  // ============ ORGANIZER: SPONSOR CRM (identity directory) ============
  // Mirrors the suppliers module: an organizer keeps their own list of
  // sponsor businesses, reusable across events and independent of whether
  // anyone applied through the public form.

  /** Add a sponsor by hand. Dedupes on email/phone within the organizer. */
  async createForOrganizer(
    organizerId: string,
    dto: CreateSponsorDto,
    logoPath?: string,
  ) {
    this.assertId(organizerId, "organizerId");
    const orgObjId = new Types.ObjectId(organizerId);
    const email = (dto.email || "").trim().toLowerCase();
    const businessEmail = (dto.businessEmail || "").trim().toLowerCase();
    const phone = (dto.phone || "").trim();

    const dupOr: any[] = [];
    if (email) dupOr.push({ email });
    if (businessEmail) dupOr.push({ businessEmail });
    if (phone) dupOr.push({ phone });
    if (dupOr.length) {
      const existing = await this.sponsorModel.findOne({
        organizerId: orgObjId,
        $or: dupOr,
      });
      if (existing) {
        throw new ConflictException(
          "A sponsor with this email or phone already exists.",
        );
      }
    }

    try {
      const created = await this.sponsorModel.create({
        ...dto,
        email,
        businessEmail,
        logo: logoPath || "",
        organizerId: orgObjId,
        isActive: dto.isActive ?? true,
      });
      return { message: "Sponsor created", data: created };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException("Duplicate sponsor record.");
      }
      this.logger.error(
        `createForOrganizer failed: ${err?.message || err}`,
        err?.stack,
      );
      throw new BadRequestException(err?.message || "Could not create sponsor");
    }
  }

  async updateForOrganizer(
    organizerId: string,
    sponsorId: string,
    dto: UpdateSponsorDto,
    logoPath?: string,
  ) {
    this.assertId(organizerId, "organizerId");
    this.assertId(sponsorId, "sponsorId");

    const update: Record<string, any> = { ...dto };
    if (dto.email !== undefined) {
      update.email = (dto.email || "").trim().toLowerCase();
    }
    if (dto.businessEmail !== undefined) {
      update.businessEmail = (dto.businessEmail || "").trim().toLowerCase();
    }
    if ((dto as any).showOnBar !== undefined) {
      update.showOnBar =
        (dto as any).showOnBar === true || (dto as any).showOnBar === "true";
    }
    if (logoPath) update.logo = logoPath;

    const updated = await this.sponsorModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(sponsorId),
        organizerId: new Types.ObjectId(organizerId),
      },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!updated) throw new NotFoundException("Sponsor not found");
    return { message: "Sponsor updated", data: updated };
  }

  /** The organizer's own sponsor directory, newest first. */
  async listSponsorsForOrganizer(organizerId: string) {
    this.assertId(organizerId, "organizerId");
    const [list, org] = await Promise.all([
      this.sponsorModel
        .find({ organizerId: new Types.ObjectId(organizerId) })
        .sort({ createdAt: -1 })
        .lean(),
      this.organizerModel.findById(organizerId).lean(),
    ]);
    return { data: list, currency: (org as any)?.country || "IN" };
  }

  /**
   * Which events this directory sponsor has backed. CRM records and public
   * applications are separate rows, so they're matched on email (and company
   * name as a fallback) within the organizer — case-insensitive.
   */
  async sponsorEventHistory(organizerId: string, sponsorId: string) {
    this.assertId(organizerId, "organizerId");
    this.assertId(sponsorId, "sponsorId");
    const orgObjId = new Types.ObjectId(organizerId);

    const sponsor = await this.sponsorModel
      .findOne({ _id: new Types.ObjectId(sponsorId), organizerId: orgObjId })
      .lean();
    if (!sponsor) throw new NotFoundException("Sponsor not found");

    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const or: any[] = [];
    const email = ((sponsor as any).email || "").trim().toLowerCase();
    const company = ((sponsor as any).companyName || "").trim();
    // Applications submitted since the CRM link landed carry a real FK; the
    // email/company match keeps older rows (and hand-added entries) working.
    or.push({ sponsorId: new Types.ObjectId(sponsorId) });
    if (email) or.push({ email });
    if (company) or.push({ companyName: new RegExp(`^${esc(company)}$`, "i") });

    const requests = or.length
      ? await this.requestModel
          .find({ organizerId: orgObjId, $or: or })
          .populate("eventId", "title startDate endDate location")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const org = await this.organizerModel.findById(organizerId).lean();

    // Only confirmed sponsorships count as money in — anything still in
    // flight or rejected would overstate it.
    const confirmed = requests.filter(
      (r: any) => r.status === SponsorRequestStatus.Confirmed,
    );
    const totals = {
      events: new Set(
        requests
          .filter((r: any) => !["Rejected", "Cancelled"].includes(r.status))
          .map((r: any) => String((r.eventId as any)?._id ?? r.eventId)),
      ).size,
      applications: requests.length,
      confirmedValue: confirmed.reduce(
        (s: number, r: any) => s + (r.amount || 0),
        0,
      ),
    };

    return {
      sponsor,
      requests,
      totals,
      currency: (org as any)?.country || "IN",
    };
  }

  /**
   * Remove a sponsor from the organizer's directory. Refused while
   * applications point at them — the per-event Sponsors tab and the history
   * dialog both resolve through this record, so deleting it would strand
   * those rows.
   */
  async deleteForOrganizer(organizerId: string, sponsorId: string) {
    this.assertId(organizerId, "organizerId");
    this.assertId(sponsorId, "sponsorId");
    const sponsorObjId = new Types.ObjectId(sponsorId);

    const applications = await this.requestModel.countDocuments({
      sponsorId: sponsorObjId,
    });
    if (applications > 0) {
      throw new ConflictException(
        `This sponsor has ${applications} application${applications === 1 ? "" : "s"} on record and can't be removed. Delete those first if you really need to remove them.`,
      );
    }

    const res = await this.sponsorModel.deleteOne({
      _id: sponsorObjId,
      organizerId: new Types.ObjectId(organizerId),
    });
    if (res.deletedCount === 0) throw new NotFoundException("Sponsor not found");
    return { message: "Sponsor removed" };
  }

  /**
   * The organizer's sponsorship inbox. Returns the organizer's currency
   * alongside the rows: amounts were priced in it when the tier was created,
   * so the inbox must render them the same way the public page does.
   */
  async listByOrganizer(organizerId: string) {
    this.assertId(organizerId, "organizerId");
    const [requests, org] = await Promise.all([
      this.requestModel
        .find({ organizerId: new Types.ObjectId(organizerId) })
        .populate("eventId", "title startDate endDate location")
        .sort({ createdAt: -1 })
        .lean(),
      this.organizerModel.findById(organizerId).lean(),
    ]);
    return { requests, currency: (org as any)?.country || "IN" };
  }

  async getOne(id: string) {
    this.assertId(id);
    const req = await this.requestModel
      .findById(id)
      .populate("eventId", "title startDate endDate location")
      .lean();
    if (!req) throw new NotFoundException("Sponsor application not found");
    return req;
  }

  /** Organizer approves / rejects / cancels an application. */
  async updateStatus(id: string, dto: UpdateSponsorStatusDto) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Sponsor application not found");

    // Non-cash tier: there's nothing to pay, so "Approved" goes straight to
    // Confirmed instead of opening a payment step that will never be used.
    const skipToConfirmed =
      dto.status === "Approved" && req.collectPayment === false;

    req.status = skipToConfirmed
      ? SponsorRequestStatus.Confirmed
      : (dto.status as SponsorRequestStatus);
    if (dto.status === "Rejected") {
      req.rejectionReason = dto.rejectionReason || "";
    }
    req.statusHistory.push({
      status: req.status,
      note:
        dto.notes ||
        dto.rejectionReason ||
        (skipToConfirmed ? "No payment required — confirmed directly." : ""),
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);
    await req.save();

    // Best-effort — otherwise a sponsor only learns of the decision by
    // revisiting the public application link themselves.
    this.notifySponsorDecision(req, dto.notes || dto.rejectionReason).catch(
      (err) =>
        this.logger.warn(
          `Sponsor decision email failed for ${req._id}: ${err?.message || err}`,
        ),
    );

    return req;
  }

  /**
   * Organizer confirms the transfer landed. This is what makes a sponsorship
   * live — and what qualifies the logo for the eventfront marquee.
   */
  async verifyPayment(id: string, dto: VerifySponsorPaymentDto) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Sponsor application not found");

    if (req.status !== SponsorRequestStatus.PaymentSubmitted) {
      throw new BadRequestException(
        "There's no submitted payment to verify on this application.",
      );
    }

    req.paymentVerified = true;
    req.paymentVerifiedAt = new Date();
    req.status = SponsorRequestStatus.Confirmed;
    // Stable, human-readable invoice number derived from the request id.
    if (!req.invoiceNumber) {
      req.invoiceNumber = `SPN-${String(req._id).slice(-8).toUpperCase()}`;
    }
    req.statusHistory.push({
      status: SponsorRequestStatus.Confirmed,
      note: dto.notes || "Payment verified — sponsorship confirmed.",
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);
    await req.save();

    // Email the invoice. Never let a mail failure undo a verified payment.
    this.sendInvoice(req).catch((err) =>
      this.logger.warn(
        `Sponsor invoice email failed for ${req._id}: ${err?.message || err}`,
      ),
    );

    return req;
  }

  /**
   * Alert the organizer (primary + business email, deduped) of something that
   * needs their attention — a new application or a submitted payment. The
   * organizer would otherwise only find out by opening the dashboard
   * themselves. Best-effort: callers catch and log, never let a mail failure
   * break the request that triggered it.
   */
  private async notifyOrganizer(
    organizerId: Types.ObjectId,
    eventId: Types.ObjectId | string,
    decision: { heading: string; summary: string },
  ) {
    const [event, organizer] = await Promise.all([
      this.eventModel.findById(eventId).select("title").lean(),
      this.organizerModel.findById(organizerId).lean(),
    ]);
    if (!organizer) return;

    const recipients = Array.from(
      new Set(
        [(organizer as any)?.email, (organizer as any)?.businessEmail]
          .filter(Boolean)
          .map((e: string) => e.trim().toLowerCase()),
      ),
    );
    if (recipients.length === 0) return;

    const fe = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
    const dashboardUrl = `${fe}/organizer/login?redirect=${encodeURIComponent(
      "/organizer-dashboard",
    )}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:24px;text-align:center">
          <h1 style="margin:0;font-size:20px">${decision.heading}</h1>
          <p style="margin:6px 0 0;opacity:.9">${(event as any)?.title || "Your event"}</p>
        </div>
        <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
          <p>${decision.summary}</p>
          <div style="text-align:center;margin:22px 0 6px">
            <a href="${dashboardUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Open Sponsors dashboard</a>
          </div>
        </div>
      </div>`;

    await Promise.all(
      recipients.map((to) =>
        this.mailService
          .sendEmail({
            to,
            subject: `${decision.heading} — ${(event as any)?.title || "Event"}`,
            html,
            senderConfig: (organizer as any)?.emailConfig,
          })
          .catch((err) =>
            this.logger.warn(
              `Organizer notify failed for ${to}: ${err?.message || err}`,
            ),
          ),
      ),
    );
  }

  /**
   * Email the sponsor when the organizer approves, rejects, or cancels their
   * application/sponsorship. Approvals that settle straight to Confirmed
   * (non-cash tiers) get the "confirmed" message instead of "approved", since
   * there's no payment step for them to act on next.
   */
  private async notifySponsorDecision(
    req: SponsorRequestDocument,
    note?: string,
  ) {
    const to = [req.email, req.businessEmail].filter(Boolean) as string[];
    if (to.length === 0) return;

    const organizer = await this.organizerModel
      .findById(req.organizerId)
      .lean();
    const event = await this.eventModel
      .findById(req.eventId)
      .select("title")
      .lean();

    const DECISIONS: Record<string, { heading: string; summary: string }> = {
      Approved: {
        heading: "Your sponsorship application was approved",
        summary: `You're approved as a ${req.sponsorTypeName} sponsor — please complete payment to confirm.`,
      },
      Confirmed: {
        heading: "Your sponsorship is confirmed",
        summary: `You're confirmed as a ${req.sponsorTypeName} sponsor — no payment required for this tier.`,
      },
      Rejected: {
        heading: "Your sponsorship application was declined",
        summary: `Your application for the ${req.sponsorTypeName} tier was not accepted this time.`,
      },
      Cancelled: {
        heading: "Your sponsorship was cancelled",
        summary: `Your ${req.sponsorTypeName} sponsorship has been cancelled by the organizer.`,
      },
    };
    const decision = DECISIONS[req.status] || DECISIONS.Cancelled;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:24px;text-align:center">
          <h1 style="margin:0;font-size:20px">${decision.heading}</h1>
          <p style="margin:6px 0 0;opacity:.9">${(event as any)?.title || "the event"}</p>
        </div>
        <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
          <p>${decision.summary}</p>
          ${
            note
              ? `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-left:4px solid #6366f1;border-radius:4px"><b>Note from the organizer:</b><br/>${note
                  .replace(/</g, "&lt;")
                  .replace(/\n/g, "<br/>")}</div>`
              : ""
          }
        </div>
      </div>`;

    await Promise.all(
      to.map((email) =>
        this.mailService
          .sendEmail({
            to: email,
            subject: `${decision.heading} — ${(event as any)?.title || "Event"}`,
            html,
            senderConfig: (organizer as any)?.emailConfig,
          })
          .catch((err) =>
            this.logger.warn(
              `Sponsor decision email failed for ${email}: ${err?.message || err}`,
            ),
          ),
      ),
    );
  }

  /**
   * Send the sponsor their invoice, from the organizer's own address when
   * they've configured custom SMTP and from EventSH otherwise.
   */
  private async sendInvoice(req: SponsorRequestDocument) {
    const [event, organizer] = await Promise.all([
      this.eventModel
        .findById(req.eventId)
        .select("title startDate")
        .lean(),
      this.organizerModel.findById(req.organizerId).lean(),
    ]);

    const country = (organizer as any)?.country;
    const pdf = await this.buildInvoicePdf(req, event, organizer, country);

    await this.mailService.sendSponsorshipInvoice(
      {
        // Sign-in Gmail plus the company/accounts address.
        to: [req.email, req.businessEmail].filter(Boolean) as string[],
        pdf,
        companyName: req.companyName,
        contactName: req.contactName,
        eventTitle: (event as any)?.title || "the event",
        eventDate: (event as any)?.startDate,
        tierName: req.sponsorTypeName,
        amount: req.amount,
        currencySymbol: country === "SG" ? "SG$" : "₹",
        invoiceNumber: req.invoiceNumber,
        transactionId: req.transactionId,
        paidOn: req.paidAt,
        organizationName:
          (organizer as any)?.organizationName || (organizer as any)?.name,
        organizerEmail: (organizer as any)?.email,
      },
      (organizer as any)?.emailConfig,
    );

    req.invoiceSentAt = new Date();
    await req.save();
  }

  /**
   * Render the sponsorship invoice as a PDF, in memory, so it can ride along
   * as an email attachment. Styled like the membership receipt.
   *
   * Amounts use the ISO code ("SGD 1,000") rather than a symbol — pdfkit's
   * built-in Helvetica has no ₹ glyph and would render a blank box.
   */
  private buildInvoicePdf(
    req: SponsorRequestDocument,
    event: any,
    organizer: any,
    country?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pdf = new PDFDocument({ size: "A4", margin: 40 });
        const chunks: Buffer[] = [];
        pdf.on("data", (c: Buffer) => chunks.push(c));
        pdf.on("end", () => resolve(Buffer.concat(chunks)));
        pdf.on("error", reject);

        const C = {
          ink: "#0f172a",
          body: "#1f2937",
          muted: "#64748b",
          line: "#e2e8f0",
          accentBg: "#6366f1",
        };
        const left = 40;
        const right = 595 - 40;
        const usable = right - left;
        const iso = country === "SG" ? "SGD" : "INR";
        const amountStr = `${iso} ${Number(req.amount || 0).toLocaleString()}`;
        const orgName =
          organizer?.organizationName || organizer?.name || "Organizer";

        // Header band — the receipt is issued BY the organizer, so it carries
        // their name, not EventSH's.
        pdf.rect(left, 40, usable, 70).fill(C.accentBg);
        // Long organisation names would run into the right-aligned title, so
        // step the size down until it fits the left half of the band.
        const nameMaxWidth = usable / 2 - 18;
        let nameSize = 22;
        pdf.font("Helvetica-Bold");
        while (
          nameSize > 12 &&
          pdf.fontSize(nameSize).widthOfString(orgName) > nameMaxWidth
        ) {
          nameSize -= 1;
        }
        pdf
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(nameSize)
          .text(orgName, left + 18, 55, {
            width: nameMaxWidth,
            lineBreak: false,
            ellipsis: true,
          });
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#e2e8f0")
          .text("Sponsorship receipt", left + 18, 82);
        pdf
          .font("Helvetica-Bold")
          .fontSize(13)
          .fillColor("#ffffff")
          .text("SPONSORSHIP RECEIPT", left, 55, {
            width: usable - 18,
            align: "right",
          });
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#e2e8f0")
          .text(`Invoice: ${req.invoiceNumber}`, left, 75, {
            width: usable - 18,
            align: "right",
          })
          .text(`Issued: ${new Date().toLocaleDateString()}`, left, 88, {
            width: usable - 18,
            align: "right",
          });

        let y = 140;
        const line = (label: string, value: string) => {
          pdf
            .font("Helvetica")
            .fontSize(10)
            .fillColor(C.muted)
            .text(label, left, y, { width: 150 });
          pdf
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(C.body)
            .text(value || "-", left + 160, y, { width: usable - 160 });
          y += 20;
        };

        pdf
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(C.ink)
          .text("Billed to", left, y);
        y += 20;
        line("Company", req.companyName);
        line("Contact", req.contactName);
        line("Email", req.email);
        if (req.businessEmail) line("Company email", req.businessEmail);
        if (req.phone) line("Phone", `${req.countryCode || ""}${req.phone}`);

        y += 10;
        pdf
          .moveTo(left, y)
          .lineTo(right, y)
          .strokeColor(C.line)
          .stroke();
        y += 16;

        pdf
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(C.ink)
          .text("Sponsorship", left, y);
        y += 20;
        line("Event", event?.title || "-");
        if (event?.startDate) {
          line("Event date", new Date(event.startDate).toLocaleDateString());
        }
        line("Package", req.sponsorTypeName);
        if (req.transactionId) line("Transaction ref", req.transactionId);
        if (req.paidAt) line("Paid on", new Date(req.paidAt).toLocaleDateString());
        line("Organizer", orgName);

        y += 10;
        pdf.rect(left, y, usable, 44).fill("#f1f5f9");
        pdf
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(C.ink)
          .text("Total paid", left + 16, y + 15);
        pdf
          .font("Helvetica-Bold")
          .fontSize(16)
          .fillColor(C.ink)
          .text(amountStr, left, y + 12, {
            width: usable - 16,
            align: "right",
          });
        y += 64;

        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.muted)
          .text(
            "Payment received and verified by the organizer. This document serves as your receipt.",
            left,
            y,
            { width: usable },
          );

        pdf.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Logos of confirmed sponsors for an event — what the eventfront marquee
   * should show alongside the organizer's manually-uploaded `sponsors` list.
   */
  async confirmedLogos(eventId: string) {
    this.assertId(eventId, "eventId");
    const rows = await this.requestModel
      .find({
        eventId: new Types.ObjectId(eventId),
        status: SponsorRequestStatus.Confirmed,
        logo: { $nin: ["", null] },
      })
      .select("logo companyName sponsorTypeName website sponsorId")
      .sort({ amount: -1 })
      .lean();

    // Drop any whose directory entry the organizer has deselected. Rows with
    // no linked sponsor (pre-CRM-link applications) are shown as before.
    const sponsorIds = rows
      .map((r: any) => r.sponsorId)
      .filter(Boolean) as Types.ObjectId[];
    if (sponsorIds.length === 0) return rows;

    const hidden = new Set(
      (
        await this.sponsorModel
          .find({ _id: { $in: sponsorIds }, showOnBar: false })
          .select("_id")
          .lean()
      ).map((s: any) => String(s._id)),
    );
    return rows.filter((r: any) => !hidden.has(String(r.sponsorId)));
  }
}
