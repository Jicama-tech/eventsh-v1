import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type OrganizerAddOnPurchaseDocument =
  HydratedDocument<OrganizerAddOnPurchase>;

export type AddOnPurchaseStatus =
  | "pending_payment" // created at initiate; QR shown to organizer
  | "submitted" // organizer clicked "I have paid"
  | "active" // admin verified the transfer; entitlement live
  | "expired" // endDate passed (daily sweep / lazy check)
  | "rejected"; // admin rejected — no entitlement granted

/**
 * One row per add-on purchase attempt by an organizer. Rides the same
 * manual-verification payment pipeline as plan purchases (a linked
 * PendingSubscriptionPayment with type "addon" carries the QR/ref).
 * Pricing is frozen at initiate time — the prorated amount the organizer
 * saw is what the admin confirms against, even if days tick by before the
 * transfer is verified. On activation, endDate is pinned to the organizer's
 * planExpiryDate (co-terminus) so add-ons always lapse with the plan.
 */
@Schema({ collection: "organizer_addon_purchases", timestamps: true })
export class OrganizerAddOnPurchase {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  // Plan the add-on was bought against (the organizer's plan at initiate).
  @Prop({ type: Types.ObjectId, ref: "Plan", required: true })
  planId: Types.ObjectId;

  @Prop({ type: String, required: true })
  addOnKey: string;

  // Snapshots — survive later edits to the plan's addOns config.
  @Prop({ type: String, required: true })
  addOnName: string;

  @Prop({ type: Number })
  limitDelta?: number;

  // Frozen proration math, kept verbatim for receipts and audit.
  @Prop({ type: Number, required: true, min: 0 })
  fullPrice: number;

  @Prop({ type: Number, required: true, min: 0 })
  proratedPrice: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: Number, required: true })
  remainingDays: number;

  @Prop({ type: Number, required: true })
  cycleDays: number;

  @Prop({
    type: String,
    required: true,
    enum: ["pending_payment", "submitted", "active", "expired", "rejected"],
    default: "pending_payment",
    index: true,
  })
  status: AddOnPurchaseStatus;

  // Set on admin confirm. endDate === organizer.planExpiryDate at that moment.
  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  // Linked payment row carrying ref / scheme / submitted timestamps.
  @Prop({ type: Types.ObjectId, ref: "PendingSubscriptionPayment" })
  pendingPaymentId?: Types.ObjectId;

  // Audit trail — appended on every state change (memberships pattern).
  @Prop({
    type: [
      {
        action: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: String, required: true },
        note: { type: String },
      },
    ],
    default: [],
  })
  history: Array<{ action: string; at: Date; by: string; note?: string }>;
}

export const OrganizerAddOnPurchaseSchema = SchemaFactory.createForClass(
  OrganizerAddOnPurchase,
);

// Fast "what's live for this organizer" lookups (entitlement overlay).
OrganizerAddOnPurchaseSchema.index({ organizerId: 1, status: 1 });
