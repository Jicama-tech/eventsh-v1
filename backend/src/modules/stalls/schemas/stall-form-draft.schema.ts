import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type StallFormDraftDocument = StallFormDraft & Document;

/**
 * In-progress stall registration form, saved per (event, vendor email) so a
 * vendor who drops off mid-form resumes on their next Google sign-in — from
 * any device — at the sub-step they left, with the Terms gate already
 * acknowledged. Deleted when the registration is submitted; abandoned drafts
 * expire via TTL.
 */
@Schema({ collection: "stallformdrafts", timestamps: true })
export class StallFormDraft {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  // Google-authed vendor email, stored lowercased.
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  // 1-based sub-step of the "Your details" form the vendor last reached.
  @Prop({ default: 1, min: 1, max: 3 })
  subStep: number;

  // Set when the vendor accepts the Rules & Regulations gate — once present
  // the gate is skipped on every later visit for this event+email.
  @Prop({ type: Date, default: null })
  termsAcceptedAt: Date | null;

  // Business-email OTP already passed — don't force a re-verify on resume.
  @Prop({ default: false })
  emailVerified: boolean;

  // Serializable snapshot of the form fields (shopkeeperDetails + refund
  // method/detail). Files are never stored here — text fields only.
  @Prop({ type: Object, default: {} })
  form: Record<string, any>;

  // Managed by timestamps; declared for the TTL index below.
  updatedAt?: Date;
}

export const StallFormDraftSchema =
  SchemaFactory.createForClass(StallFormDraft);

// One draft per vendor per event.
StallFormDraftSchema.index({ eventId: 1, email: 1 }, { unique: true });
// Abandoned drafts self-clean after 30 days of inactivity.
StallFormDraftSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);
