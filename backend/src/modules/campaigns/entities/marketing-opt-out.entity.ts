import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type MarketingOptOutDocument = MarketingOptOut & Document;

/**
 * A number this organizer must not send marketing messages to — the
 * campaign screen's "Marketing messages" switch, turned off for a contact.
 *
 * Per organizer: a person who asked one organizer to stop has not asked every
 * organizer. Keyed by the NUMBER rather than a record, because the same
 * person exists many times over in eventsh — as a ticket buyer for one event,
 * a round-table booker for another, a CRM row added by hand — and an opt-out
 * is a promise about the number, not about one record of it. The contact id
 * the switch was flipped on is kept only so the list can show who it was.
 */
@Schema({
  collection: "whatsapp_marketing_optouts",
  timestamps: { createdAt: true, updatedAt: false },
})
export class MarketingOptOut {
  @Prop({ type: String, required: true })
  organizerId: string;

  /** The number as WhatsApp would address it, digits only. */
  @Prop({ type: String, required: true })
  phoneDigits: string;

  /** `<source>:<id>` of the contact the switch was flipped on, for display. */
  @Prop({ type: String, default: "" })
  contactId: string;

  @Prop({ type: String, default: "" })
  name: string;

  createdAt?: Date;
}

export const MarketingOptOutSchema =
  SchemaFactory.createForClass(MarketingOptOut);

// The campaign runner asks "opted out?" by number before every message.
MarketingOptOutSchema.index({ organizerId: 1, phoneDigits: 1 }, { unique: true });
