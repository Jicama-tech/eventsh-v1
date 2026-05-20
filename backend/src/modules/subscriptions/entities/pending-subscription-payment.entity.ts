import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type PendingSubscriptionPaymentDocument =
  HydratedDocument<PendingSubscriptionPayment>;

export type PendingSubscriptionStatus =
  | "awaiting_payment"
  | "submitted"
  | "confirmed"
  | "rejected";

/**
 * One row per subscription-purchase attempt by an organizer. Lifecycle:
 *   awaiting_payment → submitted (organizer clicked "I have paid")
 *                    → confirmed (admin verified the bank transfer)
 *                    → rejected   (admin rejected — no plan applied)
 * On `confirmed`, the matching plan is applied to the organizer and a
 * WhatsApp receipt is sent.
 */
@Schema({ collection: "pending_subscription_payments", timestamps: true })
export class PendingSubscriptionPayment {
  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Plan", required: true })
  planId: Types.ObjectId;

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
  status: PendingSubscriptionStatus;

  @Prop({ type: String, required: true })
  ref: string;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Date })
  confirmedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "Admin" })
  confirmedBy?: Types.ObjectId;

  @Prop({ type: String })
  rejectionReason?: string;
}

export const PendingSubscriptionPaymentSchema = SchemaFactory.createForClass(
  PendingSubscriptionPayment,
);
