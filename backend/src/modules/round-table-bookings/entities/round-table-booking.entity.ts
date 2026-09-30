import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RoundTableBookingDocument = RoundTableBooking & Document;

export enum RoundTablePaymentStatus {
  Pending = "Pending",
  Submitted = "Submitted",
  Paid = "Paid",
  Failed = "Failed",
  Refunded = "Refunded",
}

@Schema({ timestamps: true })
export class RoundTableBooking {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  // Empty while an organizer-allotted booking is still waiting for its
  // table (see allotmentPending); set by the visitor's own pick otherwise.
  @Prop({ default: "" })
  tablePositionId: string;

  @Prop({ default: "To be allotted" })
  tableName: string;

  @Prop({ default: "Standard" })
  tableCategory: string;

  @Prop({ required: true, enum: ["table", "chair"] })
  sellingMode: string;

  @Prop({ type: [Number], required: true })
  selectedChairIndices: number[];

  @Prop({ default: false })
  isWholeTable: boolean;

  @Prop({ required: true })
  numberOfSeats: number;

  @Prop({ required: true })
  visitorName: string;

  @Prop({ required: true })
  visitorEmail: string;

  @Prop({ required: true })
  visitorPhone: string;

  @Prop({ type: [Object], default: [] })
  seatGuests: { chairIndex: number; name: string; whatsApp: string; email: string }[];

  @Prop({ required: true })
  amount: number;

  // Organizer-allotted bookings (template's "Organizer Allots" seat
  // selection): created without a table — the visitor only requested N
  // seats (or a whole table) of a type — and the organizer assigns the
  // table and chairs from the dashboard (allot) before confirming payment.
  @Prop({ default: false })
  allotmentPending: boolean;

  @Prop()
  templateId?: string;

  // Operator attribution from the shared event link (?ref=). Set only by
  // the server once the code resolves to a referral-enabled operator of
  // this event's organizer — shown in the organizer's Participants area,
  // never on the visitor's ticket.
  @Prop()
  referralCode?: string;

  @Prop()
  referralOperatorId?: string;

  @Prop()
  referralOperatorName?: string;

  // Or an event AGENT's code (the event form's Agents tab) — one of the two
  // pairs is set, never both. Same visibility rules as the operator pair.
  @Prop()
  referralAgentId?: string;

  @Prop()
  referralAgentName?: string;

  @Prop({
    enum: RoundTablePaymentStatus,
    default: RoundTablePaymentStatus.Pending,
  })
  paymentStatus: RoundTablePaymentStatus;

  @Prop()
  qrCodeData: string;

  @Prop()
  qrCodePath: string;

  @Prop()
  checkInTime: Date;

  @Prop()
  checkOutTime: Date;

  @Prop({ default: false })
  hasCheckedIn: boolean;

  @Prop({ default: false })
  hasCheckedOut: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const RoundTableBookingSchema =
  SchemaFactory.createForClass(RoundTableBooking);

RoundTableBookingSchema.index({ eventId: 1, tablePositionId: 1 });
RoundTableBookingSchema.index({ eventId: 1, visitorEmail: 1 });
RoundTableBookingSchema.index({ qrCodeData: 1 });
RoundTableBookingSchema.index({ organizerId: 1, eventId: 1 });
