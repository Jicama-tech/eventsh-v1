import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type StallDocument = Stall & Document;

// Sub-schema for selected tables
class SelectedTable {
  @Prop({ required: true })
  tableId: string;

  @Prop({ required: true })
  positionId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  tableType: string;

  @Prop()
  layoutName: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  depositAmount: number;
  tableName: any;
}

// Sub-schema for selected add-ons
class SelectedAddOn {
  @Prop({ required: true })
  addOnId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 1 })
  quantity: number;
}

// A pending "Edit Request" amendment on an already-Completed booking. The
// vendor may raise the operator count and add/increase add-ons (never reduce);
// any add-on price increase is paid as a top-up. The live booking stays intact
// until the organizer confirms, at which point the amendment is applied, the
// coupon max-usage is bumped and the QR ticket re-issued.
class PendingAmendment {
  // Proposed operator count (free — only resizes the coupon / QR).
  @Prop({ default: "0" })
  noOfOperators: string;

  // Proposed FULL add-on list (existing + added), each >= its current quantity.
  @Prop({ type: [SelectedAddOn], default: [] })
  selectedAddOns: SelectedAddOn[];

  // Proposed add-on total and the extra amount owed (newAddOnsTotal - old).
  @Prop({ default: 0 })
  addOnsTotal: number;

  @Prop({ default: 0 })
  amountDue: number;

  // awaiting_payment -> vendor must pay the difference;
  // paid_pending_confirm -> paid (or nothing owed), awaiting organizer;
  // confirmed -> applied (cleared once done).
  @Prop({
    type: String,
    enum: ["awaiting_payment", "paid_pending_confirm", "confirmed"],
    default: "awaiting_payment",
  })
  status: string;

  // Top-up payment proof for the difference (mirrors the main payment fields).
  @Prop() transactionId?: string;
  @Prop() transactionScreenshot?: string;
  @Prop() paymentMethod?: string;

  @Prop({ default: Date.now }) requestedAt: Date;
  @Prop() paidAt?: Date;
  @Prop() confirmedAt?: Date;
}

// A vendor-initiated request to cancel/delete a booking. The vendor gives a
// reason; the organizer approves (frees the space, kills the QR, emails the
// vendor a refund note) or rejects. Stays pending until the organizer decides.
class PendingCancellation {
  @Prop({ default: "" })
  reason: string;

  @Prop({
    type: String,
    enum: ["requested", "approved", "rejected"],
    default: "requested",
  })
  status: string;

  // Organizer's note to the vendor (e.g. when/how the refund will be returned).
  @Prop({ default: "" })
  organizerNote: string;

  @Prop({ default: Date.now }) requestedAt: Date;
  @Prop() resolvedAt?: Date;
}

export enum StallStatusEnum {
  Pending = "Pending",
  Approved = "Approved",
  Confirmed = "Confirmed",
  Processing = "Processing",
  Cancelled = "Cancelled",
  Completed = "Completed",
  Returned = "Returned",
  Forfeited = "Forfeited",
  Unpaid = "Unpaid",
  Partial = "Partial",
  Paid = "Paid",
}

@Schema({ _id: false })
export class StatusHistory {
  @Prop({ type: String, enum: StallStatusEnum, required: true })
  status: StallStatusEnum;

  @Prop({ type: String, required: false })
  note?: string;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop({ type: String, required: false })
  changedBy?: string;
}

@Schema({ timestamps: true })
export class Stall {
  @Prop({ type: Types.ObjectId, ref: "Vendor", required: true })
  shopkeeperId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  // Preferred space template — vendor's interest during registration.
  // Singular fields kept for legacy / backward compatibility.
  @Prop({ default: null })
  preferredTemplateId: string;

  @Prop({ default: null })
  preferredTemplateName: string;

  // Multiple preferred templates — lets a vendor register interest in a
  // COMBINATION of space types. Selection on the venue map is restricted to
  // any template in this set (falls back to the singular field above).
  @Prop({ type: [String], default: [] })
  preferredTemplateIds: string[];

  @Prop({ type: [String], default: [] })
  preferredTemplateNames: string[];

  // Requested quantity per preferred template, parallel to
  // preferredTemplateIds (e.g. [2] = 2 of one type, [1,1] = 1 each of two).
  // Sum is capped by the event's maxSpacesPerVendor.
  @Prop({ type: [Number], default: [] })
  preferredTemplateQuantities: number[];

