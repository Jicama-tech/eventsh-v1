import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventExpenseDocument = EventExpense & Document;

/**
 * Broad buckets so the P&L can group spend without forcing the organizer to
 * invent a taxonomy. "Other" is the escape hatch.
 */
export const EXPENSE_CATEGORIES = [
  "Venue",
  "Staff",
  "Marketing",
  "Printing",
  "Transport",
  "Food & Beverage",
  "Equipment",
  "Permits & Licences",
  "Other",
] as const;

/** Pending until an approver signs it off; only Approved hits the P&L. */
export const EXPENSE_STATUSES = ["Pending", "Approved", "Rejected"] as const;

/**
 * A cost the organizer or an operator paid out of pocket for an event, outside
 * the supplier quotation flow — taxis, printing, permits, a last-minute run to
 * the hardware shop.
 *
 * Supplier payouts are NOT recorded here; they already come from
 * SupplierRequest.payment so counting them twice would understate profit.
 */
@Schema({ timestamps: true, collection: "event_expenses" })
export class EventExpense {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true, index: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: String, enum: EXPENSE_CATEGORIES, default: "Other" })
  category: string;

  @Prop({ required: true, default: 0 })
  amount: number;

  @Prop({ type: Date, default: Date.now })
  spentAt: Date;

  // Who the money went to (shop, vendor, individual). Free text.
  @Prop({ default: "" })
  paidTo: string;

  @Prop({ default: "" })
  notes: string;

  // Uploaded receipt/bill (path under /uploads/expenses).
  @Prop({ default: "" })
  receipt: string;

  // ── Who logged it — taken from the caller's token, never the request body,
  // so an expense can't be attributed to someone else. ──
  @Prop({ default: "" })
  recordedById: string;

  @Prop({ default: "" })
  recordedBy: string;

  @Prop({ default: "" })
  recordedByEmail: string;

  // Best-guess label from the token's roles, for display only.
  @Prop({ default: "organizer" })
  recordedByRole: string;

  // Raw roles as they were on the token at the time.
  @Prop({ type: [String], default: [] })
  recordedByRoles: string[];

  // ── Approval ──
  // Anyone on the team can log spend, but it only counts against the event's
  // profit once an approver signs it off.
  @Prop({ type: String, enum: EXPENSE_STATUSES, default: "Pending" })
  status: string;

  @Prop({ default: "" })
  approvedById: string;

  @Prop({ default: "" })
  approvedBy: string;

  @Prop({ default: "" })
  approvedByRole: string;

  @Prop()
  decidedAt?: Date;

  @Prop({ default: "" })
  rejectionReason: string;
}

export const EventExpenseSchema = SchemaFactory.createForClass(EventExpense);

EventExpenseSchema.index({ eventId: 1, spentAt: -1 });
EventExpenseSchema.index({ organizerId: 1, eventId: 1 });
