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

  @Prop({ required: true })
  tablePositionId: string;

  @Prop({ required: true })
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
