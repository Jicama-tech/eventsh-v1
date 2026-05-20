import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PendingBillingPaymentDocument =
  HydratedDocument<PendingBillingPayment>;

export type PendingBillingPaymentStatus =
  | "awaiting_payment"
  | "submitted"
  | "confirmed"
  | "rejected";

/**
 * One row per per-event platform-fee payment claim initiated by an organizer.
 * Lifecycle:
 *   awaiting_payment → submitted (organizer clicked "I have paid")
 *                    → confirmed (admin verified)
 *                    → rejected  (admin rejected)
 * On confirmation the matching row is mirrored into the existing
 * `organizer_payments` ledger so the super-admin OrganizerBillingDialog
 * keeps its existing "Total paid" / "Outstanding" math intact.
 */
@Schema({ collection: "pending_billing_payments", timestamps: true })
export class PendingBillingPayment {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String, required: true, enum: ["UPI", "PAYNOW"] })
  scheme: string;

  @Prop({
    type: String,
    required: true,
    enum: ["awaiting_payment", "submitted", "confirmed", "rejected"],
    default: "awaiting_payment",
  })
  status: PendingBillingPaymentStatus;

  @Prop({ type: String, required: true })
  ref: string;

  // Counts at the time of initiate (audit snapshot).
  @Prop({ type: Number, default: 0 }) stallsSold: number;
  @Prop({ type: Number, default: 0 }) tablesBooked: number;
  @Prop({ type: Number, default: 0 }) chairsBooked: number;
  @Prop({ type: Number, default: 0 }) speakersBooked: number;

  @Prop({ type: Date }) submittedAt?: Date;
  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: "Admin" }) confirmedBy?: Types.ObjectId;
  @Prop({ type: String }) rejectionReason?: string;
}

export const PendingBillingPaymentSchema = SchemaFactory.createForClass(
  PendingBillingPayment,
);
