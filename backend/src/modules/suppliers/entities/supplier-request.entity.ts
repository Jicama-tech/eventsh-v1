import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type SupplierRequestDocument = SupplierRequest & Document;

export enum SupplierRequestStatus {
  // Supplier has submitted a quotation, awaiting the organizer's decision.
  Quoted = "Quoted",
  // Organizer accepted the quotation.
  Approved = "Approved",
  // Organizer declined the quotation.
  Rejected = "Rejected",
  // Organizer has paid the supplier and recorded the transaction.
  Paid = "Paid",
  // Service delivered / job done.
  Completed = "Completed",
  Cancelled = "Cancelled",
}

// One priced line of the supplier's quote, referencing an organizer requirement.
class QuotationItem {
  @Prop({ required: true })
  requirementLabel: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: "" })
  note: string;
}

// Where the organizer should send payment — supplied by the supplier so the
// organizer can transfer funds and keep a record.
class AccountDetails {
  @Prop({ default: "" })
  accountHolderName: string;

  @Prop({ default: "" })
  bankName: string;

  @Prop({ default: "" })
  accountNumber: string;

  // IFSC (India) / SWIFT / UEN / routing number — one field, region-agnostic.
  @Prop({ default: "" })
  ifscSwiftUen: string;

  @Prop({ default: "" })
  upiPaynowId: string;

  @Prop({ default: "" })
  country: string;
}

// The organizer's record of the payment they made to the supplier (manual
// bank transfer — this just logs it, no gateway).
class PaymentRecord {
  @Prop({ default: 0 })
  amountPaid: number;

  @Prop()
  paidDate?: Date;

  @Prop({ default: "" })
  method: string;

  @Prop({ default: "" })
  reference: string;

  // Organizer-uploaded proof of the transfer.
  @Prop({ default: "" })
  proofScreenshot: string;

  @Prop({ default: "" })
  notes: string;
}

@Schema({ _id: false })
export class SupplierStatusHistory {
  @Prop({ type: String, enum: SupplierRequestStatus, required: true })
  status: SupplierRequestStatus;

  @Prop({ type: String, required: false })
  note?: string;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop({ type: String, required: false })
  changedBy?: string;
}

/**
 * A supplier's quotation for a specific event. One per (event, supplier) —
 * suppliers submit a single quote. Carries the quote, their payout account
 * details, the organizer's payment record, and a status timeline mirroring the
 * stall detail dialog.
 */
@Schema({ timestamps: true })
export class SupplierRequest {
  @Prop({ type: Types.ObjectId, ref: "Supplier", required: true, index: true })
  supplierId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Event", required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({
    type: String,
    enum: SupplierRequestStatus,
    default: SupplierRequestStatus.Quoted,
  })
  status: SupplierRequestStatus;

  @Prop({ type: [QuotationItem], default: [] })
  quotationItems: QuotationItem[];

  @Prop({ default: 0 })
  quotationTotal: number;

  @Prop({ default: "" })
  quotationNotes: string;

  // Optional supplier-uploaded quote document (image/pdf path).
  @Prop({ default: "" })
  quotationAttachment: string;

  @Prop()
  validUntil?: Date;

  @Prop({ type: AccountDetails, default: () => ({}) })
  accountDetails: AccountDetails;

  @Prop({ type: PaymentRecord, default: () => ({}) })
  payment: PaymentRecord;

  @Prop({ default: "" })
  notes: string;

  @Prop({ default: "" })
  rejectionReason: string;

  @Prop({ type: [SupplierStatusHistory], default: [] })
  statusHistory: SupplierStatusHistory[];

  @Prop({ default: Date.now })
  submittedAt: Date;
}

export const SupplierRequestSchema =
  SchemaFactory.createForClass(SupplierRequest);

// One quotation per supplier per event (single-submission rule), plus common
// organizer query paths.
SupplierRequestSchema.index({ eventId: 1, supplierId: 1 }, { unique: true });
SupplierRequestSchema.index({ organizerId: 1, eventId: 1 });
SupplierRequestSchema.index({ eventId: 1, status: 1 });
