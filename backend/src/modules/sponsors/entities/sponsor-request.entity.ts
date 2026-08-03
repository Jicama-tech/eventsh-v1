import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SponsorRequestDocument = SponsorRequest & Document;

export enum SponsorRequestStatus {
  // Business applied against a tier; organizer hasn't decided yet.
  Applied = "Applied",
  // Organizer accepted the application — awaiting payment.
  Approved = "Approved",
  // Sponsor submitted payment details/proof; organizer needs to verify.
  PaymentSubmitted = "Payment Submitted",
  // Organizer confirmed the money landed. The sponsorship is live.
  Confirmed = "Confirmed",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
}

@Schema({ _id: false })
export class SponsorStatusHistory {
  @Prop({ type: String, enum: SponsorRequestStatus, required: true })
  status: SponsorRequestStatus;

  @Prop({ type: String, required: false })
  note?: string;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop({ type: String, required: false })
  changedBy?: string;
}

/**
 * A business applying to sponsor an event against one of the organizer's
 * `Event.sponsorTypes` tiers.
 *
 * Money flows the opposite way to a SupplierRequest: here the sponsor pays the
 * organizer, so the payment fields mirror the stall-booking model (manual
 * transfer + uploaded proof, verified by the organizer) rather than the
 * supplier payout model.
 */
@Schema({ timestamps: true, collection: "sponsorrequests" })
export class SponsorRequest {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  // The organizer's directory entry for this business. Created on the fly when
  // they apply (mirroring how a SupplierRequest gets its Supplier), so every
  // applicant shows up in the Sponsors CRM without manual re-entry.
  @Prop({ type: Types.ObjectId, ref: "Sponsor", required: false, index: true })
  sponsorId?: Types.ObjectId;

  // ---- Chosen tier (snapshotted so later edits to the tier don't rewrite
  // history on an application that was already priced and paid) ----
  @Prop({ required: true })
  sponsorTypeId: string;

  @Prop({ required: true })
  sponsorTypeName: string;

  @Prop({ default: 0 })
  amount: number;

  // Snapshotted from the tier at apply time (see `sponsorTypeId` above for
  // why) — whether this application is a paid tier or a non-cash one.
  @Prop({ default: true })
  collectPayment: boolean;

  // For a non-cash tier: which of the tier's `customOptions` the sponsor
  // chose (vouchers, coupons, etc.). Empty for paid tiers.
  @Prop({ type: [String], default: [] })
  selectedOptions: string[];

  // ---- The business ----
  @Prop({ required: true })
  companyName: string;

  @Prop({ required: true })
  contactName: string;

  // Google-verified sign-in address.
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  // Company/accounts address. The invoice goes to both.
  @Prop({ lowercase: true, trim: true, default: "" })
  businessEmail: string;

  @Prop({ default: "" })
  phone: string;

  @Prop({ default: "" })
  countryCode: string;

  @Prop({ default: "" })
  website: string;

  // Uploaded business logo (path under /uploads/sponsors). Shown to the
  // organizer on the application, and — once confirmed — eligible for the
  // eventfront sponsor marquee.
  @Prop({ default: "" })
  logo: string;

  @Prop({ default: "" })
  message: string;

  // ---- Payment (sponsor → organizer, manual transfer + proof) ----
  @Prop({ default: "" })
  transactionId: string;

  @Prop({ default: "" })
  transactionScreenshot: string;

  // "qr" | "bank_transfer" — matches the stall booking convention.
  @Prop({ default: "" })
  paymentMethod: string;

  @Prop()
  paidAt?: Date;

  // Set when the organizer eyeballs the proof and confirms the money landed.
  @Prop({ default: false })
  paymentVerified: boolean;

  @Prop()
  paymentVerifiedAt?: Date;

  @Prop({
    type: String,
    enum: SponsorRequestStatus,
    default: SponsorRequestStatus.Applied,
  })
  status: SponsorRequestStatus;

  // Invoice issued to the sponsor when the organizer verifies the payment.
  @Prop({ default: "" })
  invoiceNumber: string;

  @Prop()
  invoiceSentAt?: Date;

  @Prop({ default: "" })
  rejectionReason: string;

  @Prop({ type: [SponsorStatusHistory], default: [] })
  statusHistory: SponsorStatusHistory[];

  @Prop({ default: Date.now })
  submittedAt: Date;
}

export const SponsorRequestSchema =
  SchemaFactory.createForClass(SponsorRequest);

// One application per business per event — a company shouldn't be able to
// double-apply. Plus the organizer's common query paths.
SponsorRequestSchema.index({ eventId: 1, email: 1 }, { unique: true });
SponsorRequestSchema.index({ organizerId: 1, eventId: 1 });
SponsorRequestSchema.index({ eventId: 1, status: 1 });
