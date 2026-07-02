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

  // Return the placed stalls that belong to one venue. venueTables may arrive
  // as a flat array (each tagged with venueConfigId) or as a Record keyed by
  // venue id. Legacy/untagged stalls belong to the FIRST venue only.
  private tablesForVenue(
    venueTables: any,
    venueId: string,
    isFirst: boolean,
  ): any[] {
    if (!venueTables) return [];
    if (Array.isArray(venueTables)) {
      return venueTables.filter((t) => {
        const cid = t?.venueConfigId;
        if (cid && cid !== "default") return cid === venueId;
        return isFirst;
      });
    }
    return Array.isArray(venueTables[venueId]) ? venueTables[venueId] : [];
  }

  // The full stall-type templates used by a venue's placed stalls. Prefers the
  // event's authored template (most complete) and falls back to reconstructing
  // one from the placed stall's own fields (PositionedTable carries every
  // TableTemplate field). Deduped by template id, then name.
  private usedTemplatesForVenue(
    tablesForVenue: any[],
    allTemplates: any[],
  ): any[] {
    const TEMPLATE_FIELDS = [
      "id",
      "name",
      "type",
      "width",
      "height",
      "rowNumber",
      "tablePrice",
      "bookingPrice",
      "depositPrice",
      "memberPrice",
      "memberBookingPrice",
      "memberDepositPrice",
      "minimumPaymentEnabled",
      "depositInOption1",
      "color",
      "forSale",
      "customDimensions",
      "maxPerBooking",
    ];
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const t of allTemplates) {
      if (t?.id) byId.set(String(t.id), t);
      if (t?.name) byName.set(String(t.name).toLowerCase(), t);
    }
    const seen = new Set<string>();
    const out: any[] = [];
    for (const placed of tablesForVenue) {
      const idKey = placed?.id ? String(placed.id) : "";
      const nameKey = placed?.name ? String(placed.name).toLowerCase() : "";
      const dedupeKey = idKey || nameKey;
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const source =
        (idKey && byId.get(idKey)) || (nameKey && byName.get(nameKey)) || placed;
      const tpl: Record<string, any> = {};
      for (const f of TEMPLATE_FIELDS) {
        if (source[f] !== undefined) tpl[f] = source[f];
      }
      out.push(tpl);
    }
    return out;
  }

  // Canonical projection of a venue layout for the dedupe signature. Excludes
  // volatile ids (venue id, positionId) so re-saving the SAME layout collapses
  // into one row, while any real change (dimensions, stall types, positions,
  // or the venue name) yields a new signature → a separate saved design.
  private normalizeVenueLayoutForSignature(
    payload: Record<string, any>,
  ): Record<string, any> {
    const vc = payload.venueConfig || {};
    const cfg = {
      width: Number(vc.width) || 0,
      height: Number(vc.height) || 0,
      scale: Number(vc.scale) || 0,
      gridSize: Number(vc.gridSize) || 0,
      showGrid: !!vc.showGrid,
      hasMainStage: !!vc.hasMainStage,
      totalRows: Number(vc.totalRows) || 0,
      name: String(vc.name || "").trim(),
      cropped: !!vc.cropped,
      cropWidth: Number(vc.cropWidth) || 0,
      cropHeight: Number(vc.cropHeight) || 0,
    };
    const templates = (payload.tableTemplates || [])
      .map((t: any) => this.extractSpacePayload(t))
      .sort((a: any, b: any) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    const tables = (payload.venueTables || [])
      .map((t: any) => ({
        n: String(t.name || t.type || "").trim(),
        x: Math.round(Number(t.x) || 0),
        y: Math.round(Number(t.y) || 0),
        r: Number(t.rotation) || 0,
        w: Number(t.width || t.displayWidth) || 0,
        h: Number(t.height || t.displayHeight) || 0,
      }))
      .sort(
        (a: any, b: any) => a.x - b.x || a.y - b.y || a.n.localeCompare(b.n),
      );
    const roundTables = (payload.venueRoundTables || [])
      .map((t: any) => ({
        n: String(t.name || t.type || "").trim(),
        x: Math.round(Number(t.x) || 0),
        y: Math.round(Number(t.y) || 0),
        r: Number(t.rotation) || 0,
      }))
      .sort(
        (a: any, b: any) => a.x - b.x || a.y - b.y || a.n.localeCompare(b.n),
      );
    const speakerZones = (payload.venueSpeakerZones || [])
      .map((z: any) => ({
        n: String(z.name || z.label || "").trim(),
        x: Math.round(Number(z.x) || 0),
        y: Math.round(Number(z.y) || 0),
      }))
      .sort(
        (a: any, b: any) => a.x - b.x || a.y - b.y || a.n.localeCompare(b.n),
      );
    return { cfg, templates, tables, roundTables, speakerZones };
  }

  // Snapshot each venue of an event as a reusable "venueLayout" template.
  // Called fire-and-forget on event create/update. Signature-dedupe means a
  // repeat save is a no-op, but a modified imported layout becomes a new
  // library entry. Only venues that actually have placed stalls are saved.
  async captureVenueLayoutTemplates(
    organizerId: string | Types.ObjectId,
    event: any,
  ): Promise<void> {
    const venues = event?.venueConfig;
    if (!Array.isArray(venues) || venues.length === 0) return;
    const orgObjId =
      typeof organizerId === "string"
        ? Types.ObjectId.isValid(organizerId)
          ? new Types.ObjectId(organizerId)
          : null
        : organizerId;
    if (!orgObjId) return;

    const allTemplates = Array.isArray(event.tableTemplates)
      ? event.tableTemplates
      : [];
    const allRoundTemplates = Array.isArray(event.roundTableTemplates)
      ? event.roundTableTemplates
      : [];
    const allSpeakerTemplates = Array.isArray(event.speakerSlotTemplates)
      ? event.speakerSlotTemplates
      : [];

    for (let i = 0; i < venues.length; i++) {
      try {
        const venue = venues[i] || {};
        const venueId = venue.venueConfigId || venue.id;
        const tablesForVenue = this.tablesForVenue(
          event.venueTables,
          venueId,
          i === 0,
        );
        const roundTablesForVenue = this.tablesForVenue(
          event.venueRoundTables,
          venueId,
          i === 0,
        );
        const speakerZonesForVenue = this.tablesForVenue(
          event.venueSpeakerZones,
          venueId,
          i === 0,
        );
        // Skip only if the venue is completely empty (no spaces, no round
        // tables, no speaker zones) — nothing worth saving as a layout.
        if (
          tablesForVenue.length === 0 &&
          roundTablesForVenue.length === 0 &&
          speakerZonesForVenue.length === 0
        ) {
          continue;
        }

        // Only the stall types actually USED in THIS venue. A placed stall's
        // `id` is its template id (PositionedTable extends TableTemplate), so
        // match on that (fall back to name). If a template isn't in the
        // event's palette, reconstruct it from the placed stall so the imported
        // layout always has a matching, fully-detailed template.
        const usedTemplates = this.usedTemplatesForVenue(
          tablesForVenue,
          allTemplates,
        );

        const payload = {
          venueConfig: venue,
          tableTemplates: usedTemplates,
          venueTables: tablesForVenue,
          // Round tables + speaker zones placed in this venue, plus their
          // palettes (imported by name-dedupe so unused ones are harmless).
          roundTableTemplates: allRoundTemplates,
          venueRoundTables: roundTablesForVenue,
          speakerSlotTemplates: allSpeakerTemplates,
          venueSpeakerZones: speakerZonesForVenue,
        };
        const name = String(venue.name || venueId || "Venue").trim();
        const signature = this.signature(
          this.normalizeVenueLayoutForSignature(payload),
        );
        await this.templateModel.updateOne(
          {
            organizerId: orgObjId,
            type: TemplateType.VENUE_LAYOUT,
            signature,
          },
          {
            $setOnInsert: {
              organizerId: orgObjId,
              type: TemplateType.VENUE_LAYOUT,
              name,
              signature,
              payload,
            },
          },
          { upsert: true },
        );
      } catch (err: any) {
        if (err?.code !== 11000) {
          this.logger.warn(
            `captureVenueLayoutTemplates failed for ${organizerId}: ${err?.message || err}`,
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
