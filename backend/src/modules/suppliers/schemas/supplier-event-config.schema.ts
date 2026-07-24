import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * One custom requirement the organizer needs from suppliers for an event.
 * The `id` is a stable client-generated key so quotations can reference the
 * exact requirement they are pricing.
 */
@Schema({ _id: false })
export class RequirementItem {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  label: string;

  @Prop({ default: "" })
  description: string;

  // Free-text quantity so it can hold "200 pax", "2 stages", etc.
  @Prop({ default: "" })
  quantity: string;

  // Optional budget hint shown to the supplier (in the event currency).
  @Prop()
  budget?: number;
}

export type SupplierEventConfigDocument = SupplierEventConfig & Document;

/**
 * Per-event supplier configuration: the organizer's custom requirements plus
 * the private link token that suppliers use to reach the quotation form. This
 * link is NEVER surfaced on the public eventfront — it is shared privately by
 * the organizer.
 */
@Schema({ collection: "supplier_event_configs", timestamps: true })
export class SupplierEventConfig {
  @Prop({
    type: Types.ObjectId,
    ref: "Event",
    required: true,
    unique: true,
    index: true,
  })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  // Whether the private link currently accepts submissions.
  @Prop({ default: false })
  enabled: boolean;

  // Random URL-safe token that gates the public quotation form. Regenerating
  // it revokes any previously shared link.
  @Prop({ index: true })
  linkToken: string;

  // Currency country code (mirrors the event/organizer currency), e.g. "IN".
  @Prop({ default: "IN" })
  currency: string;

  // The organizer's custom "what I need" list shown on the shared form.
  @Prop({ type: [RequirementItem], default: [] })
  requirements: RequirementItem[];

  // Optional free-text instructions shown above the requirements.
  @Prop({ default: "" })
  instructions: string;
}

export const SupplierEventConfigSchema =
  SchemaFactory.createForClass(SupplierEventConfig);
