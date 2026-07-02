import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type TemplateDocument = Template & Document;

export enum TemplateType {
  SPACE = "space",
  ROUND_TABLE = "roundTable",
  SPEAKER = "speaker",
  // A whole venue layout — one venue's config + the stall types it uses +
  // the placed stalls. Payload shape: { venueConfig, tableTemplates,
  // venueTables }. Lets an organizer re-import a past venue design.
  VENUE_LAYOUT = "venueLayout",
}

// Generic template store. `payload` carries the type-specific shape so we can
// add roundTable / speaker variants later without schema changes.
@Schema({ timestamps: true, collection: "templates" })
export class Template {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TemplateType), required: true, index: true })
  type: TemplateType;

  @Prop({ required: true, index: true })
  name: string;

  // Stable hash of the canonical fields. Lets us treat
  // (organizerId, type, signature) as the dedupe key — same name + same
  // numbers collapses into one row, but a price tweak creates a new variant.
  @Prop({ required: true, index: true })
  signature: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

// Compound uniqueness — dedupe key for upserts.
TemplateSchema.index(
  { organizerId: 1, type: 1, signature: 1 },
  { unique: true },
);
