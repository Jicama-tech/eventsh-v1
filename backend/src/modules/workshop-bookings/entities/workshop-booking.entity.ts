import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type WorkshopBookingDocument = WorkshopBooking & Document;

export enum WorkshopPaymentStatus {
  Pending = "Pending",
  Submitted = "Submitted",
  Paid = "Paid",
  Failed = "Failed",
  Refunded = "Refunded",
}

@Schema({ timestamps: true })
export class WorkshopBooking {
  @Prop({ type: Types.ObjectId, ref: "Event", required: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizerId: Types.ObjectId;

  @Prop({ required: true, enum: ["session", "package"] })
  bookingType: string;

  // Set when bookingType is "session".
  @Prop()
  sessionId: string;

  // Set when bookingType is "package".
  @Prop()
  packageId: string;

  // The individual session ids this booking occupies a seat in — one entry
  // for a single-session booking, all of the package's sessions for a
  // package booking. Used to decrement/re-check capacity on confirmation.
  @Prop({ type: [String], required: true })
  sessionIds: string[];

  @Prop({ required: true })
  itemName: string;

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop({ required: true })
  visitorName: string;

  @Prop({ required: true })
  visitorEmail: string;

  @Prop({ required: true })
  visitorPhone: string;

  @Prop({ required: true })
  amount: number;

  @Prop({
    enum: WorkshopPaymentStatus,
    default: WorkshopPaymentStatus.Pending,
  })
  paymentStatus: WorkshopPaymentStatus;

  @Prop()
  qrCodeData: string;

  @Prop()
  qrCodePath: string;

  @Prop()
  checkInTime: Date;

  @Prop({ default: false })
  hasCheckedIn: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const WorkshopBookingSchema =
  SchemaFactory.createForClass(WorkshopBooking);

WorkshopBookingSchema.index({ eventId: 1, sessionId: 1 });
WorkshopBookingSchema.index({ eventId: 1, visitorEmail: 1 });
WorkshopBookingSchema.index({ qrCodeData: 1 });
WorkshopBookingSchema.index({ organizerId: 1, eventId: 1 });
