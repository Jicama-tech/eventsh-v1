import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ExhibitorMembershipDocument = ExhibitorMembership & Document;

// One exhibitor's enrollment in one membership plan, for one organizer.
//
// Lifecycle:
//   pending_payment        — record created at storefront step 1, before payment
//   pending_verification   — payment captured (gateway txn id stored); awaits organizer
//   active                 — organizer confirmed; startDate/endDate set, receipt mailed
//   expired                — endDate passed (set by daily cron)
//   cancelled              — organizer rejected or cancelled mid-term
@Schema({ collection: "exhibitor_memberships", timestamps: true })
export class ExhibitorMembership {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "MembershipPlan", required: true })
  planId: Types.ObjectId;

  // Vendor (= exhibitor) reference. Optional because the storefront flow can
  // create the membership before the Vendor row is finalised — backfilled
  // once the Vendor is saved.
  @Prop({ type: Types.ObjectId, ref: "Vendor", required: false, index: true })
  exhibitorId?: Types.ObjectId;

  // Denormalised lookup key — every lookup at booking time (Was this email a
  // member?) hits this field, not the Vendor join. Stored lowercased.
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  exhibitorEmail: string;

  @Prop({ trim: true })
  exhibitorName?: string;

  @Prop({ trim: true })
  exhibitorWhatsapp?: string;

  @Prop({
    required: true,
    enum: [
      "pending_payment",
      "pending_verification",
      "active",
      "expired",
      "cancelled",
    ],
    default: "pending_payment",
    index: true,
  })
  status: string;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ required: true, min: 0 })
  amountPaid: number;

  @Prop({ required: true, uppercase: true, maxlength: 3 })
  currency: string;

  @Prop({
    enum: ["manual", "razorpay", "stripe"],
    default: "razorpay",
  })
  paymentMethod: string;

  // Gateway transaction reference (e.g. Razorpay payment_id). Used by the
  // verification inbox so the organizer can cross-check with their gateway
  // dashboard before approving.
  @Prop()
  paymentRef?: string;

  @Prop()
  notes?: string;

  // Audit trail — appended on every status change (purchase, confirm, renew,
  // cancel). `by` records the actor (organizer id or "exhibitor"/"system").
  @Prop({
    type: [
      {
        action: { type: String },
        at: { type: Date, default: Date.now },
        by: { type: String },
        planId: { type: Types.ObjectId, ref: "MembershipPlan" },
        amountPaid: { type: Number },
        note: { type: String },
      },
    ],
    default: [],
  })
  history: {
    action: string;
    at: Date;
    by: string;
    planId?: Types.ObjectId;
    amountPaid?: number;
    note?: string;
  }[];
}

export const ExhibitorMembershipSchema = SchemaFactory.createForClass(
  ExhibitorMembership,
);

// One active enrollment per (organizer, exhibitor email). Partial index so
// expired/cancelled rows don't collide with a fresh active one.
ExhibitorMembershipSchema.index(
  { organizerId: 1, exhibitorEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);
ExhibitorMembershipSchema.index({ organizerId: 1, status: 1, endDate: 1 });
