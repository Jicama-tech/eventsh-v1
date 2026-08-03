import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Supplier, SupplierDocument } from "./schemas/supplier.schema";
import {
  SupplierEventConfig,
  SupplierEventConfigDocument,
} from "./schemas/supplier-event-config.schema";
import {
  SupplierRequest,
  SupplierRequestDocument,
  SupplierRequestStatus,
} from "./entities/supplier-request.entity";
import { CreateSupplierRequestDto } from "./dto/create-supplier-request.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { UpsertSupplierConfigDto } from "./dto/upsert-supplier-config.dto";
import { UpdateSupplierStatusDto } from "./dto/update-supplier-status.dto";
import { SupplierRespondDto } from "./dto/supplier-respond.dto";
import { RecordSupplierPaymentDto } from "./dto/record-supplier-payment.dto";
import { AddSupplierNoteDto } from "./dto/add-supplier-note.dto";
import { MailService } from "../roles/mail.service";

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectModel(Supplier.name)
    private supplierModel: Model<SupplierDocument>,
    @InjectModel(SupplierRequest.name)
    private requestModel: Model<SupplierRequestDocument>,
    @InjectModel(SupplierEventConfig.name)
    private configModel: Model<SupplierEventConfigDocument>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("OrganizerStore") private organizerStoreModel: Model<any>,
    // Confirmed stall bookings drive the auto-filled requirement list.
    @InjectModel("Stall") private stallModel: Model<any>,
    // Operator team members who opted in to notification emails.
    @InjectModel("Operator") private operatorModel: Model<any>,
    private readonly mailService: MailService,
  ) {}

  // Enrich a config doc with `linkPath`: the shareable supplier URL built the
  // same way as the event link (`/{slug}/events/{eventId}/supplier/{token}`),
  // falling back to a token-only path when the organizer has no store slug.
  private async withLinkPath(config: SupplierEventConfigDocument) {
    const obj: any = config.toObject ? config.toObject() : config;
    // Query the raw collection so Mongoose doesn't cast organizerId to the
    // store schema's declared type — store docs hold it as an ObjectId while
    // configs hold it as a string, so we match on both forms.
    const idStr = String(config.organizerId);
    const store: any = await this.organizerStoreModel.collection.findOne({
      $or: [
        { organizerId: idStr },
        ...(Types.ObjectId.isValid(idStr)
          ? [{ organizerId: new Types.ObjectId(idStr) }]
          : []),
      ],
    });
    const slug = store?.slug;
    // Mirrors the public event link + "/supplier" — one clean, shareable URL
    // (no token), broadcast to as many suppliers as the organizer wants.
    const linkPath = slug
      ? `/${slug}/events/${config.eventId}/supplier`
      : `/events/${config.eventId}/supplier`;
    return { ...obj, linkPath };
  }

  // ============ NOTIFICATIONS ============

  /** Organizer's custom SMTP config, when they've set one up. */
  private async senderConfigFor(organizerId: any) {
    try {
      const org = await this.organizerModel
        .findById(organizerId?._id || organizerId)
        .select("emailConfig")
        .lean();
      return (org as any)?.emailConfig;
    } catch {
      return undefined;
    }
  }

  /**
   * The organizer's own addresses plus any operator who has opted in to
   * notification emails. Mirrors the stalls module's reviewer list.
   */
  private async organizerSideRecipients(organizerId: any) {
    const orgId = organizerId?._id || organizerId;
    const [organizer, operators] = await Promise.all([
      this.organizerModel
        .findById(orgId)
        .select("email businessEmail organizationName name")
        .lean(),
      this.operatorModel
        .find({ organizerId: String(orgId) })
        .select("email companyEmail allowEmails")
        .lean(),
    ]);
    const to: string[] = [];
    const add = (e?: string) => {
      const v = String(e || "").trim().toLowerCase();
      if (v) to.push(v);
    };
    add((organizer as any)?.email);
    add((organizer as any)?.businessEmail);
    for (const op of (operators as any[]) || []) {
      // Opt-in: only operators with "Allow Emails" switched on.
      if (!op.allowEmails) continue;
      add(op.email);
      add(op.companyEmail);
    }
    return { to, organizer };
  }

  /**
   * Send a lifecycle update. `audience` decides who hears about it: the
   * supplier, the organizer + operator team, or both.
   *
   * Never throws — a bounced notification must not roll back the state
   * change that triggered it.
   */
  private async notify(
    req: SupplierRequestDocument,
    audience: "supplier" | "organizer" | "both",
    payload: {
      heading: string;
      summary: string;
      rows?: Array<[string, string]>;
      note?: string;
    },
  ) {
    try {
      const [event, { to: orgTo, organizer }, senderConfig] = await Promise.all(
        [
          this.eventModel.findById(req.eventId).select("title").lean(),
          this.organizerSideRecipients(req.organizerId),
          this.senderConfigFor(req.organizerId),
        ],
      );

      // The request may arrive unpopulated depending on the caller.
      const supplierDoc: any =
        req.supplierId && (req.supplierId as any).name
          ? req.supplierId
          : await this.supplierModel.findById(req.supplierId).lean();

      const to: string[] = [];
      if (audience === "supplier" || audience === "both") {
        if (supplierDoc?.email) to.push(supplierDoc.email);
        if (supplierDoc?.businessEmail) to.push(supplierDoc.businessEmail);
      }
      if (audience === "organizer" || audience === "both") to.push(...orgTo);
      if (to.length === 0) return;

      const country = (organizer as any)?.country;
      const sym = country === "SG" ? "SG$" : "₹";
      const money = (n: number) =>
        `${sym}${Number(n || 0).toLocaleString()}`;

      const fe = process.env.FRONTEND_BASE_URL || "https://eventsh.com";

      await this.mailService.sendSupplierUpdate(
        {
          to,
          heading: payload.heading,
          summary: payload.summary,
          supplierName:
            supplierDoc?.companyName || supplierDoc?.name || "Supplier",
          eventTitle: (event as any)?.title || "your event",
          status: req.status,
          rows: [
            ["Amount payable", money(this.payable(req))],
            ...(payload.rows || []),
          ],
          note: payload.note,
          organizationName:
            (organizer as any)?.organizationName || (organizer as any)?.name,
          ctaLabel: "Open dashboard",
          ctaUrl: `${fe}/organizer/login?redirect=${encodeURIComponent("/organizer-dashboard")}`,
        },
        senderConfig,
      );
    } catch (err: any) {
      this.logger.warn(
        `Supplier notification failed for ${req._id}: ${err?.message || err}`,
      );
    }
  }

  /**
   * What the organizer actually owes: the negotiated figure once one has been
   * agreed, otherwise the original quote. Every payment, balance and report
   * reads through this so a settled negotiation is never ignored.
   */
  private payable(req: any): number {
    const agreed = Number(req?.agreedTotal);
    return Number.isFinite(agreed) && agreed > 0
      ? agreed
      : Number(req?.quotationTotal) || 0;
  }

  private assertId(id: string, label = "id") {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  // Resolve an event to its owning organizer + currency (organizer country).
  private async resolveEvent(eventId: string) {
    this.assertId(eventId, "eventId");
    const event = await this.eventModel.findById(eventId).lean();
    if (!event) throw new NotFoundException("Event not found");
    const organizerId = (event as any).organizer || (event as any).organizerId;
    let currency = "IN";
    if (organizerId) {
      const org = await this.organizerModel.findById(organizerId).lean();
      currency = (org as any)?.country || "IN";
    }
    return { event, organizerId, currency };
  }

  // ============ ORGANIZER: SUPPLIER CRM (identity list) ============
  // Mirrors the shopkeepers module (exhibitor CRM over Vendor): an organizer
  // maintains their own list of suppliers, reused across events. Distinct from
  // the per-event quotation endpoints further below.

  // Create a supplier under the organizer. Dedupes by email/phone so re-adding
  // the same supplier doesn't create a second identity.
  async createForOrganizer(organizerId: string, dto: CreateSupplierDto) {
    this.assertId(organizerId, "organizerId");
    const orgObjId = new Types.ObjectId(organizerId);
    const email = (dto.email || "").trim().toLowerCase();
    const businessEmail = (dto.businessEmail || "").trim().toLowerCase();
    const phone = (dto.phone || "").trim();

    // Reject an obvious duplicate for this organizer (same email or phone).
    const dupOr: any[] = [];
    if (email) dupOr.push({ email });
    if (businessEmail) dupOr.push({ businessEmail });
    if (phone) dupOr.push({ phone });
    if (dupOr.length) {
      const existing = await this.supplierModel.findOne({
        organizerId: orgObjId,
        $or: dupOr,
      });
      if (existing) {
        throw new ConflictException(
          "A supplier with this email or phone already exists.",
        );
      }
    }

    try {
      const created = await this.supplierModel.create({
        ...dto,
        email,
        businessEmail,
        organizerId: orgObjId,
        isActive: dto.isActive ?? true,
      });
      return { message: "Supplier created", data: created };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException("Duplicate supplier record.");
      }
      this.logger.error(
        `createForOrganizer failed: ${err?.message || err}`,
        err?.stack,
      );
      throw new BadRequestException(err?.message || "Could not create supplier");
    }
  }

  // Update a supplier. Also claims legacy suppliers with no organizerId yet
  // (self-registered through the public link), same as the exhibitor CRM.
  async updateForOrganizer(
    organizerId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    this.assertId(organizerId, "organizerId");
    this.assertId(supplierId, "supplierId");
    const orgObjId = new Types.ObjectId(organizerId);

    const update: Record<string, any> = { ...dto };
    if (dto.email !== undefined)
      update.email = (dto.email || "").trim().toLowerCase();
    if (dto.businessEmail !== undefined)
      update.businessEmail = (dto.businessEmail || "").trim().toLowerCase();

    const updated = await this.supplierModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(supplierId),
        $or: [
          { organizerId: orgObjId },
          { organizerId: { $exists: false } },
          { organizerId: null },
        ],
      },
      { $set: update, $setOnInsert: { organizerId: orgObjId } },
      { new: true, runValidators: true },
    );

    if (!updated) throw new NotFoundException("Supplier not found");
    return { message: "Supplier updated", data: updated };
  }

  /**
   * Remove a supplier from the organizer's directory.
   *
   * Refused while quotations reference them: `SupplierRequest.supplierId` is a
   * required ref, so deleting the identity would leave those rows unable to
   * populate — the quotations table and detail dialog would show a nameless
   * supplier. The organizer must clear the quotations first.
   */
  async deleteForOrganizer(organizerId: string, supplierId: string) {
    this.assertId(organizerId, "organizerId");
    this.assertId(supplierId, "supplierId");
    const supObjId = new Types.ObjectId(supplierId);

    const quotations = await this.requestModel.countDocuments({
      supplierId: supObjId,
    });
    if (quotations > 0) {
      throw new ConflictException(
        `This supplier has ${quotations} quotation${quotations === 1 ? "" : "s"} on record and can't be removed. Delete those first if you really need to remove them.`,
      );
    }

    const res = await this.supplierModel.deleteOne({
      _id: supObjId,
      organizerId: new Types.ObjectId(organizerId),
    });
    if (res.deletedCount === 0) throw new NotFoundException("Supplier not found");
    return { message: "Supplier removed" };
  }

  // The organizer's supplier list (identities), newest first.
  async listForOrganizer(organizerId: string) {
    this.assertId(organizerId, "organizerId");
    const list = await this.supplierModel
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .sort({ createdAt: -1 })
      .lean();
    return { message: "Suppliers fetched", data: list };
  }

  /**
   * Every event this supplier has quoted for, with the quote, its status and
   * what was paid — the "which events was this supplier hired for?" view
   * behind the eye icon in the supplier directory.
   */
  async supplierEventHistory(organizerId: string, supplierId: string) {
    this.assertId(organizerId, "organizerId");
    this.assertId(supplierId, "supplierId");

    const supplier = await this.supplierModel
      .findOne({
        _id: new Types.ObjectId(supplierId),
        organizerId: new Types.ObjectId(organizerId),
      })
      .lean();
    if (!supplier) throw new NotFoundException("Supplier not found");

    const requests = await this.requestModel
      .find({ supplierId: new Types.ObjectId(supplierId) })
      .populate("eventId", "title startDate endDate location")
      .sort({ createdAt: -1 })
      .lean();

    const org = await this.organizerModel.findById(organizerId).lean();

    // Headline numbers for the dialog: what they've quoted vs what's been paid
    // out, counting only quotations that weren't rejected/cancelled.
    const live = requests.filter(
      (r: any) => !["Rejected", "Cancelled"].includes(r.status),
    );
    const totals = {
      events: new Set(
        live.map((r: any) => String((r.eventId as any)?._id ?? r.eventId)),
      ).size,
      quoted: live.reduce((s: number, r: any) => s + this.payable(r), 0),
      paid: live.reduce(
        (s: number, r: any) => s + (r.payment?.amountPaid || 0),
        0,
      ),
    };

    return {
      supplier,
      requests,
      totals,
      currency: (org as any)?.country || "IN",
    };
  }

  // ============ ORGANIZER: PER-EVENT CONFIG + LINK ============

  // Find the event's supplier config, creating a disabled default if missing.
  async getOrCreateConfig(
    eventId: string,
  ): Promise<SupplierEventConfigDocument> {
    this.assertId(eventId, "eventId");
    const existing = await this.configModel.findOne({ eventId });
    if (existing) return existing;
    const { organizerId, currency } = await this.resolveEvent(eventId);
    // Race-safe upsert (eventId is unique).
    return this.configModel.findOneAndUpdate(
      { eventId: new Types.ObjectId(eventId) },
      {
        $setOnInsert: {
          eventId: new Types.ObjectId(eventId),
          organizerId,
          currency,
          enabled: false,
          requirements: [],
          instructions: "",
        },
      },
      { new: true, upsert: true },
    );
  }

  async upsertConfig(eventId: string, dto: UpsertSupplierConfigDto) {
    const config = await this.getOrCreateConfig(eventId);
    if (dto.enabled !== undefined) config.enabled = dto.enabled;
    if (dto.currency !== undefined) config.currency = dto.currency;
    if (dto.instructions !== undefined) config.instructions = dto.instructions;
    if (dto.requirements !== undefined)
      config.requirements = dto.requirements as any;
    await config.save();
    return this.withLinkPath(config);
  }

  // Enriched config for organizer responses (includes the shareable linkPath).
  async getConfig(eventId: string) {
    return this.withLinkPath(await this.getOrCreateConfig(eventId));
  }

  // Open or pause the supplier form (whether the link accepts submissions).
  async setEnabled(eventId: string, enabled: boolean) {
    const config = await this.getOrCreateConfig(eventId);
    config.enabled = enabled;
    await config.save();
    return this.withLinkPath(config);
  }

  /**
   * Derive supplier requirements from the add-ons sold for an event.
   *
   * Add-ons are the physical items a supplier actually has to deliver —
   * chairs, tables, power, signage — so they're what the requirement list is
   * built from. The spaces themselves are the organizer's own venue stock and
   * are deliberately ignored.
   *
   * Only bookings that are actually going ahead are counted — a cancelled or
   * forfeited stall shouldn't put furniture on a supplier's order.
   */
  async requirementSuggestions(eventId: string) {
    this.assertId(eventId, "eventId");

    // Statuses that represent a live booking. Pending/Unpaid are excluded:
    // nothing is owed to a supplier until the stall is actually taken.
    const LIVE = ["Approved", "Confirmed", "Processing", "Completed", "Paid"];

    const stalls = await this.stallModel
      .find({ eventId: new Types.ObjectId(eventId), status: { $in: LIVE } })
      .select("selectedAddOns")
      .lean();

    const addOns = new Map<string, number>();
    for (const s of stalls as any[]) {
      for (const a of s.selectedAddOns || []) {
        const label = String(a?.name || "").trim();
        if (!label) continue;
        // Sum the quantity, not the row count — three chairs on one booking
        // is three chairs.
        addOns.set(label, (addOns.get(label) || 0) + (Number(a?.quantity) || 1));
      }
    }

    const requirements = [...addOns.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        // Deterministic id so re-running the suggestion updates the row the
        // organizer already has rather than duplicating it.
        id: `auto-addon-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label,
        quantity: String(count),
        description: "Add-ons purchased by exhibitors",
      }));

    return {
      requirements,
      stallsCounted: stalls.length,
      addOnTypes: addOns.size,
    };
  }

  /**
   * Requirement quantities are free text ("200 pax", "150", "6 x 3 tables"),
   * so pull the leading number out for arithmetic. No number → untracked.
   */
  private qtyOf(raw: unknown): number {
    const m = String(raw ?? "").match(/[\d.]+/);
    return m ? Number(m[0]) || 0 : 0;
  }

  /**
   * How much of each requirement is actually covered, and by whom.
   *
   * One requirement is routinely split across several suppliers — 200 chairs
   * might be 120 from one and 80 from another — so this sums the quantities
   * from quotations the organizer has committed to and reports what's left to
   * source. Quotes still under negotiation don't count towards fulfilment.
   */
  async requirementFulfilment(eventId: string) {
    this.assertId(eventId, "eventId");

    const [config, requests] = await Promise.all([
      this.configModel.findOne({ eventId: new Types.ObjectId(eventId) }).lean(),
      this.requestModel
        .find({ eventId: new Types.ObjectId(eventId) })
        .populate("supplierId", "name companyName")
        .lean(),
    ]);

    // Only quotations the organizer accepted actually reserve supply.
    const COMMITTED = [
      SupplierRequestStatus.Approved,
      SupplierRequestStatus.PartiallyPaid,
      SupplierRequestStatus.Paid,
      SupplierRequestStatus.Completed,
    ];

    const requirements = ((config as any)?.requirements || []).map((r: any) => {
      const required = this.qtyOf(r.quantity);
      const suppliers: Array<{
        requestId: string;
        supplierName: string;
        quantity: number;
        price: number;
        status: string;
      }> = [];

      for (const req of requests as any[]) {
        if (!COMMITTED.includes(req.status)) continue;
        for (const item of req.quotationItems || []) {
          // Prefer the id; fall back to the label for rows written before
          // requirementId existed.
          const matches = item.requirementId
            ? String(item.requirementId) === String(r.id)
            : String(item.requirementLabel || "").trim().toLowerCase() ===
              String(r.label || "").trim().toLowerCase();
          if (!matches) continue;
          suppliers.push({
            requestId: String(req._id),
            supplierName:
              req.supplierId?.companyName || req.supplierId?.name || "Supplier",
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            status: req.status,
          });
        }
      }

      const served = suppliers.reduce((s, x) => s + x.quantity, 0);
      return {
        id: r.id,
        label: r.label,
        quantity: r.quantity,
        description: r.description || "",
        required,
        served,
        // Nothing to chase when the organizer didn't give a number.
        remaining: required > 0 ? Math.max(0, required - served) : 0,
        tracked: required > 0,
        fullyServed: required > 0 && served >= required,
        suppliers,
      };
    });

    return {
      requirements,
      totals: {
        tracked: requirements.filter((r: any) => r.tracked).length,
        fullyServed: requirements.filter((r: any) => r.fullyServed).length,
      },
    };
  }

  // ============ PUBLIC: EVENT-BASED FORM + SUBMISSION ============

  // What the supplier sees on the shared form: the organizer's requirements +
  // minimal event info. Throws if the form isn't currently open.
  async getFormByEvent(eventId: string) {
    this.assertId(eventId, "eventId");
    const config = await this.configModel
      .findOne({ eventId: new Types.ObjectId(eventId), enabled: true })
      .lean();
    if (!config) {
      throw new NotFoundException(
        "This supplier form is not open for submissions right now.",
      );
    }
    const event = await this.eventModel
      .findById(config.eventId)
      .select("title startDate endDate location")
      .lean();

    // Show what's still needed, not the original ask. Once other suppliers
    // have committed part of a requirement, the next supplier should only be
    // quoting for the shortfall — and anything already fully covered drops
    // off the form entirely.
    //
    // Only the numbers cross over: who is supplying what stays private to the
    // organizer, so nothing from `suppliers` is exposed here.
    const { requirements: fulfilled } = await this.requirementFulfilment(
      eventId,
    );
    const byId = new Map(fulfilled.map((f: any) => [String(f.id), f]));

    const requirements = (config.requirements || [])
      .map((r: any) => {
        const f: any = byId.get(String(r.id));
        // No numeric quantity → nothing to subtract, show it as-is.
        if (!f?.tracked) return { ...r, remaining: null, partiallyCovered: false };
        return {
          ...r,
          // The quantity a supplier sees is the outstanding amount.
          quantity: String(f.remaining),
          remaining: f.remaining,
          partiallyCovered: f.served > 0,
          fullyServed: f.fullyServed,
        };
      })
      .filter((r: any) => !r.fullyServed);

    return {
      requirements,
      instructions: config.instructions || "",
      currency: config.currency || "IN",
      event: event
        ? {
            id: String((event as any)._id),
            title: (event as any).title,
            startDate: (event as any).startDate,
            endDate: (event as any).endDate,
            location: (event as any).location,
          }
        : null,
    };
  }

  // Gmail-login lookup for the public quotation form: given the event and the
  // Google-verified email, find the supplier saved under that event's organizer
  // (matching personal email OR business email, case-insensitive). Returns null
  // when no profile exists yet, so the form falls through to self-register.
  async findSupplierForEventByEmail(eventId: string, email: string) {
    this.assertId(eventId, "eventId");
    const clean = (email || "").trim().toLowerCase();
    if (!clean) return null;
    const { organizerId } = await this.resolveEvent(eventId);
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`^${escaped}$`, "i");
    // resolveEvent returns organizerId as whatever the event stores — often a
    // string. Cast it to an ObjectId (as the rest of the service does) so the
    // organizer filter reliably matches suppliers whose organizerId is an
    // ObjectId; relying on implicit casting fails when combined with the $or.
    const orgFilter =
      organizerId && Types.ObjectId.isValid(String(organizerId))
        ? { organizerId: new Types.ObjectId(String(organizerId)) }
        : {};
    const supplier = await this.supplierModel
      .findOne({
        ...orgFilter,
        $or: [{ email: rx }, { businessEmail: rx }],
      })
      .lean();
    return supplier;
  }

  // Supplier revisit: after they Google-sign-in again, fetch their existing
  // quotation for this event (if any) with the full status timeline, so the
  // form can show the negotiation/approval/rejection history instead of a
  // blank form. `email` is already Google-verified by the OAuth popup.
  async getMyRequestForEvent(eventId: string, email: string) {
    this.assertId(eventId, "eventId");
    const supplier = await this.findSupplierForEventByEmail(eventId, email);
    if (!supplier) return null;
    const request = await this.requestModel
      .findOne({
        eventId: new Types.ObjectId(eventId),
        supplierId: (supplier as any)._id,
      })
      .populate("eventId", "title startDate endDate location")
      .lean();
    if (!request) return null;
    return { supplier, request };
  }

  // Supplier's negotiation reply from the public timeline (Approve / Negotiate
  // / Reject). Email is Google-verified. Only allowed while the quotation is
  // still open (Quoted or Negotiating); once approved/paid it's locked.
  async supplierRespond(
    eventId: string,
    email: string,
    dto: SupplierRespondDto,
  ) {
    const found = await this.getMyRequestForEvent(eventId, email);
    if (!found) throw new NotFoundException("No quotation found for you.");
    const req = await this.requestModel.findById((found.request as any)._id);
    if (!req) throw new NotFoundException("No quotation found for you.");
    if (
      req.status !== SupplierRequestStatus.Quoted &&
      req.status !== SupplierRequestStatus.Negotiating
    ) {
      throw new BadRequestException(
        "This quotation can no longer be changed.",
      );
    }
    const by = (found.supplier as any)?.name || "Supplier";
    req.status = dto.status as SupplierRequestStatus;
    if (dto.status === "Rejected") req.rejectionReason = dto.note || "";
    const counter = Number((dto as any).agreedAmount);
    if (Number.isFinite(counter) && counter > 0) req.agreedTotal = counter;
    req.statusHistory.push({
      status: dto.status as SupplierRequestStatus,
      note: dto.note || "",
      changedAt: new Date(),
      changedBy: by,
    } as any);
    await req.save();

    const reply =
      dto.status === "Approved"
        ? {
            heading: "Supplier accepted your terms",
            summary: `${by} has accepted the current offer.`,
          }
        : dto.status === "Rejected"
          ? {
              heading: "Supplier declined",
              summary: `${by} has declined and won't be proceeding.`,
            }
          : {
              heading: "Supplier sent a counter-offer",
              summary: `${by} has replied with new terms — negotiation continues.`,
            };
    this.notify(req, "organizer", { ...reply, note: dto.note });

    return req;
  }

  // Supplier confirms the organizer's payment and uploads their invoice / bill,
  // completing the request. Only valid once the organizer has recorded payment.
  async supplierConfirmPayment(
    eventId: string,
    email: string,
    invoicePath?: string,
    note?: string,
  ) {
    const found = await this.getMyRequestForEvent(eventId, email);
    if (!found) throw new NotFoundException("No quotation found for you.");
    const req = await this.requestModel.findById((found.request as any)._id);
    if (!req) throw new NotFoundException("No quotation found for you.");
    // Only once the quote is settled in full — while a balance is outstanding
    // the request stays `Partially Paid` and can't be closed out.
    if (req.status !== SupplierRequestStatus.Paid) {
      const balance = Number(req.payment?.balanceDue) || 0;
      throw new BadRequestException(
        req.status === SupplierRequestStatus.PartiallyPaid
          ? `The organizer has paid part of your quote — ${balance} is still outstanding. You can confirm once it's settled in full.`
          : "You can confirm the payment only after the organizer has paid.",
      );
    }
    const by = (found.supplier as any)?.name || "Supplier";
    req.payment = {
      ...(req.payment as any),
      invoice: invoicePath || req.payment?.invoice || "",
      confirmedBySupplier: true,
      confirmedAt: new Date(),
    } as any;
    req.status = SupplierRequestStatus.Completed;
    req.statusHistory.push({
      status: SupplierRequestStatus.Completed,
      note: note || "Payment confirmed by supplier.",
      changedAt: new Date(),
      changedBy: by,
    } as any);
    await req.save();

    this.notify(req, "organizer", {
      heading: "Supplier confirmed your payment",
      summary: `${by} has acknowledged the payment and uploaded their invoice.`,
      rows: invoicePath ? [["Invoice", "Attached to the quotation"]] : [],
      note,
    });

    return req;
  }

  async submitRequest(dto: CreateSupplierRequestDto, attachmentPath?: string) {
    this.assertId(dto.eventId, "eventId");
    const config = await this.configModel.findOne({
      eventId: new Types.ObjectId(dto.eventId),
      enabled: true,
    });
    if (!config) {
      throw new BadRequestException(
        "This supplier form is not open for submissions right now.",
      );
    }
    const eventId = config.eventId;
    // The config (and the event it derives from) can hold organizerId as a
    // plain string. Normalize to an ObjectId so the supplier + request are
    // stored consistently with the CRM path (createForOrganizer) — otherwise a
    // string-typed organizerId never matches the ObjectId-cast queries used by
    // findSupplierForEventByEmail / listByOrganizer.
    const organizerId = Types.ObjectId.isValid(String(config.organizerId))
      ? new Types.ObjectId(String(config.organizerId))
      : config.organizerId;

    // Find-or-create the supplier identity (scoped to the organizer, keyed by
    // email when provided so a returning supplier reuses their profile).
    const email = (dto.email || "").trim().toLowerCase();
    const fields = {
      organizerId,
      name: dto.name,
      email,
      businessEmail: (dto.businessEmail || "").trim().toLowerCase(),
      phone: dto.phone || "",
      countryCode: dto.countryCode || "",
      whatsAppNumber: dto.whatsAppNumber || "",
      companyName: dto.companyName || "",
      serviceCategory: dto.serviceCategory || "",
      description: dto.description || "",
      website: dto.website || "",
      country: dto.country || "",
    };
    // Payout details are stored on the supplier as well as the quotation, so
    // a returning supplier never retypes their bank details. Only overwrite
    // when this submission actually carried something.
    const account = parseJson<Record<string, any>>(dto.accountDetails, {});
    const hasAccount = Object.values(account || {}).some(
      (v) => String(v ?? "").trim() !== "",
    );

    let supplier: SupplierDocument | null = null;
    if (email) supplier = await this.supplierModel.findOne({ organizerId, email });
    if (supplier) {
      Object.assign(supplier, fields);
      if (hasAccount) supplier.accountDetails = account as any;
      await supplier.save();
    } else {
      supplier = await this.supplierModel.create({
        ...fields,
        ...(hasAccount ? { accountDetails: account } : {}),
      });
    }

    // Single-submission rule: one quotation per supplier per event.
    const already = await this.requestModel.findOne({
      eventId,
      supplierId: supplier._id,
    });
    if (already) {
      throw new ConflictException(
        "You have already submitted a quotation for this event.",
      );
    }

    const items = parseJson<any[]>(dto.quotationItems, []);
    const total =
      dto.quotationTotal != null && dto.quotationTotal !== ""
        ? Number(dto.quotationTotal) || 0
        : items.reduce((s, it) => s + (Number(it?.price) || 0), 0);

    try {
      const created = await this.requestModel.create({
        supplierId: supplier._id,
        eventId,
        organizerId,
        status: SupplierRequestStatus.Quoted,
        quotationItems: items,
        quotationTotal: total,
        quotationNotes: dto.quotationNotes || "",
        quotationAttachment: attachmentPath || "",
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        accountDetails: account,
        statusHistory: [
          {
            status: SupplierRequestStatus.Quoted,
            note: "Quotation submitted",
            changedAt: new Date(),
            changedBy: dto.name,
          },
        ],
        submittedAt: new Date(),
      });

      this.notify(created, "organizer", {
        heading: "New supplier quotation received",
        summary: `${supplier.companyName || supplier.name} has submitted a quotation for your event.`,
        rows: dto.quotationNotes ? [["Supplier note", dto.quotationNotes]] : [],
      });

      return created;
    } catch (err: any) {
      // Unique (eventId, supplierId) race → already submitted.
      if (err?.code === 11000) {
        throw new ConflictException(
          "You have already submitted a quotation for this event.",
        );
      }
      throw err;
    }
  }

  // ============ ORGANIZER: LIST + MANAGE QUOTATIONS ============

  async listByEvent(eventId: string) {
    this.assertId(eventId, "eventId");
    return this.requestModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .populate("supplierId")
      .sort({ createdAt: -1 })
      .lean();
  }

  async listByOrganizer(organizerId: string) {
    this.assertId(organizerId, "organizerId");
    return this.requestModel
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .populate("supplierId")
      .populate("eventId", "title startDate endDate location")
      .sort({ createdAt: -1 })
      .lean();
  }

  async getOne(id: string) {
    this.assertId(id);
    const req = await this.requestModel
      .findById(id)
      .populate("supplierId")
      .populate("eventId", "title startDate endDate location")
      .lean();
    if (!req) throw new NotFoundException("Supplier request not found");
    return req;
  }

  async updateStatus(id: string, dto: UpdateSupplierStatusDto) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Supplier request not found");
    req.status = dto.status as SupplierRequestStatus;
    if (dto.status === "Rejected") req.rejectionReason = dto.rejectionReason || "";

    // Capture the agreed price whenever one is supplied — on the counter-offer
    // itself or on the approval that settles it.
    const agreed = Number(dto.agreedAmount);
    if (Number.isFinite(agreed) && agreed > 0) req.agreedTotal = agreed;
    req.statusHistory.push({
      status: dto.status as SupplierRequestStatus,
      note: dto.notes || dto.rejectionReason || "",
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);
    await req.save();

    const DECISIONS: Record<string, { heading: string; summary: string }> = {
      Approved: {
        heading: "Your quotation was approved",
        summary: "The organizer has accepted your quotation.",
      },
      Rejected: {
        heading: "Your quotation was declined",
        summary: "The organizer has declined your quotation.",
      },
      Negotiating: {
        heading: "The organizer sent a counter-offer",
        summary:
          "Your quotation is being negotiated — see their message below.",
      },
      Completed: {
        heading: "Engagement marked complete",
        summary: "The organizer has marked this booking as completed.",
      },
      Cancelled: {
        heading: "Your booking was cancelled",
        summary: "The organizer has cancelled this engagement.",
      },
    };
    const decision = DECISIONS[dto.status] || DECISIONS.Negotiating;
    this.notify(req, "supplier", {
      ...decision,
      note: dto.notes || dto.rejectionReason,
    });

    // Re-populate before returning: the organizer UI merges this response into
    // the row it already holds, so an unpopulated supplierId would wipe the
    // supplier's name/company off the table and the detail dialog.
    return req.populate("supplierId");
  }

  // Record one payment towards the quote. Organizers usually pay an advance
  // first and the balance later, so each call appends an instalment and the
  // request only settles to `Paid` once the running total clears the quote —
  // until then it sits at `Partially Paid` with the difference outstanding.
  async recordPayment(
    id: string,
    dto: RecordSupplierPaymentDto,
    proofPath?: string,
  ) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Supplier request not found");

    // Same gate as checkItems — a quote that's still Quoted/Negotiating has no
    // agreed total to pay against, and a Rejected/Cancelled one shouldn't be
    // payable at all.
    const PAYABLE = [
      SupplierRequestStatus.Approved,
      SupplierRequestStatus.PartiallyPaid,
      SupplierRequestStatus.Paid,
      SupplierRequestStatus.Completed,
    ];
    if (!PAYABLE.includes(req.status)) {
      throw new BadRequestException(
        "Payments can only be recorded once the quotation is approved.",
      );
    }

    const total = this.payable(req);
    const alreadyPaid = Number(req.payment?.amountPaid) || 0;
    const outstanding = Math.max(0, total - alreadyPaid);
    const explicitAmount =
      dto.amountPaid != null && dto.amountPaid !== ""
        ? Number(dto.amountPaid) || 0
        : null;

    // Already settled: no new instalment to add, but the organizer may still
    // be re-uploading the proof or correcting the reference on the last one.
    if (outstanding <= 0) {
      if (explicitAmount && explicitAmount > 0) {
        throw new BadRequestException(
          "This quotation is already paid in full.",
        );
      }
      return this.amendLatestPayment(req, dto, proofPath);
    }

    // No amount given → settle whatever is still outstanding (the common
    // "pay the balance" case). An explicit amount records a part-payment.
    const amount = explicitAmount ?? outstanding;
    if (amount <= 0) {
      throw new BadRequestException("Enter a payment amount greater than zero.");
    }

    const paidDate = dto.paidDate ? new Date(dto.paidDate) : new Date();
    const installment = {
      amount,
      paidDate,
      method: dto.method || "",
      reference: dto.reference || "",
      proofScreenshot: proofPath || "",
      notes: dto.notes || "",
      recordedBy: dto.changedBy || "Organizer",
    };

    const amountPaid = alreadyPaid + amount;
    // Overpayment (rounding, extra charges) shouldn't produce a negative
    // balance — the quote is simply settled.
    const balanceDue = Math.max(0, total - amountPaid);
    const settled = balanceDue <= 0;

    req.payment = {
      ...(req.payment as any),
      installments: [...(req.payment?.installments || []), installment],
      amountPaid,
      balanceDue,
      // Flat fields mirror the latest instalment (back-compat).
      paidDate,
      method: installment.method,
      reference: installment.reference,
      proofScreenshot: proofPath || req.payment?.proofScreenshot || "",
      notes: installment.notes,
    } as any;

    req.status = settled
      ? SupplierRequestStatus.Paid
      : SupplierRequestStatus.PartiallyPaid;

    const ref = dto.reference ? ` (ref: ${dto.reference})` : "";
    req.statusHistory.push({
      status: req.status,
      note: settled
        ? `Paid ${amount}${ref} — quotation settled in full (${amountPaid} of ${total}).`
        : `Part payment ${amount}${ref} — ${amountPaid} of ${total} paid, balance ${balanceDue}.`,
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);

    await req.save();

    // Currency for the notification figures — the organizer's country, same
    // convention as the rest of the app.
    const payOrg: any = await this.organizerModel
      .findById(req.organizerId)
      .select("country")
      .lean();
    const sym = payOrg?.country === "SG" ? "SG$" : "₹";
    const fmt = (n: number) => `${sym}${Number(n || 0).toLocaleString()}`;
    this.notify(req, "supplier", {
      heading: settled
        ? "You have been paid in full"
        : "A part payment has been made to you",
      summary: settled
        ? "The organizer has settled your quotation in full."
        : "The organizer has paid part of your quotation — the balance is shown below.",
      rows: [
        ["Paid now", fmt(amount)],
        ["Paid to date", fmt(amountPaid)],
        ["Balance due", fmt(balanceDue)],
        ...(dto.reference ? ([["Reference", dto.reference]] as Array<[string, string]>) : []),
      ],
      note: dto.notes,
    });

    return req.populate("supplierId");
  }

  // Fully-paid quote: the organizer isn't paying more, they're correcting the
  // record (re-uploading proof, fixing a reference). Updates the last
  // instalment in place — the totals and the status are left alone.
  private async amendLatestPayment(
    req: SupplierRequestDocument,
    dto: RecordSupplierPaymentDto,
    proofPath?: string,
  ) {
    const installments = req.payment?.installments || [];
    const last: any = installments[installments.length - 1];
    if (last) {
      if (proofPath) last.proofScreenshot = proofPath;
      if (dto.reference) last.reference = dto.reference;
      if (dto.method) last.method = dto.method;
      if (dto.notes) last.notes = dto.notes;
      if (dto.paidDate) last.paidDate = new Date(dto.paidDate);
    }
    req.payment = {
      ...(req.payment as any),
      installments,
      proofScreenshot: proofPath || req.payment?.proofScreenshot || "",
      reference: dto.reference || req.payment?.reference || "",
      method: dto.method || req.payment?.method || "",
      notes: dto.notes || req.payment?.notes || "",
    } as any;
    req.markModified("payment");
    req.statusHistory.push({
      status: req.status,
      note: proofPath
        ? "Payment proof updated."
        : "Payment details updated.",
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);
    await req.save();
    return req.populate("supplierId");
  }

  /**
   * Record goods arriving at (or leaving) the venue.
   *
   * Deliberately independent of payment: a supplier routinely delivers before
   * the balance is settled, so an operator can check items in at any point
   * once the quote is approved. Quantities are refused rather than silently
   * trimmed: nothing can be received twice or beyond what was quoted, and
   * nothing can be checked out that was never checked in. Every movement is
   * written to the timeline as well as the delivery log.
   */
  async checkItems(
    id: string,
    direction: "in" | "out",
    entries: Array<{ requirementLabel: string; quantity: number }>,
    by?: string,
    note?: string,
  ) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Supplier request not found");

    const OPEN = [
      SupplierRequestStatus.Approved,
      SupplierRequestStatus.PartiallyPaid,
      SupplierRequestStatus.Paid,
      SupplierRequestStatus.Completed,
    ];
    if (!OPEN.includes(req.status)) {
      throw new BadRequestException(
        "Items can only be checked in once the quotation is approved.",
      );
    }

    // Validate every line BEFORE touching anything, so a bad quantity can't
    // leave half the delivery recorded.
    const planned: Array<{ item: any; qty: number }> = [];
    for (const entry of entries || []) {
      const qty = Number(entry?.quantity) || 0;
      if (qty <= 0) continue;

      const label = String(entry.requirementLabel || "").trim();
      const item: any = (req.quotationItems || []).find(
        (i: any) =>
          String(i.requirementLabel || "").trim().toLowerCase() ===
          label.toLowerCase(),
      );
      if (!item) {
        throw new BadRequestException(
          `"${label}" isn't part of this quotation.`,
        );
      }

      const quoted = Number(item.quantity) || 0;
      const already = Number(item.checkedInQty) || 0;
      const out = Number(item.checkedOutQty) || 0;

      if (direction === "in") {
        // A line can only be received up to what was quoted, and only once
        // it's been fully received is it closed.
        if (quoted > 0 && already >= quoted) {
          throw new BadRequestException(
            `"${item.requirementLabel}" is already fully checked in (${already} of ${quoted}).`,
          );
        }
        if (quoted > 0 && already + qty > quoted) {
          throw new BadRequestException(
            `Only ${quoted - already} of "${item.requirementLabel}" left to check in — you entered ${qty}.`,
          );
        }
      } else {
        // Nothing can leave that never arrived.
        if (already <= 0) {
          throw new BadRequestException(
            `"${item.requirementLabel}" hasn't been checked in yet, so it can't be checked out.`,
          );
        }
        if (out >= already) {
          throw new BadRequestException(
            `"${item.requirementLabel}" is already fully checked out (${out} of ${already}).`,
          );
        }
        if (out + qty > already) {
          throw new BadRequestException(
            `Only ${already - out} of "${item.requirementLabel}" available to check out — you entered ${qty}.`,
          );
        }
      }

      planned.push({ item, qty });
    }

    if (planned.length === 0) {
      throw new BadRequestException("Enter a quantity to check in or out.");
    }

    for (const { item, qty } of planned) {
      if (direction === "in") item.checkedInQty = (Number(item.checkedInQty) || 0) + qty;
      else item.checkedOutQty = (Number(item.checkedOutQty) || 0) + qty;

      req.deliveryLog.push({
        direction,
        requirementLabel: item.requirementLabel,
        quantity: qty,
        at: new Date(),
        by: by || "Organizer",
        note: note || "",
      } as any);
    }

    // Surface the movement on the visible timeline, not just the delivery log,
    // so the organizer sees receipts alongside status and payment events.
    const summary = planned
      .map(({ item, qty }) => `${item.requirementLabel} × ${qty}`)
      .join(", ");
    req.statusHistory.push({
      status: req.status,
      note:
        direction === "in"
          ? `Checked in: ${summary}${note ? ` — ${note}` : ""}`
          : `Checked out: ${summary}${note ? ` — ${note}` : ""}`,
      changedAt: new Date(),
      changedBy: by || "Organizer",
    } as any);

    req.markModified("quotationItems");
    await req.save();

    this.notify(req, "supplier", {
      heading:
        direction === "in"
          ? "Your delivery was received"
          : "Items were checked out",
      summary:
        direction === "in"
          ? "The organizer has confirmed receipt of items at the venue."
          : "The organizer has recorded items leaving the venue.",
      rows: (req.quotationItems || []).map(
        (i: any) =>
          [
            i.requirementLabel,
            `${i.checkedInQty || 0} in / ${i.checkedOutQty || 0} out of ${i.quantity || 0}`,
          ] as [string, string],
      ),
      note,
    });

    return req.populate("supplierId");
  }

  async addNote(id: string, dto: AddSupplierNoteDto) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Supplier request not found");
    req.statusHistory.push({
      status: req.status,
      note: dto.note,
      changedAt: new Date(),
      changedBy: dto.addedBy || "Organizer",
    } as any);
    await req.save();
    return req.populate("supplierId");
  }
}
