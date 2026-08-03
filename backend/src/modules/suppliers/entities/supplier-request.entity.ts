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
  // Organizer sent a counter-offer / is negotiating the quotation.
  Negotiating = "Negotiating",
  // Organizer has paid part of the quote (advance / instalment) — a balance
  // is still outstanding. Settles to `Paid` once the balance is cleared.
  PartiallyPaid = "Partially Paid",
  // Organizer has paid the supplier in full and recorded the transaction.
  Paid = "Paid",
  // Service delivered / job done.
  Completed = "Completed",
  Cancelled = "Cancelled",
}

// One priced line of the supplier's quote, referencing an organizer requirement.
class QuotationItem {
  // Links back to the organizer's requirement. Older rows only carried the
  // label, so fulfilment matching falls back to that when this is absent.
  @Prop({ default: "" })
  requirementId: string;

  @Prop({ required: true })
  requirementLabel: string;

  /**
   * How much of the requirement this supplier can actually cover. A single
   * requirement is often split across several suppliers — 200 chairs might be
   * 120 from one and 80 from another — so this is the quantity being quoted
   * for, not the quantity the organizer asked for.
   */
  @Prop({ default: 0 })
  quantity: number;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: "" })
  note: string;

  // How much of this line has physically arrived at the venue, and how much
  // has gone back out again. Tracked separately from payment — goods can
  // arrive before the balance is settled, and vice versa.
  @Prop({ default: 0 })
  checkedInQty: number;

  @Prop({ default: 0 })
  checkedOutQty: number;
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

// One transfer the organizer made towards the quote. Suppliers are commonly
// paid an advance up front and the balance on/after delivery, so payment is
// modelled as a list of instalments rather than a single amount.
@Schema({ _id: false })
export class PaymentInstallment {
  @Prop({ default: 0 })
  amount: number;

  @Prop({ type: Date, default: Date.now })
  paidDate: Date;

  @Prop({ default: "" })
  method: string;

  @Prop({ default: "" })
  reference: string;

  // Organizer-uploaded proof of this particular transfer.
  @Prop({ default: "" })
  proofScreenshot: string;

  @Prop({ default: "" })
  notes: string;

  @Prop({ default: "" })
  recordedBy: string;
}

// The organizer's record of the payments they made to the supplier (manual
// bank transfers — this just logs them, no gateway). `amountPaid` is the
// running total across `installments`; `balanceDue` is what's still owed.
class PaymentRecord {
  // Cumulative total paid so far — the sum of `installments[].amount`.
  @Prop({ default: 0 })
  amountPaid: number;

  // Outstanding balance: quotationTotal − amountPaid, floored at 0.
  @Prop({ default: 0 })
  balanceDue: number;

  @Prop({ type: [PaymentInstallment], default: [] })
  installments: PaymentInstallment[];

  // Details of the most recent instalment, kept flat for back-compat with
  // records created before instalments existed.
  @Prop()
  paidDate?: Date;

  @Prop({ default: "" })
  method: string;

  @Prop({ default: "" })
  reference: string;

  // Organizer-uploaded proof of the latest transfer.
  @Prop({ default: "" })
  proofScreenshot: string;

  @Prop({ default: "" })
  notes: string;

  // Supplier-uploaded invoice / bill, and their confirmation that the payment
  // was received. Completes the payment hand-off timeline.
  @Prop({ default: "" })
  invoice: string;

  @Prop({ default: false })
  confirmedBySupplier: boolean;

  @Prop()
  confirmedAt?: Date;
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

  /**
   * Price actually agreed during negotiation. Once set, this — not the
   * original quote — is what the organizer owes, so payments, balances and
   * the P&L all follow the negotiated figure.
   */
  @Prop()
  agreedTotal?: number;

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

  // Who received or returned what, and when — the audit trail behind the
  // per-item checked-in / checked-out counts.
  @Prop({ type: [Object], default: [] })
  deliveryLog: {
    direction: "in" | "out";
    requirementLabel: string;
    quantity: number;
    at: Date;
    by?: string;
    note?: string;
  }[];

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