  // Payment verification
  @Prop({ default: null })
  transactionId: string;

  @Prop({ default: null })
  transactionScreenshot: string;

  @Prop({ default: null })
  paymentMethod: string; // "qr" | "bank_transfer"

  // Request Status - Workflow status
  @Prop({
    enum: StallStatusEnum,
    default: "Pending",
  })
  status: string;

  // Payment Status - Separate from booking status
  @Prop({
    enum: ["Unpaid", "Partial", "Paid"],
    default: "Unpaid",
  })
  paymentStatus: string;

  // Table Selection - Array of selected tables
  @Prop({ type: [SelectedTable], default: [] })
  selectedTables: SelectedTable[];

  // Add-on Selection - Array of selected add-ons
  @Prop({ type: [SelectedAddOn], default: [] })
  selectedAddOns: SelectedAddOn[];

  // Pricing Breakdown
  @Prop({ default: 0 })
  tablesTotal: number;

  @Prop({ default: 0 })
  depositTotal: number;

  @Prop({ default: 0 })
  addOnsTotal: number;

  @Prop({ default: 0 })
  grandTotal: number;

  @Prop({ default: 0 })
  paidAmount: number;

  @Prop({ default: 0 })
  remainingAmount: number;

  // QR Code Fields - NEW
  @Prop({ default: null })
  qrCodePath: string; // Path to saved QR code image

  @Prop({ default: null })
  qrCodeData: string; // Encrypted QR data string

  // Attendance Tracking Fields - NEW
  @Prop({ default: null })
  checkInTime: Date; // First scan time

  @Prop({ default: null })
  checkOutTime: Date; // Second scan time

  @Prop({ default: false })
  hasCheckedIn: boolean;

  @Prop({ default: false })
  hasCheckedOut: boolean;

  // Timestamps for workflow tracking
  @Prop({ default: Date.now })
  requestDate: Date;

  @Prop()
  confirmationDate?: Date;

  @Prop()
  selectionDate?: Date;

  @Prop()
  paymentDate?: Date;

  @Prop()
  paymentConfirmedDate?: Date; // When organizer confirms payment - NEW

  @Prop()
  completionDate?: Date;

  @Prop()
  depositReturned?: boolean;

  @Prop()
  depositReturnedDate?: Date;

  // Additional Information
  @Prop()
  notes?: string;

  @Prop()
  cancellationReason?: string;

  // Auto-managed timestamps
  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: "0" })
  noOfOperators: string;

  @Prop()
  couponCodeAssigned: string;

  @Prop()
  brandName: string;

  @Prop()
  nameOfApplicant: string;

  @Prop()
  registrationNumber?: string;

  @Prop()
  registrationImage: string;

  @Prop()
  businessOwnerNationality: string;

  @Prop()
  residency: string;

  @Prop()
  refundPaymentDescription: string;

  @Prop()
  companyLogo?: string;

  @Prop()
  faceBookLink?: string;

  @Prop()
  instagramLink?: string;

  @Prop()
  productDescription?: string;

  @Prop()
  productImage?: string[];

  @Prop()
  couponCodeApplied?: string;

  @Prop({
    type: [
      {
        status: { type: String, enum: StallStatusEnum },
        note: { type: String },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: String },
      },
    ],
    default: [],
  })
  statusHistory: StatusHistory[];

  @Prop({ default: Date.now })
  updatedAt: Date;

  // Present only while an "Edit Request" amendment is in flight; cleared when
  // the organizer confirms it. Undefined for bookings with no pending edit.
  @Prop({ type: PendingAmendment, default: undefined })
  pendingAmendment?: PendingAmendment;

  // Present only while a cancellation/deletion request awaits the organizer's
  // decision; cleared/resolved once they approve or reject.
  @Prop({ type: PendingCancellation, default: undefined })
  pendingCancellation?: PendingCancellation;
}

export const StallSchema = SchemaFactory.createForClass(Stall);

// Add indexes for common queries
StallSchema.index({ eventId: 1, shopkeeperId: 1 });
StallSchema.index({ organizerId: 1, eventId: 1 });
StallSchema.index({ status: 1 });
StallSchema.index({ paymentStatus: 1 });
StallSchema.index({ shopkeeperId: 1 });
StallSchema.index({ organizerId: 1 });
StallSchema.index({ eventId: 1, status: 1 });
StallSchema.index({ qrCodeData: 1 }); // NEW - for QR scanning
