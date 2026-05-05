import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { createHash } from "crypto";
import {
  Template,
  TemplateDocument,
  TemplateType,
} from "./schemas/template.schema";

// Fields that participate in the dedupe signature for a Space template.
// Anything affecting "is this a meaningful variant" goes here. State fields
// like isBooked / bookedBy are intentionally excluded.
const SPACE_SIGNATURE_FIELDS = [
  "name",
  "type",
  "width",
  "height",
  "rowNumber",
  "tablePrice",
  "bookingPrice",
  "depositPrice",
  "color",
  "customDimensions",
] as const;

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectModel(Template.name)
    private templateModel: Model<TemplateDocument>,
  ) {}

  // Stable dedupe key — sort field names so JSON ordering doesn't matter,
  // hash to keep the index small.
  private signature(payload: Record<string, any>): string {
    const norm: Record<string, any> = {};
    for (const k of Object.keys(payload).sort()) {
      const v = payload[k];
      if (v == null) continue;
      norm[k] =
        typeof v === "number"
          ? Number(v)
          : typeof v === "string"
            ? v.trim()
            : v;
    }
    return createHash("sha1").update(JSON.stringify(norm)).digest("hex");
  }

  // Pull just the fields we care about from a tableTemplate, dropping booking
  // state. Empty/null values normalised so two templates that differ only in
  // an undefined key still collide.
  private extractSpacePayload(t: any): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of SPACE_SIGNATURE_FIELDS) {
      if (t[k] !== undefined) out[k] = t[k];
    }
    return out;
  }

  // Upsert one or many space templates for an organizer. Called from the
  // events service whenever an event is created or updated. Fire-and-forget;
  // never blocks the parent operation on failure.
  async captureSpaceTemplates(
    organizerId: string | Types.ObjectId,
    tableTemplates: any[] | undefined | null,
  ): Promise<void> {
    if (!Array.isArray(tableTemplates) || tableTemplates.length === 0) return;
    const orgObjId =
      typeof organizerId === "string"
        ? Types.ObjectId.isValid(organizerId)
          ? new Types.ObjectId(organizerId)
          : null
        : organizerId;
    if (!orgObjId) return;

    for (const raw of tableTemplates) {
      try {
        const payload = this.extractSpacePayload(raw);
        const name = String(payload.name || "").trim();
        if (!name) continue;
        const signature = this.signature(payload);
        await this.templateModel.updateOne(
          {
            organizerId: orgObjId,
            type: TemplateType.SPACE,
            signature,
          },
          {
            $setOnInsert: {
              organizerId: orgObjId,
              type: TemplateType.SPACE,
              name,
              signature,
              payload,
            },
          },
          { upsert: true },
        );
      } catch (err: any) {
        // Duplicate-key on race is fine — we wanted upsert anyway. Log
        // anything else so we can spot real problems.
        if (err?.code !== 11000) {
          this.logger.warn(
            `captureSpaceTemplates failed for ${organizerId}: ${err?.message || err}`,
          );
        }
      }
    }
  }

  async listForOrganizer(
    organizerId: string,
    type?: TemplateType,
  ): Promise<TemplateDocument[]> {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const query: any = { organizerId: new Types.ObjectId(organizerId) };
    if (type) query.type = type;
    return this.templateModel
      .find(query)
      .sort({ name: 1, createdAt: -1 })
      .lean();
  }

  // Manual create — used by the frontend when an organizer wants to save a
  // template explicitly without going through an event save.
  async create(
    organizerId: string,
    type: TemplateType,
    name: string,
    payload: Record<string, any>,
  ) {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const orgObjId = new Types.ObjectId(organizerId);
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new BadRequestException("Template name is required");

    const sig = this.signature({ ...payload, name: trimmed });
    const doc = await this.templateModel.findOneAndUpdate(
      { organizerId: orgObjId, type, signature: sig },
      {
        $setOnInsert: {
          organizerId: orgObjId,
          type,
          name: trimmed,
          signature: sig,
          payload: { ...payload, name: trimmed },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { message: "Template saved", data: doc };
  }

  async remove(organizerId: string, templateId: string) {
    if (
      !Types.ObjectId.isValid(organizerId) ||
      !Types.ObjectId.isValid(templateId)
    ) {
      throw new BadRequestException("Invalid id");
    }
    const result = await this.templateModel.deleteOne({
      _id: new Types.ObjectId(templateId),
      organizerId: new Types.ObjectId(organizerId),
    });
    return { deleted: result.deletedCount === 1 };
  }
}
