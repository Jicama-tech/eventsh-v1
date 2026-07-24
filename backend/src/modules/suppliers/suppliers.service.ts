import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { randomBytes } from "crypto";
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
import { UpsertSupplierConfigDto } from "./dto/upsert-supplier-config.dto";
import { UpdateSupplierStatusDto } from "./dto/update-supplier-status.dto";
import { RecordSupplierPaymentDto } from "./dto/record-supplier-payment.dto";
import { AddSupplierNoteDto } from "./dto/add-supplier-note.dto";

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
  ) {}

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
    return config;
  }

  // Generate (or regenerate) the private link token and enable submissions.
  // Regenerating invalidates any previously shared link.
  async generateLink(eventId: string) {
    const config = await this.getOrCreateConfig(eventId);
    config.linkToken = randomBytes(16).toString("hex");
    config.enabled = true;
    await config.save();
    return config;
  }

  async setLinkEnabled(eventId: string, enabled: boolean) {
    const config = await this.getOrCreateConfig(eventId);
    config.enabled = enabled;
    await config.save();
    return config;
  }

  // ============ PUBLIC: TOKEN-GATED FORM + SUBMISSION ============

  // What the supplier sees on the shared form: the organizer's requirements +
  // minimal event info. Throws if the link is invalid/disabled.
  async getFormByToken(token: string) {
    const config = await this.configModel
      .findOne({ linkToken: token, enabled: true })
      .lean();
    if (!config) {
      throw new NotFoundException(
        "This supplier link is invalid or has been disabled.",
      );
    }
    const event = await this.eventModel
      .findById(config.eventId)
      .select("title startDate endDate location")
      .lean();
    return {
      requirements: config.requirements || [],
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

  async submitRequest(dto: CreateSupplierRequestDto, attachmentPath?: string) {
    const config = await this.configModel.findOne({
      linkToken: dto.token,
      enabled: true,
    });
    if (!config) {
      throw new BadRequestException(
        "This supplier link is invalid or has been disabled.",
      );
    }
    const eventId = config.eventId;
    const organizerId = config.organizerId;

    // Find-or-create the supplier identity (scoped to the organizer, keyed by
    // email when provided so a returning supplier reuses their profile).
    const email = (dto.email || "").trim().toLowerCase();
    const fields = {
      organizerId,
      name: dto.name,
      email,
      phone: dto.phone || "",
      countryCode: dto.countryCode || "",
      whatsAppNumber: dto.whatsAppNumber || "",
      companyName: dto.companyName || "",
      serviceCategory: dto.serviceCategory || "",
      description: dto.description || "",
      website: dto.website || "",
      country: dto.country || "",
    };
    let supplier: SupplierDocument | null = null;
    if (email) supplier = await this.supplierModel.findOne({ organizerId, email });
    if (supplier) {
      Object.assign(supplier, fields);
      await supplier.save();
    } else {
      supplier = await this.supplierModel.create(fields);
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
    const account = parseJson<Record<string, any>>(dto.accountDetails, {});
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
    req.statusHistory.push({
      status: dto.status as SupplierRequestStatus,
      note: dto.notes || dto.rejectionReason || "",
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);
    await req.save();
    return req;
  }

  async recordPayment(
    id: string,
    dto: RecordSupplierPaymentDto,
    proofPath?: string,
  ) {
    this.assertId(id);
    const req = await this.requestModel.findById(id);
    if (!req) throw new NotFoundException("Supplier request not found");
    const amount =
      dto.amountPaid != null && dto.amountPaid !== ""
        ? Number(dto.amountPaid) || 0
        : req.quotationTotal;
    req.payment = {
      amountPaid: amount,
      paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date(),
      method: dto.method || "",
      reference: dto.reference || "",
      proofScreenshot: proofPath || req.payment?.proofScreenshot || "",
      notes: dto.notes || "",
    } as any;
    req.status = SupplierRequestStatus.Paid;
    req.statusHistory.push({
      status: SupplierRequestStatus.Paid,
      note: `Paid ${amount}${dto.reference ? ` (ref: ${dto.reference})` : ""}`,
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    } as any);
    await req.save();
    return req;
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
    return req;
  }
}
